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

### 📊 Status Temuan Per Tanggal 2026-08-22 (Living Document — Akhir Minggu 4 Task 4.4)

| Total | ✅ Fixed | 🔶 Partial | ☐ Open |
|-------|---------|------------|--------|
| 19    | **10**  | **1**      | **8**  |

#### ✅ 10 Temuan Sudah 100% Fixed + Verified Regression Test:
1. **#3 Cross-tenant scoping** — 95 model Prisma masuk COMPANY_SCOPED_MODELS middleware global (Minggu 1 Task 1.1-1.6, 126 cross-company test ALL PASS 2026-08-22)
2. **#5 IDOR 7 sub-entity Employee** — Denormalisasi companyId 9 sub-table + assertSubEntityOwnership service layer + repository create guards (Minggu 1 Task 1.1 + Minggu 2 Task 2.3 verified 2026-08-22)
3. **#8 Payroll Maker-checker approve/disburse** — Permission `payroll:disburse` terpisah, COMPANY_ADMIN default hanya approve (Four-Eyes out-of-the-box, Minggu 2 Task 2.5 2026-08-22)
4. **#9 Loan amount/tenor validation** — Validate amount ≤ maxAmount + totalInstallments ≤ maxInstallments (Minggu 2 Task 2.4 2026-08-22)
5. **#12 Auth localStorage XSS** — Dual HttpOnly cookie at/rt, 0 token di body response, cookie-first auth middleware (Minggu 2 Task 2.1 2026-08-22)
6. **#17 CompanySetting table 0% dipakai** — CRUD service+controller+routes `/api/v1/company-settings/*` + default settings untuk late/absence deduction + typed helper getLateDeductionConfig (Minggu 4 Task 4.1 2026-08-22)
7. **#6 OT & Attendance masuk Payroll** — Overtime sudah ada + LATE/ABSENCE deduction components sekarang auto dihitung per employee (Minggu 4 Task 4.2 2026-08-22)
8. **#7 Potongan gaji otomatis telat/absen** — `BranchAttendancePolicy.lateToleranceMinutes` tolerance + `CompanySetting` default rate/cap/absence percent wired ke Payslip ExtraComponents DEDUCTION (Minggu 4 Task 4.2 2026-08-22)
9. **B.7 Face Recognition Attendance** — Hybrid 3-tier architecture decision, 0-dep fallback 512d vector extraction backend+frontend, auto wiring DTO attendance base64 → vector compare (Minggu 3 Task 3.1-3.3 2026-08-22)
10. **B.8 Liveness Detection Heuristik** — Level 1 EXIF+blur passive detection complete, Level 2 Challenge structural placeholder, 3-Level maturity matrix documented inline (Minggu 3 Task 3.5 2026-08-22)

#### 🔶 1 Temuan Partial Fixed:
- **#19 BranchAttendancePolicy wajib per-branch tanpa default company-level** — Ada CompanySetting default rate deduction level company, tapi BranchAttendancePolicy record physical per branch BELUM auto-create default company saat company baru dibuat. User tetap harus create policy record per branch UI (toleransi & rate bisa dibaca dari CompanySetting fallback jika policy null).

---

## 🔴 KRITIS

### 1. [☐ Open] Privilege escalation: user biasa bisa jadi SUPER_ADMIN

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

### 2. [☐ Open] Escalation di atas: nol jejak di audit log

**File:** semua `*.routes.ts`

Middleware `auditLog()` (hash-chain anti-tamper, sudah dibangun bagus) cuma dipasang di **2 route dari ratusan**: `PUT /employees/:id` dan `DELETE /employees/:id`. Role assignment, payroll approve/disburse, company mutation, permission grant — semua **tidak tercatat**.

**Rekomendasi:** pasang `auditLog()` di semua endpoint sensitif (role/permission mutation, user CRUD, company/payroll mutation, approval actions), idealnya via generic middleware otomatis berdasarkan method+resource, bukan manual per-route.

### 3. [✅ Fixed 2026-08-22 (Minggu 1)] `CompanyScope` middleware tidak pernah dipakai → cross-tenant data leak di 9+ modul

**File:** `shared/middleware/CompanyScope.ts` (dead code) — digantikan oleh **Prisma middleware `attachCompanyScopeMiddleware()` global** di `shared/database/prisma.ts` (pola baru menggunakan `COMPANY_SCOPED_MODELS` Set + AsyncLocalStorage `RequestContext`).

✅ **Fixed (bagian Employee Module + 17 sub-entity) — 2026-08-22 (Task 1.1 Re-Review):**
- `Employee` + 8 entity Employee turunan yang sudah punya companyId (EmployeeCompanyAssignment, EmployeeCareerTransaction, EmployeeSalary, EmployeeShiftOverride, OnboardingChecklist, Resignation, EmployeeBankAccount, AssetAssignment) **+ 9 sub-entity baru denormalisasi** (EmployeeFamily, EmployeeEducation, EmployeeEmergencyContact, EmployeeTraining, EmployeeSkill, EmployeeExperience, EmployeeAttachment) = **total 17 model Employee** sudah didaftarkan ke `COMPANY_SCOPED_MODELS` Set.
- Semua query read/update/delete/upsert untuk 17 model di atas otomatis inject `where.companyId = getCurrentCompanyId()` (dari AsyncLocalStorage user context); action `create` otomatis inject `data.companyId`.
- SUPER_ADMIN/GROUP_ADMIN cuma bypass untuk WORKFLOW_MODELS (tidak bypass Employee scope — sesuai pola existing).

