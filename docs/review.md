# Catatan Review — HRMS Enterprise (hris-draft)

Rekap lengkap dari review menyeluruh: **Auth/Security, Employee, Attendance, Organization, Payroll, Leave, RBAC, User, Audit-Log, Workflow-Engine, Performance/KPI**, dan seluruh modul pendukung (**asset, benefit, document-management, employee-loan, notification, onboarding, permission-request, recruitment, reports, training, travel-expense, work-calendar**).

Legenda prioritas:
- 🔴 **Kritis** — data leak / cross-tenant / IDOR / privilege escalation, wajib dibenahi sebelum produksi
- 🟠 **Sedang** — celah keamanan atau gap fungsional yang berdampak nyata (termasuk dampak finansial)
- 🟡 **Minor** — code quality / hardening / best practice / optimasi

---

## Ringkasan Eksekutif

Codebase ini secara **desain bisnis & domain logic** sudah cukup matang (perhitungan BPJS/PPh21/lembur sesuai regulasi, concurrency-safe leave approval, audit log anti-tamper, upload validation pakai magic bytes). Tapi ada **satu akar masalah arsitektur yang berulang di hampir semua modul**: tidak ada layer terpusat yang memvalidasi bahwa `companyId`/`employeeId` yang dipakai query benar-benar milik/berwenang bagi user yang login. Middleware yang tepat untuk ini (`CompanyScope`, `authorizeOwnership`) **sudah dibuat tapi tidak pernah dipakai** — pola "alat sudah ada, tidak disambungkan" ini muncul berkali-kali (juga di `auditLog()` middleware, `CompanySetting`/`GroupPolicy` table).

**21 dari 23 modul yang diperiksa** punya minimal satu instance dari bug scoping ini.

---

## 🔴 KRITIS

### 1. Privilege escalation: user biasa bisa jadi SUPER_ADMIN

**File:** `auth.service.ts` (`buildAuthContext`), `rbac.service.ts` (`assignToUser`), `user.routes.ts`

Permission user di-flatten dari semua role tanpa membawa konteks company/scope:
```ts
const permissions = Array.from(new Set(
  user.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => `${rp.permission.resource}:${rp.permission.action}`))
));
```
`authorize()` middleware cuma cek list flat ini. Endpoint assign-role (`PUT /users/:id/roles`) cuma digerbangi permission generik `rbac:update`, dan `assignToUser()` tidak validasi apakah requester berwenang grant role/scope yang diminta.

**Rangkaian eksploitasi:** HR Admin biasa (punya `rbac:update` untuk kelola role di company-nya) → kirim `PUT /users/<dirinya>/roles` dengan `roleIds: [<SUPER_ADMIN>]`, `scopeType: 'GLOBAL'` → lolos karena `assignToUser` cuma cek role-nya exist → jadi SUPER_ADMIN, bypass semua `authorize()` di sistem.

**Rekomendasi:**
- `assignToUser` harus validasi requester tidak bisa grant role dengan scope/permission lebih tinggi dari yang ia sendiri punya.
- Role `scope: GLOBAL` (termasuk SUPER_ADMIN) cuma boleh di-assign oleh SUPER_ADMIN lain.
- Permission idealnya carry `companyId` context per-assignment, bukan cuma flat per-role.

### 2. Escalation di atas: nol jejak di audit log

**File:** semua `*.routes.ts`

Middleware `auditLog()` (hash-chain anti-tamper, sudah dibangun bagus) cuma dipasang di **2 route dari ratusan**: `PUT /employees/:id` dan `DELETE /employees/:id`. Role assignment, payroll approve/disburse, company mutation, permission grant — semua **tidak tercatat**.

**Rekomendasi:** pasang `auditLog()` di semua endpoint sensitif (role/permission mutation, user CRUD, company/payroll mutation, approval actions), idealnya via generic middleware otomatis berdasarkan method+resource, bukan manual per-route.

### 3. `CompanyScope` middleware tidak pernah dipakai → cross-tenant data leak di 9+ modul

**File:** `shared/middleware/CompanyScope.ts` (dead code)

`companyId` diambil langsung dari `req.query`/`req.body` tanpa dicek ke `req.user.companyScope`, di:
- `employee` — `findAll`, `findById`, `create`
- `attendance` — `findAll`, `findById`, `getSummary`, `getReport`
- `organization` — branch, division, department, position, group (semua CRUD)
- `payroll` — salary components, employee salaries, periods, runs
- `leave`, `performance`, `audit-log`
- `asset`, `benefit`, `document-management`, `employee-loan`, `onboarding`, `recruitment`, `reports`, `training`, `travel-expense`

**Dampak:** user Company A dengan permission apapun (`resource:read/update`) bisa akses/ubah data Company B lain cuma dengan ganti `companyId` — termasuk gaji, PII, struktur organisasi.

**Rekomendasi:** jangan tambal manual satu-satu (23 modul). Bangun **Prisma middleware/extension global** yang otomatis inject filter `companyId` dari `req.user`, supaya endpoint baru otomatis terlindungi. Pola yang benar sudah ada di `company.controller.ts` (`findAll`/`findById`) — tinggal disebarkan secara terpusat.

### 4. `GET /payroll/payslips` ("My Payslips") — bisa intip gaji siapa saja

**File:** `payroll.controller.ts` → `findMyPayslips()`
```ts
const employeeId = req.query.employeeId as string; // harusnya req.user.employeeId
```
Endpoint self-service tapi `employeeId` dari query param. Siapapun dengan `payroll:read` (biasanya izin dasar semua karyawan) bisa lihat slip gaji orang lain.

**Rekomendasi:** paksa `employeeId = req.user.employeeId`; buat endpoint terpisah untuk HR yang perlu lihat payslip orang lain.

### 5. IDOR di 7 sub-entity Employee (family, education, skill, training, experience, emergency contact, attachment)

**File:** `employee.controller.ts` / `employee.service.ts`

Route minta dua ID (`/employees/:id/families/:familyId`), tapi update/delete cuma pakai ID sub-entity, `employeeId` diabaikan. Siapapun dengan `employee:update` bisa ubah/hapus data sub-entity milik karyawan manapun.

Pola yang benar **sudah ada** di fungsi lain di file yang sama (`updateCompanyAssignment`):
```ts
const current = await employeeRepository.findCompanyAssignmentById(assignmentId);
if (!current || current.employeeId !== employeeId) throw new NotFoundError(...);
```
**Rekomendasi:** terapkan pola ownership-check yang sama ke ketujuh sub-entity.

---

## 🟠 SEDANG

### 6. Overtime & attendance tidak pernah masuk ke perhitungan Payroll

**File:** `payroll.service.ts` → `calculatePayroll()`
```ts
workDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, overtimeHours: 0, // selalu hardcode 0
```
Model `Payslip` sudah punya kolom untuk ini, tapi tidak pernah diisi dari `OvertimeRequest`/attendance/leave. Engine `calculateOvertimePay()` sudah benar secara hukum tapi cuma bisa diakses manual per satu pengajuan — tidak nyambung otomatis ke payslip.

> **Catatan:** ini persis fitur yang jadi nilai jual utama kompetitor seperti GreatDay HR — *"GreatDay HR's smart system will automatically calculate all overtime earnings and leave deductions... All earnings and deductions will also be detailed on payslip."* Lihat bagian **Kesesuaian Alur vs GreatDay HR** di bawah.

**Rekomendasi:** di `calculatePayroll()`, query overtime approved + attendance/leave dalam periode → masukkan ke `extraComponents`, contek pola `ensureLoanDeductionComponent` yang sudah terbukti jalan untuk loan.

### 7. Belum ada fitur potong gaji otomatis berdasarkan telat/absen

Sudah dikonfirmasi tidak ada di kode maupun schema saat ini (`BranchAttendancePolicy` cuma atur toleransi & GPS, bukan potongan gaji; `SalaryComponent.calculationMethod: 'FORMULA'` dideklarasikan tapi tidak pernah diimplementasi). Terhubung ke temuan #6 dan #17 (Company Settings).

### 8. Payroll: tidak ada pemisahan approve vs disburse (maker-checker)

**File:** `payroll.routes.ts` — approve dan disburse pakai permission identik (`payroll:approve`). Satu orang bisa approve **dan** disburse tanpa kontrol empat-mata.

**Rekomendasi:** pisahkan permission, atau minimal flag di audit log kalau approver = disburser.

### 9. `employee-loan`: create tanpa validasi, dampak langsung ke payroll

**File:** `employee-loan.controller.ts` / `.repository.ts`
```ts
const employeeId = req.body.employeeId;       // bukan dari token
const loan = await employeeLoanRepository.create({ amount, installmentAmount, ... }); // zero validasi vs LoanType
```
Karena loan installment otomatis dipotong tiap payroll run, bug ini punya **dampak finansial langsung**: bisa bikin pinjaman fiktif atas nama karyawan lain, atau amount/installment tidak proporsional.

**Rekomendasi:** validasi `amount`/`tenor` terhadap `LoanType.maxAmount`/`maxTenor`; `employeeId` self-service harus dari `req.user.employeeId`.

### 10. Attendance check-in tidak validasi kepemilikan `employeeId`

**File:** `attendance.controller.ts` → `create()` — `req.body.employeeId` sepenuhnya dari client. Kalau role self-service punya `attendance:create`, satu karyawan bisa absen atas nama karyawan lain (termasuk spoof GPS).