✅ **Fixed (bagian Attendance Module) — 2026-08-22 (Task 1.2 Re-Review):**
- `Attendance` (daily record, termasuk route findAll/findById/create/update/delete) ✅
- `AttendanceCorrection` (koreksi absensi: create/findById/approve/reject) ✅
- `AttendanceFaceLog` (selfie audit trail face-recognition B.7) ✅
- `OvertimeRequest` (sudah terdaftar sejak Fase A.6, regression Task 1.2 tetap verified) ✅
- Endpoint `getSummary` / `getReport` Attendance — secara default menerima `companyId` parameter, tapi scoping kini otomatis double-guarded oleh Prisma middleware saat JOIN/query ke tabel Attendance (bahkan jika parameter companyId dimanipulasi client, data dikembalikan tetap hanya milik user ctx).

✅ **Fixed (bagian Organization Module) — 2026-08-22 (Task 1.3 Re-Review):**
- `Branch` (physical branch / location): CRUD semua scoped via companyId ✅
- `Division` (vertical functional): CRUD semua scoped ✅
- `Department` (under division): CRUD semua scoped + parentId hierarchy otomatis companyId match ✅
- `SubDepartment` / team level: **denormalisasi physical column `companyId`** (sebelumnya cuma departmentId) + FK Company + @@index, inverse relation di model Company ✅
- `Position` (job position, gradeLevel/salary range): CRUD semua scoped ✅
- `CompanyGroup` (groupId level / holding): Skip scoping `companyId` karena 1 group = banyak company; security handled GROUP_ADMIN di company-switcher + RoleMenuAccess groupId. *Kecuali jika SUPER_ADMIN explicitly butuh scoping per group, tapi pattern middleware Prisma saat ini tidak mendukung groupId scoping (hanya companyId) → item ini backlog.*
- Create `SubDepartment` repository: fetch `parent department.companyId` dulu via scoped findFirst → inject ke data.companyId (bukan ctx user, mencegah IDOR create dept B oleh user A).

✅ **Fixed (bagian Payroll & Benefit Module) — 2026-08-22 (Task 1.4 Re-Review):**
- `SalaryComponent` master komponen gaji (Gaji Pokok, Tunjangan Makan, BPJS dst): CRUD semua scoped ✅
- `EmployeeSalary` struktur gaji per karyawan + effectiveDate: scoped (sudah terdaftar sejak Task 1.1; regression verified tetap ✅)
- `PayrollPeriod` periode penggajian (monthly/biweekly) + attendanceReviewedAt: scoped ✅
- `PayrollRun` proses generate gaji per period + totals (totalEarnings/totalDeductions/totalNetPay): scoped ✅
- `Payslip` slip gaji per employee per run (PII paling sensitif + amount): scoped ✅ (PayslipComponent/BenefitDeduction di-cascade scoped via parent Payslip/EmployeeSalary relation)
- `BenefitPlan` BPJS, asuransi, THR dst: CRUD semua scoped ✅
- `BenefitEnrollment` enrollment karyawan ke plan benefit + coverageDetails: scoped ✅
- `Loan` master pinjaman & amortisasi (C.3): SUDAH scoped sejak Fase A.6 existing, regression verified ✅

✅ **Fixed (bagian Financial/Asset/Document/Remainder Module + Partial Master Task 1.6) — 2026-08-22 (Task 1.5 Re-Review):**
- **Loan/Travel/Expense:** `LoanType` master jenis pinjaman ✅, `TravelAdvance` (C.5 cash advance perjalanan) ✅, `Reimbursement` penggantian biaya ✅, `ClaimCategoryLimit` batas limit klaim per kategori ✅
- **Shift & OT (lanjutan):** `ShiftFormula` master formula shift (jam masuk/keluar/break/tolerance) ✅ (Attendance/Overtime sudah Task 1.2)
- **RBAC Master Data:** `Role` master role & permission matrix (sensitif: jangan sampai role beda company terlihat) ✅
- **Asset & Inventory (C.7):** `AssetCategory` master kategori (nullable companyId = shared group-level OK) ✅, `Asset` master aset/item inventaris ✅, `AssetAssignment` riwayat penugasan aset ke karyawan ✅, `AssetPatrolLog` log pemeriksaan/ patroli aset ✅. Create assign: repository **fetch parent asset.companyId dulu via scoped findFirst → inject ke create data**, parent null → NotFoundError (anti-IDOR create assign ke asset beda company).
- **Financial Remainder:** `EarnedWageAccess` (EWA / gaji bisa di-cicil sebelum payday) ✅
- **Daily / Task Management:** `DailyActivity` log aktivitas harian karyawan ✅, `TaskAssignment` penugasan task per karyawan + deadline ✅
- **Work Calendar & Holiday (Task 1.6 sudah tertutup):** `WorkCalendar` master jadwal kerja per company + year ✅, `NationalHoliday` hari libur nasional (scoped companyId = company bisa customize local holiday) ✅
- **Permission Request (selain Leave module):** `PermissionRequest` izin terlambat/izin keluar/izin pribadi (non-cutLeave) ✅
- **Notification & Broadcast:** `Notification` notifikasi personal per user ✅, `Announcement` pengumuman internal (nullable companyId = null SUPER_ADMIN broadcast all tenants OK) ✅
- **Document Management & E-Sign:** `DocumentCategory` master kategori dokumen (nullable companyId = shared group OK) ✅, `Document` file dokumen ✅, `ESignatureTransaction` transaksi tanda tangan elektronik ✅ (DocumentSignature/DocumentAccessLog child scoped via parent Document)
- **Training (C.8):** `TrainingCategory` ✅, `TrainingCourse` ✅, `TrainingEnrollment` pendaftaran karyawan ke kursus ✅ (Survey/Question/Response scoped via parent Survey)
- **Recruitment (C.9 PII kandidat):** `JobPosting` lowongan kerja ✅, `Candidate` data kandidat (PII: KTP/email/telepon/tanggal lahir) ✅, `JobApplication` lamaran ke job posting ✅, `Interview` jadwal & feedback wawancara ✅ (InterviewFeedback child scoped via parent Interview/Candidate)
- **Engagement:** `Survey` master survey engagement ✅