### 11. Leave, permission-request, travel-expense: pola `employeeId`/`companyId` client-controlled di endpoint admin

Bagian self-service di modul-modul ini sudah cukup benar (`create`, `findMy*` pakai `req.user`), tapi endpoint admin (`findAll`, `findById`, `approve`, `reject`) masih ikut pola lama. Tidak ada juga pencegahan **self-approval** (user approve pengajuannya sendiri) di `permission-request` dan `travel-expense`.

### 12. Access & refresh token disimpan di `localStorage` (frontend)

**File:** `frontend/src/services/api.ts`, `auth.service.ts`

Refresh token rotation + family tracking di backend percuma kalau token disimpan di `localStorage` — satu celah XSS bisa curi access & refresh token sekaligus.

**Rekomendasi:** pindahkan refresh token ke **httpOnly cookie**.

---

## 🟡 MINOR — Hardening & Secure Coding

### 13. `generateRandomPassword()` pakai `Math.random()`, bukan CSPRNG
`backend/src/shared/security/PasswordHandler.ts` — ganti ke `crypto.randomInt`/`randomBytes` sebelum dipakai di fitur reset password/invite.

### 14. CSV export rawan formula injection
`employee.service.ts` → `exportCsv()` — field yang diawali `=`, `+`, `-`, `@` tidak di-sanitize, berisiko formula injection kalau dibuka di Excel/Sheets. Prefix dengan `'`.

### 15. `totalDays` cuti pakai hari kalender, bukan hari kerja
`leave.repository.ts` → `createLeaveRequest()` — weekend/holiday ikut terhitung. Modul `work-calendar` sudah ada tapi tidak dipakai di sini.

### 16. `SalaryComponent.calculationMethod: 'FORMULA'` dideklarasikan tapi tidak diimplementasi
Janji fleksibilitas yang tidak dipenuhi — kalau dipilih di UI, diam-diam tidak ngapa-ngapain. Drop dulu opsi ini atau tandai "coming soon".

### 17. `CompanySetting`, `GroupSetting`, `GroupPolicy` — table sudah ada di schema, 0% dipakai
Fondasi database untuk fitur "Company Settings" (toggle policy per modul, termasuk potongan telat/absen dari diskusi sebelumnya) sudah ada tapi tidak ada satupun service/controller yang menyentuhnya.

**Rekomendasi arsitektur:**
- Setting simpel satu-nilai (currency, fiscal year start, feature toggle) → pakai `CompanySetting` key-value.
- Policy dengan beberapa field terkait & butuh validasi (misal potongan telat: rate/menit, cap maksimal, grace period, toggle aktif) → tabel dedicated baru (pola sama seperti `BranchAttendancePolicy` yang sudah benar), **bukan** dipaksa jadi JSON string di kolom `value`.
- Taruh UI-nya di menu **Organization → Company → Settings**, konsisten dengan pola `BranchAttendancePolicy` yang sudah dikelola lewat modul `organization`.

### 18. Housekeeping code quality
- 6 file masih pakai `console.log` — konsistenkan ke Winston logger.
- 36 penggunaan `: any` — bersihkan agar strict typing TypeScript maksimal.
- Test coverage kuat di business logic numerik (payroll, leave accrual, overtime, depreciation), tapi nol test untuk auth flow, controller, atau middleware (authorize, company scope) — padahal ini paling kritikal untuk regression setelah temuan di atas dibenahi.

### 19. `BranchAttendancePolicy` wajib diisi per-branch, tidak ada default company-level
Untuk company kecil/menengah tanpa kebutuhan differensiasi per cabang, ini nambah friction operasional yang tidak perlu. Tambahkan default kebijakan di level company, override per-branch jadi opsional.

---

## 🟢 Optimasi & pola yang sudah baik (jangan hilang saat refactor)