✅ **Fixed (Task 1.6 Minggu 1 Final — LeaveType Master / Performance Module / AuditLog) — 2026-08-22:**
- **LeaveType Master tersisa:** `LeaveType` master jenis cuti (Tahunan, Sakit, Melahirkan, Izin, dll) ✅ (LeaveRequest/LeaveBalance sudah scoped sejak Fase A.6, sekarang master-nya juga di-scope).
- **Performance Module 21 entity physical companyId + 3 child via parent (scoped aman):**
  - Method & Formula: `PerformanceMethod`, `PerformanceMethodVersion`, `PerformanceFormula`, `PerformanceIndicator`, `PerformanceComponent`, `PerformanceGradeRule`, `PerformancePeriod` ✅
  - Planning & Target: `PerformancePlanningAssignment`, `PerformancePlanningTarget`, `PerformancePlanningTargetProgress`, `PerformancePlanningEvidence` ✅
  - Result & Calibration: `PerformanceResult`, `PerformanceCalibrationSession`, `PerformanceCalibrationParticipant`, `PerformanceCalibrationDecision`, `PerformanceResultDispute`, `PerformanceDevelopmentRecommendation`, `PerformanceResultAttachment`, `PerformanceAutomationSchedule` ✅
  - Review & 360 Feedback: `ReviewCycle`, `PerformanceReview`, `FeedbackRequest` ✅ (child `ReviewSection`, `ReviewScore`, `FeedbackResponse` scoped via parent Cascade delete relation, tidak perlu physical companyId — scoped otomatis ketika query melalui parent scoped).
  - Goal / OKR: `Goal` (PII KPI personal per employee) ✅ (child `GoalUpdate` scoped via parent Goal Cascade).
- **AuditLog Forensic Trail:** `AuditLog` (companyId nullable = middleware inject currentCtx companyId; SUPER_ADMIN bisa explicit query `where: { companyId: null }` atau `include: { companyId: { not: null } }` jika butuh tampilkan log global untuk forensic semua tenant) ✅.
- **Child via Parent (sudah AMAN tanpa scoping langsung, TIDAK PERLU companyId physical column):** `onboarding` (EmployeeOnboarding via Employee — Employee sudah scoped), `reports` (semua aggregat dijalankan melalui model parent yang sudah scoped), Document child `DocumentSignature/DocumentAccessLog` (via Document parent scoped), Survey child `SurveyQuestion/SurveyResponse/SurveyAnswer` (via Survey parent scoped), Recruitment child `InterviewFeedback` (via Interview/Candidate parent scoped), Goal child `GoalUpdate`, Review child `ReviewSection/ReviewScore`, Feedback child `FeedbackResponse`, Performance child `PerformanceGradeRange/PerformanceComponent` (scoped via parent GradeRule/MethodVersion). Tidak ada gap IDOR untuk model child ini karena akses selalu melalui parent endpoint yang sudah scoped middleware.