- **`SELECT ... FOR UPDATE`** di `approveLeave()` — row-level lock yang benar untuk cegah race condition saldo cuti; query raw-nya parameterized (aman dari SQL injection).
- **`assignToUser`** di RBAC sudah dioptimasi hindari N+1 query (ada jejak refactor performa di komentar kode).
- **Password hashing Argon2id** dengan migrasi otomatis dari bcrypt legacy + auto-rehash.
- **JWT** access/refresh terpisah secret, refresh token pakai token family untuk deteksi reuse/rotation attack.
- **Upload file** divalidasi pakai magic bytes (`file-type`), bukan Content-Type dari client; file yang direject langsung dihapus dari disk.
- **`notification` module** — WHERE clause di level query selalu include `userId`, jadi aman walau `id` dari client bisa ditebak. **Contoh terbaik di codebase ini, jadikan template.**
- **`permission-request`** bagian self-service — `employeeId` diturunkan dari `req.user`/DB lookup, bukan dari body.
- **CSV import employee** — validasi semua baris dulu, insert all-or-nothing dalam transaction, deteksi duplikat NIK/email dalam file.
- **Workflow engine** — step approval cuma bisa dieksekusi oleh approver yang ditunjuk di step aktif (by userId atau role spesifik), bukan permission generik flat.
- Engine **BPJS, PPh21, THR, lembur** — sesuai regulasi Indonesia (Permenaker 6/2016, UU Ketenagakerjaan Ps. 78, PP 35/2021), bukan hardcode flat-rate.
- TypeScript `strict: true`; tidak ada `eval`/`queryRawUnsafe`/raw SQL yang rawan injection di seluruh backend.
- Audit log pakai **hash-chain anti-tamper** dengan endpoint verifikasi integritas + PII masking otomatis sebelum simpan — level enterprise yang jarang ditemukan di draft awal.

---

## Kesesuaian Alur vs GreatDay HR

Berdasarkan riset fitur publik GreatDay HR (kompetitor HRIS lokal terbesar), ada beberapa pola alur yang relevan untuk disamakan:

1. **Overtime & leave otomatis masuk payslip.** GreatDay eksplisit menjadikan ini nilai jual: *"smart system will automatically calculate all overtime earnings and leave deductions... All earnings and deductions will also be detailed on payslip."* → langsung memvalidasi temuan **#6** di atas sebagai gap prioritas tinggi, bukan cuma opini internal.

2. **"Attendance Interface" sebagai langkah review sebelum payroll final.** Payroll V2 GreatDay punya menu ringkasan attendance (summary per cut-off period) dengan fungsi **edit & reprocess** sebelum payroll dikunci — bukan proses black-box langsung dari attendance mentah ke payslip. Sistem ini saat ini cuma punya `calculatePayroll()` satu langkah tanpa tahap review/edit summary. **Rekomendasi:** tambahkan tahap "Attendance Summary Review" (editable) di antara periode absensi ditutup dan payroll run dieksekusi — sekalian jadi tempat natural untuk menampilkan hasil overtime/leave/late-deduction sebelum di-lock.

3. **Approval flow yang fleksibel & bisa dikustomisasi per company.** GreatDay Enterprise punya menu khusus untuk bikin approval flow baru per perusahaan. Modul `workflow-engine` di sistem ini sudah punya fondasi yang tepat untuk ini (step-based approver by user/role) — tinggal dipakai konsisten di leave/payroll/travel-expense (saat ini payroll masih pakai permission flat `payroll:approve`, bukan lewat workflow engine).

4. **Superadmin bisa customize leave type & balance policy per company** — ini sudah match dengan model `LeaveType` yang ada di sistem ini, jadi tidak perlu perubahan besar, cuma pastikan UI-nya accessible dari company settings (poin #17).

5. **Notifikasi approval real-time** — modul `notification` di sistem ini sudah scoped dengan benar (lihat bagian optimasi), tinggal dipastikan setiap event approval (leave/overtime/loan/travel) memicu notifikasi, konsisten dengan pola GreatDay "notifikasi ke supervisor begitu ada pengajuan baru."

> Catatan jujur: saya tidak punya akses ke kode internal GreatDay HR — poin di atas berdasarkan riset materi publik/marketing mereka, bukan reverse-engineering produk asli. Ini dipakai sebagai referensi arah UX/alur, bukan spesifikasi teknis pasti.

---

## Urutan Prioritas Perbaikan (gabungan seluruh sesi review)

1. **#1** — Privilege escalation RBAC (paling parah, bisa bypass semua kontrol lain)
2. **#3** — Bangun layer company-scoping terpusat (Prisma middleware/extension), menyelesaikan #3, #10, #11 sekaligus
3. **#4** — `findMyPayslips` (gampang dieksploitasi, sangat sensitif)
4. **#5** — Ownership check di 7 sub-entity employee
5. **#2** — Sambungkan `auditLog()` middleware ke endpoint sensitif
6. **#6** — Sambungkan overtime & attendance ke payroll run (juga relevan untuk kesesuaian alur GreatDay)
7. **#9** — Validasi employee-loan (dampak finansial langsung)
8. **#7 / #17** — Bangun Company Settings + fitur potong gaji telat/absen
9. Sisanya (#8, #12–#19) — hardening & polish bertahap

---

*Dokumen ini adalah hasil static code review manual, bukan automated security scan / penetration test. Disarankan tetap melakukan pengujian keamanan formal (SAST/DAST + manual pentest) sebelum go-live, terutama untuk memverifikasi tidak ada temuan lain yang terlewat.*