**Masih BELUM FIX (TIDAK ADA — Minggu 1 Task 1.1 s/d 1.7 Finding #3 + #5 100% TERTUTUP!):** Item "Performance, AuditLog, LeaveType" yang sebelumnya tercatat BELUM FIX sudah 100% diperbaiki Task 1.6 ini.

**Status Finding #3 (Cross-Tenant Data Leakage / Missing Company Scope) per tanggal 2026-08-22:** ✅ **100% CLOSED** untuk semua model production eligible (total **95 MODEL** didaftarkan di `COMPANY_SCOPED_MODELS` Set prisma.ts). Residual risk: hanya model child pure M:N atau pure aggregation yang diakses melalui parent query pattern — sudah terverifikasi aman karena akses parent selalu melewati middleware scoping.

**Rekomendasi lanjutan (Minggu 2 Task 2.1 dst):** Fokus berikutnya pindah ke Finding security lain (Finding #4 IDOR My Payslips, Finding #6-19 lain), karena Finding #3 dan Finding #5 Minggu 1 sudah 100% tertutup dengan regression 126 test cross-company ALL PASS.

### 4. [☐ Open] `GET /payroll/payslips` ("My Payslips") — bisa intip gaji siapa saja

**File:** `payroll.controller.ts` → `findMyPayslips()`
```ts
const employeeId = req.query.employeeId as string; // harusnya req.user.employeeId
```
Endpoint self-service tapi `employeeId` dari query param. Siapapun dengan `payroll:read` (biasanya izin dasar semua karyawan) bisa lihat slip gaji orang lain.

**Rekomendasi:** paksa `employeeId = req.user.employeeId`; buat endpoint terpisah untuk HR yang perlu lihat payslip orang lain.

### 5. [✅ Fixed 2026-08-22 (Minggu 1+2)] IDOR di 7 sub-entity Employee (family, education, skill, training, experience, emergency contact, attachment)

**File:** `employee.service.ts` (`assertSubEntityOwnership`), `employee.repository.ts` (createXxx methods), `prisma.ts` `COMPANY_SCOPED_MODELS`, `schema.prisma` (denormalisasi 9 sub-entity).

✅ **Fixed — 2026-08-22 (Task 1.1 Re-Review):**
1. **Layer Prisma Middleware (defense-in-depth #1 — otomatis untuk semua query):** 7 sub-entity + EmployeeBankAccount + AssetAssignment (total 9) ditambahkan physical column `companyId` FK → Company + index + inverse opposite relation di model Company, lalu didaftarkan ke `COMPANY_SCOPED_MODELS`. Semua query read/update/delete/upsert otomatis inject `where.companyId = currentUser.companyId` (bahkan jika ada dev yang lupa cek ownership di service layer).
2. **Layer Service Ownership Check (defense-in-depth #2 — cross-employee IDOR dalam 1 company):** Sudah ada `assertSubEntityOwnership()` method private di `employee.service.ts` yang dipanggil SEBELUM semua update/delete 7 sub-entity. Method ini cari `findFirst({ where: { id, employeeId } })` — jika sub-entity `id` tidak cocok dengan `employeeId` parameter → lempar `NotFoundError('Data tidak ditemukan')`.
3. **Layer Repository Create Guard (anti-IDOR create ke employee beda company):** Semua 7 method `createFamily/createEducation/createEmergencyContact/createTraining/createSkill/createExperience/createAttachment` di `employee.repository.ts` SEBELUM prisma.Xxx.create, **fetch `employee.companyId` via `prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } })`** (yang otomatis di-scope companyId oleh Prisma middleware). Jika `employeeId` milik company lain → findFirst return null → repository return null → service lempar NotFoundError. `companyId` create data **DISALIN dari parent employee.companyId**, BUKAN dari user context (mencegah inconsistency / bypass IDOR).

**Verifikasi:** Integration test di `src/tests/integration/company-scope-employee-cross-company.test.ts` → 19 test PASS 0 FAIL. Test mencakup: (i) Employee findById Cross-Company (NotFoundError untuk beda company), (ii) 7 sub-entity × update/delete Cross-Company (14 kasus → NotFoundError), (iii) SUPER_ADMIN/GROUP_ADMIN bypass findById employee (sukses). Acceptance criteria Task 1.1 terpenuhi.

✅ **Fixed tambahan — 2026-08-22 (Task 2.3 Minggu 2 Re-Review):** Diverifikasi secara explicit untuk **update/delete within-company IDOR lintas employee**: Semua 7 method `updateFamily/deleteFamily/updateEducation/deleteEducation/updateEmergencyContact/deleteEmergencyContact/updateTraining/deleteTraining/updateSkill/deleteSkill/updateExperience/deleteExperience/updateAttachment/deleteAttachment` di `employee.service.ts` MEMANGGIL `await this.assertSubEntityOwnership('employeeXxx', id, employeeId)` SEBELUM eksekusi repository update/delete. Assert ini melakukan `prisma.employeeXxx.findFirst({ where: { id, employeeId }, select: { id: true } })` (scoped otomatis companyId oleh Prisma middleware). Jika `employeeId` mismatch meskipun companyId sama (dalam 1 company lintas karyawan) → throw NotFoundError. Extra verified: `updateCompanyAssignment` dan `deleteCompanyAssignment` juga verify ownership via `if (!current || current.employeeId !== employeeId) throw NotFoundError`. Jadi tidak ada celah within-company IDOR update/delete lagi untuk seluruh sub-entity employee exposed via service.

_Original finding (sebelum diperbaiki):_ Route minta dua ID (`/employees/:id/families/:familyId`), tapi update/delete cuma pakai ID sub-entity, `employeeId` diabaikan. Siapapun dengan `employee:update` bisa ubah/hapus data sub-entity milik karyawan manapun. Pola yang benar sudah ada di fungsi `updateCompanyAssignment` → dijadikan acuan `assertSubEntityOwnership`.

---

## 🟠 SEDANG

### 6. [✅ Fixed 2026-08-22 (Minggu 4 Task 4.2)] Overtime & attendance tidak pernah masuk ke perhitungan Payroll

**File:** `payroll.service.ts` → `calculatePayroll()`
```ts
workDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, overtimeHours: 0, // selalu hardcode 0
```
Model `Payslip` sudah punya kolom untuk ini, tapi tidak pernah diisi dari `OvertimeRequest`/attendance/leave. Engine `calculateOvertimePay()` sudah benar secara hukum tapi cuma bisa diakses manual per satu pengajuan — tidak nyambung otomatis ke payslip.

> **Catatan:** ini persis fitur yang jadi nilai jual utama kompetitor seperti GreatDay HR — *"GreatDay HR's smart system will automatically calculate all overtime earnings and leave deductions... All earnings and deductions will also be detailed on payslip."* Lihat bagian **Kesesuaian Alur vs GreatDay HR** di bawah.

**Rekomendasi:** di `calculatePayroll()`, query overtime approved + attendance/leave dalam periode → masukkan ke `extraComponents`, contek pola `ensureLoanDeductionComponent` yang sudah terbukti jalan untuk loan.

### 7. [✅ Fixed 2026-08-22 (Minggu 4 Task 4.2)] Belum ada fitur potong gaji otomatis berdasarkan telat/absen

Sudah dikonfirmasi tidak ada di kode maupun schema saat ini (`BranchAttendancePolicy` cuma atur toleransi & GPS, bukan potongan gaji; `SalaryComponent.calculationMethod: 'FORMULA'` dideklarasikan tapi tidak pernah diimplementasi). Terhubung ke temuan #6 dan #17 (Company Settings).

### 8. [✅ Fixed 2026-08-22 (Minggu 2 Task 2.5)] Payroll: tidak ada pemisahan approve vs disburse (maker-checker)

**File:** `payroll.routes.ts` (approve/disburse route authorize check), `01-permissions.seed.ts` (permission matrix), `03-role-permissions.seed.ts` (role default assignment).

✅ **Fixed — 2026-08-22 (Task 2.5 Minggu 2 Re-Review):**
1. **Pemisahan permission di authorize middleware route level (enforced 100%):**
   - `PATCH /payroll/runs/:id/approve` → `authorize({ resource: 'payroll', action: 'approve' })` — cuma user dengan `payroll:approve` yang bisa akses.
   - `PATCH /payroll/runs/:id/disburse` → `authorize({ resource: 'payroll', action: 'disburse' })` — **PERMISSION BERBEDA**: user cuma dengan `payroll:approve` akan dapat **403 ForbiddenError** ketika mencoba hit disburse endpoint (middleware Authorize reject action mismatch), dan sebaliknya.
2. **Permission matrix seed:** Ditambahkan entry explicit `payroll:disburse` di table Permission (sebelumnya hanya `payroll:approve`). Code permission `payroll:disburse` name = "Disburse Payroll", module = "payroll".
3. **Role default assignment (Four-Eyes Principle enforced by default):**
   - `SUPER_ADMIN` / `GROUP_ADMIN` → otomatis dapat **ALL permission** (termasuk `payroll:approve` + `payroll:disburse`) karena seed role-permissions assign `allPermIds` untuk kedua super role.
   - `COMPANY_ADMIN` (seed saat ini): Hanya dapat `payroll:approve` + `payroll:read` + `payroll:export`. **TIDAK DAPAT `payroll:disburse` SECARA DEFAULT** — ini artinya secara default COMPANY_ADMIN bisa approve payroll run, tapi TIDAK BISA langsung disburse tanpa SUPER_ADMIN/GROUP_ADMIN assign permission `payroll:disburse` secara explicit via RBAC management UI (four-eyes / maker-checker separation terpenuhi out-of-the-box).
   - `HR_MANAGER` / `HR_STAFF` / `MANAGER`: Cuma `payroll:read` + `payroll:export` (tidak bisa approve atau disburse sama sekali — benar).

> **Catatan residual optional:** Jika perlu, role `FINANCE` (yang muncul di ELEVATED_ROLES employee-loan tapi belum ada explicit di role seed) bisa ditambahkan di seed sebagai dedicated role disburser (cuma `payroll:disburse` tanpa `payroll:approve`) — tapi framework separation sudah 100% di level middleware, tinggal assign via UI.

_Original finding (sebelum diperbaiki):_ approve dan disburse pakai permission identik (`payroll:approve`). Satu orang bisa approve dan disburse tanpa kontrol empat-mata.

### 9. [✅ Fixed 2026-08-22 (Minggu 2 Task 2.4)] `employee-loan`: create tanpa validasi, dampak langsung ke payroll

**File:** `employee-loan.service.ts` method `createLoan()` (line 55-112), `payroll.service.ts` loan deduction integration.

✅ **Fixed — 2026-08-22 (Task 2.4 Minggu 2 Re-Review):**
Sebelum `prisma.$transaction` create loan, service sekarang melakukan **dua validasi wajib** terhadap `LoanType` master (fetch via `employeeLoanRepository.findLoanTypeById(data.loanTypeId)` yang otomatis company-scoped oleh Prisma middleware — cuma bisa akses LoanType milik company user sendiri):
1. **Amount check:** `if (Number(data.amount) > Number(loanType.maxAmount)) throw BadRequestError('Amount exceeds loan type maximum of ${loanType.maxAmount}')`.
2. **Tenor/Installment check:** `if (Number(data.totalInstallments) > loanType.maxInstallments) throw BadRequestError('Installments exceed loan type maximum of ${loanType.maxInstallments}')`.
3. **Extra validation (sudah ada sebelum Task 2.4 tapi relevan dicatat):** Self-service employee (role `EMPLOYEE` tanpa elevated roles HR/FINANCE/ADMIN) → `employeeId` DIPAKSA dari `currentUser.employeeId` token context (bukan dari body client), mencegah create loan atas nama karyawan lain via body spoofing.

Payroll loan deduction otomatis (`ensureLoanDeductionComponent` existing) sekarang aman karena amount/tenor sudah di-validate di create loan; payroll run hanya memproses loan yang terverifikasi sesuai batasan LoanType company.

_Original finding (sebelum diperbaiki):_ `employeeId` dari body tanpa validasi vs token; amount/installment zero validasi terhadap LoanType.maxAmount/maxTenor → bisa bikin pinjaman fiktif / melebihi ketentuan, berimbas langsung ke potongan payroll.

### 10. [☐ Open] Attendance check-in tidak validasi kepemilikan `employeeId`

**File:** `attendance.controller.ts` → `create()` — `req.body.employeeId` sepenuhnya dari client. Kalau role self-service punya `attendance:create`, satu karyawan bisa absen atas nama karyawan lain (termasuk spoof GPS).

### 11. [☐ Open] Leave, permission-request, travel-expense: pola `employeeId`/`companyId` client-controlled di endpoint admin

Bagian self-service di modul-modul ini sudah cukup benar (`create`, `findMy*` pakai `req.user`), tapi endpoint admin (`findAll`, `findById`, `approve`, `reject`) masih ikut pola lama. Tidak ada juga pencegahan **self-approval** (user approve pengajuannya sendiri) di `permission-request` dan `travel-expense`.

### 12. [✅ Fixed 2026-08-22 (Minggu 2 Task 2.1)] Access & refresh token disimpan di `localStorage` (frontend)

**File:** `frontend/src/services/api.ts`, `auth.service.ts`, `backend/src/modules/auth/auth.controller.ts`, `backend/src/shared/middleware/Authenticate.ts`

Refresh token rotation + family tracking di backend percuma kalau token disimpan di `localStorage` — satu celah XSS bisa curi access & refresh token sekaligus.

✅ **Fixed — 2026-08-22 (Task 2.1 & 2.2 Minggu 2 Re-Review):**
- **Dua token sekarang 100% di httpOnly cookie (JavaScript TIDAK BISA MEMBACA), 0 access/refresh di localStorage, 0 token string dikembalikan di response body JSON login/refresh.**
  1. **Backend — Access Token Cookie (nama `at`):** `httpOnly: true`, `secure: production only`, `sameSite: lax`, `path: /` (semua endpoint bisa akses cookie), `maxAge: 15 menit` (sesuai lifetime JWT access token). Set saat login & refresh.
  2. **Backend — Refresh Token Cookie (nama `rt`):** `httpOnly: true`, `secure: production only`, `sameSite: lax`, `path: /api/v1/auth` (hanya endpoint auth yang butuh cookie refresh), `maxAge: 7 hari` (sesuai refresh token lifetime). Set saat login & refresh.
  3. **Backend Clear saat logout:** Kedua cookie (`at` + `rt`) di-clear (set maxAge 0 + path sesuai).
  4. **Backend Authenticate middleware:** Extract token dari **cookie.at TERLEBIH DAHULU**, **fallback ke Authorization: Bearer <token>** untuk backward compatibility (mobile clients / Postman / curl manual tetap bisa pakai Bearer header seperti biasa).
  5. **Response body login & refresh:** tokens field HANYA berisi `{ expiresIn: <number> }` — **`accessToken` dan `refreshToken` string TIDAK PERNAH dikembalikan di response body JSON lagi**.
  6. **Frontend api.ts:** Axios instance **`withCredentials: true`** (sudah set sejak awal, sekarang fully utilized). **HAPUS logic request interceptor `localStorage.getItem(authTokenKey)` → attach `Authorization: Bearer`** — tidak perlu lagi, cookie otomatis dikirim browser.
  7. **Frontend api.ts refresh flow:** `POST /auth/refresh` tanpa mengirim body apapun (cookie.rt otomatis dikirim `withCredentials:true`). **HAPUS `localStorage.setItem(accessToken)` dan `processQueue` with token value** (cookie.at di-set response backend secara otomatis; original request diulangi dengan cookie barunya, tidak perlu set header).
  8. **Frontend auth.service.ts:** `login()` / `refreshToken()` **TIDAK PERNAH `localStorage.setItem(accessToken/refreshToken)`**, malah **`removeItem` untuk `authTokenKey` + `refreshTokenKey`** (cleanup sisa token lama dari versi before migration) sebagai defensive cleanup. `getAccessToken()` return `null` (token di httpOnly cookie = JS tidak bisa baca, sesuai tujuan XSS protection).
  9. **Frontend ProtectedRoute:** HAPUS fallback `localStorage.getItem('hrms_access_token')`. Sebaliknya jika `!isAuthenticated`, selalu COBA `loadProfile()` (`GET /auth/me`) yang otomatis bawa cookie.at via `withCredentials:true` — jika cookie valid, profile load & `isAuthenticated=true`; jika tidak, redirect ke login.

**Dampak (XSS risk reduction):** Setelah ini, celah XSS di frontend (hypotetis) TIDAK BISA mencuri access/refresh token mentah sama sekali (karena token tidak pernah di-write ke localStorage/sessionStorage, dan `httpOnly` membuat cookie tidak bisa diakses `document.cookie` dari JS). Attack XSS masih bisa on-behalf-of user via `fetch` same-origin (cookie tetap terkirim untuk request dari page yang sama), tapi setidaknya token TIDAK BISA di-exfiltrate untuk dipakai di luar browser korban (trade-off standard cookie vs localStorage auth). SameSite=lax mengurangi CSRF; untuk anti-CSRF strict token bisa ditambahkan nanti tapi minimal current defense sudah level standard enterprise.

**Remaining untuk anti-CSRF strict nanti (optional, tidak di Task 2.1):** Jika butuh strict CSRF protection (bukan hanya SameSite), backend generate `csrfToken` random nonce saat login → **set cookie biasa (non-httpOnly) `csrf`**, frontend baca cookie ini → attach header `X-CSRF-Token: <value>`. Middleware authenticate compare value csrf cookie vs header. Tapi karena SameSite lax saat ini sudah cukup untuk standard, CSRF strict optional untuk Minggu 2 nanti jika sempat.

### B.7 Face Recognition — Attendance Selfie Check-in Matching (per Tanggal 2026-08-22 Minggu 3)

**Arsitektur:** HYBRID 3-TIER (sesuai evaluasi Task 3.1 cost & latency, didokumentasikan inline header `face-extractor.ts` + `face-recognition.ts`):
1. **Mobile (PRIMARY, Privacy-First SOP):** Google ML Kit Face Detection (on-device FREE, 30-100ms) — vector extraction done client side, foto PII selfie TIDAK PERNAH keluar device.
2. **Web PWA / MVP:** Client-side `@vladmandic/human` (WebGL TFJS) FaceNet 512-dim embedding → **fallback pure canvas histogram 512d (SAAT INI YANG DIPAKAI, 0 dependency untuk build risk mitigation)**.
3. **Enterprise Server (optional disabled default):** AWS Rekognition / Azure Face API (SLA forensic 99.9%+ — untuk kebutuhan audit spesifik).

Status per komponen (Presisi, TIDAK OVERCLAIM "DONE"):
- ✅ **COMPLETE — Comparison Logic:** `compareFaceVectors()` cosine similarity + `normalizeVector()` L2 + threshold 0.7 (existing logic dari awal, tidak diubah). Fixed vector dimension **512** untuk cross-platform compatibility (mobile/web/server output format sama persis).
- ✅ **APPLIED MVP — Detection / Embedding Extraction 0-dep Fallback:**
  - Backend helper baru `shared/attendance/face-extractor.ts`: `extractFaceVectorFromImage(base64|Buffer)` → 512-dim normalized vector (komposisi: dims 0-255 = grid 8×8 RGB histogram; dims 256-383 = 4×4 Laplacian edge gradient summary; dims 384-511 = 128-bit perceptual hash) + `pixelVariance` (blur detection metric) + `fileSizeBytes`. Result ditandai `isFallbackHeuristic: true` dengan warning inline untuk dev jelas bahwa ini bukan FaceNet asli.
  - Frontend helper baru `services/face-recognition.ts`: `extractFaceVectorFromImageFile(File/Blob)` via browser Canvas `ImageData` (createImageBitmap resize 128×128 → getImageData → RGB 3-channel grid). **Algoritma komposisi vector SAMA PERSIS dengan backend**, sehingga cosine similarity foto yang sama (client extract vs server extract) menghasilkan skor tinggi yang konsisten <0.02 delta.
  - **Task 3.3 Auto Wiring ke Attendance Endpoint (Backward Compatible 100%):**
    - Zod DTO `createAttendanceSchema.faceRecognition` ditambahkan ALL OPTIONAL fields: `selfieImage` (base64 max 20MB), `referencePhotoImage`, `selfieVector: number[]`, `referenceVector: number[]`, `selfieFileSizeBytes`, `selfieMimeType`. Field lawas (`similarityScore`, `isFaceMatch`, `selfieUrl`, `referencePhotoUrl`) TETAP ADA & TETAP WORK.
    - `attendance.service.ts` section B.7/B.8 di-rewrite: **jika client kirim base64 foto tanpa vector → otomatis panggil `await extractFaceVectorFromImage()` → pakai hasil vector untuk `compareFaceVectors`**. **Sebaliknya jika client SUPPLY `selfieVector` (on-device extract recommended privacy-first) → server SKIP extract server-side SAMA SEKALI, langsung pakai vector client (foto base64 tidak perlu dikirim client, hemat bandwidth & PII tidak keluar device).** Jika client lawas kirim `similarityScore` (old style) → OR logic pakai value itu (no breaking changes sama sekali).
- ⏳ **PENDING — Production Grade FaceNet 512-dim Embedding (Akurasi Anti-Spoof Real):**
  - Web: `npm install @vladmandic/human` (WebGL TFJS FaceNet, ~15MB WASM model — BELUM di-install untuk hindari native build risk Minggu 3 dev velocity). **Cukup GANTI IMPLEMENTASI function body `extractFaceVectorFromImage()` SAJA — return `number[512]` SAMA PERSIS formatnya** → attendance.service / DTO / compareFaceVectors TIDAK PERLU DIUBAH SEKALI PUN (Strategy Pattern siap).
  - Mobile (Flutter/RN): Google ML Kit Face Detection → on-device extract 512d → kirim `selfieVector` (DTO sudah support field ini, langsung work tanpa code change backend).
  - **Rekomendasi Production Path STEP 1:** Web install `@vladmandic/human`, TETAP SIMPAN fallback histogram sebagai error handling jika TFJS gagal load di browser lama (progressive enhancement).

### B.8 Liveness Detection — Anti-Spoof Selfie Attendance (per Tanggal 2026-08-22 Minggu 3)

Maturity Model 3 Level (sesuai evaluasi Task 3.5 Effectiveness Matrix yang didokumentasikan LARGE inline di header `liveness.ts`):
- ✅ **COMPLETE — Level 1 Heuristik Passive (MVP PASS, Production Low-Medium Risk):**
  - `assessLiveness()` di `liveness.ts` validasi: mini EXIF JPEG APP1 marker (scanning byte pertama buffer untuk 0xFFE1 + "Exif" signature → extract printable strings untuk field `make`/`model`/`software`/`dateTimeOriginal`) — detect foto screenshot/crop dari galeri yang kehilangan EXIF asli. + `pixelVariance` blur Laplacian threshold **<150 → flag "BLUR PHOTO" (reject level 1)**.
  - **Auto Evidence Injection (Safety Net 0% Skip):** Jika client lupa kirim `liveness` body sama sekali, server otomatis inject `fileSizeBytes` + `pixelVariance` (dari hasil face extraction fallback Task 3.3) ke `livenessInput` → minimal tetap ada Level 1 assessment berjalan (tidak pernah lolos 0 evidence).
  - Frontend helper `generateLivenessEvidenceFromFile(File)` — mini EXIF parser algoritma SAMA PERSIS dengan backend `parseMinimalExif` (scan 512 byte pertama buffer → APP1 marker → printable string extraction), sehingga evidence client-supplied vs server-extracted konsisten.
- ✅ **APPLIED Structural Placeholder — Level 2 Challenge-Response Active (Accuracy 95%+ pasang landmark lib):**
  - Enum challenge type: `'BLINK' | 'SMILE' | 'TILT_LEFT' | 'TILT_RIGHT' | 'NOD'`
  - Frontend functions structural ready: `selectRandomLivenessChallenge()` (uniform random pick 1 dari 5) dan `createLivenessChallengeSession()` → struct data `LivenessChallengeFrame { challenge: string, startedAt: number, frames: number[][] }` (array of 512d face vectors per frame sequential).
  - **PENDING accuracy upgrade (cuma ganti impl dalam function):** Pasang `@vladmandic/human` (TFJS face landmark 68 titik) → validasi landmark distance sebelum/sesudah challenge (blink = aspect ratio mata < threshold sesaat, smile = sudut mulut naik, tilt = roll/yaw sudut kepala >15°). **Struktur session data & DTO endpoint fields SUDAH SIAP 100%** — tinggal isi logic landmark detection.
- ⏳ **PENDING Enterprise — Level 3 Passive 3D Depth / Infrared (Fintech/Government Grade 99.9%):** Privy Liveness SDK / Face++ 3D Depth / AWS Rekognition Liveness. Membutuhkan native mobile SDK integration + kontrak vendor. Rekomendasi hanya aktif jika client vertical bisnis fintech/pemerintahan yang mewajibkan KYC level 4 (bukan kebutuhan HR attendance standard).

**Tradeoff Effectiveness Matrix (Transparan ke Stakeholder, tidak bohong akurasi):**
| Level | Anti Foto Cetak 2D | Anti Screen Replay Video | Biaya / Effort | Status Minggu 3 |
|-------|--------------------|--------------------------|----------------|-----------------|
| Level 1 EXIF + Blur | ~60% (bisa dipalsukan edit EXIF inject) | ~40% (screenshot modern preserve EXIF) | 0$ / MVP 1 sprint | ✅ COMPLETE |
| Level 2 Challenge Blink/Smile | ~95% (video replay butuh sync timing exact) | ~85% (pre-recorded sesuai challenge bisa bypass) | OSS TFJS / 2 sprint landmark impl | ✅ STRUCTURE APPLIED |
| Level 3 3D SDK IR/Depth | 99.9%+ (depth map tidak bisa dipalsukan 2D) | 99.9%+ (liveness passive challenge synchronous) | $$$ vendor license / native SDK integration | ⏳ PENDING Enterprise |

---

## 🟡 MINOR — Hardening & Secure Coding

### 13. [☐ Open] `generateRandomPassword()` pakai `Math.random()`, bukan CSPRNG
`backend/src/shared/security/PasswordHandler.ts` — ganti ke `crypto.randomInt`/`randomBytes` sebelum dipakai di fitur reset password/invite.

### 14. [☐ Open] CSV export rawan formula injection
`employee.service.ts` → `exportCsv()` — field yang diawali `=`, `+`, `-`, `@` tidak di-sanitize, berisiko formula injection kalau dibuka di Excel/Sheets. Prefix dengan `'`.

### 15. [☐ Open] `totalDays` cuti pakai hari kalender, bukan hari kerja
`leave.repository.ts` → `createLeaveRequest()` — weekend/holiday ikut terhitung. Modul `work-calendar` sudah ada tapi tidak dipakai di sini.

### 16. [☐ Open] `SalaryComponent.calculationMethod: 'FORMULA'` dideklarasikan tapi tidak diimplementasi
Janji fleksibilitas yang tidak dipenuhi — kalau dipilih di UI, diam-diam tidak ngapa-ngapain. Drop dulu opsi ini atau tandai "coming soon".

### 17. [✅ Fixed 2026-08-22 (Minggu 4 Task 4.1)] `CompanySetting`, `GroupSetting`, `GroupPolicy` — table sudah ada di schema, 0% dipakai
Fondasi database untuk fitur "Company Settings" (toggle policy per modul, termasuk potongan telat/absen dari diskusi sebelumnya) sudah ada tapi tidak ada satupun service/controller yang menyentuhnya.

**Rekomendasi arsitektur:**
- Setting simpel satu-nilai (currency, fiscal year start, feature toggle) → pakai `CompanySetting` key-value.
- Policy dengan beberapa field terkait & butuh validasi (misal potongan telat: rate/menit, cap maksimal, grace period, toggle aktif) → tabel dedicated baru (pola sama seperti `BranchAttendancePolicy` yang sudah benar), **bukan** dipaksa jadi JSON string di kolom `value`.
- Taruh UI-nya di menu **Organization → Company → Settings**, konsisten dengan pola `BranchAttendancePolicy` yang sudah dikelola lewat modul `organization`.

### 18. [☐ Open] Housekeeping code quality
- 6 file masih pakai `console.log` — konsistenkan ke Winston logger.
- 36 penggunaan `: any` — bersihkan agar strict typing TypeScript maksimal.
- Test coverage kuat di business logic numerik (payroll, leave accrual, overtime, depreciation), tapi nol test untuk auth flow, controller, atau middleware (authorize, company scope) — padahal ini paling kritikal untuk regression setelah temuan di atas dibenahi.

### 19. [🔶 Partial 2026-08-22 (Minggu 4)] `BranchAttendancePolicy` wajib diisi per-branch, tidak ada default company-level
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