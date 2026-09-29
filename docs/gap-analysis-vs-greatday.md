# Gap Analysis — HRIS Draft vs Enterprise HRIS (GreatDay HR Benchmark)

Dokumen ini memetakan **alur bisnis dan fitur** yang tidak sesuai standar enterprise HRIS modern (mengacu pada standar GreatDay HR sebagai benchmark lokal). Berbeda dengan `review.md` yang fokus ke security & code quality, dokumen ini fokus ke **kelengkapan dan kebenaran alur**.

> Catatan: referensi GreatDay HR berdasarkan materi publik (marketing, dokumentasi pengguna, blog resmi) — bukan reverse-engineering produk asli.

Legenda:
- 🔴 **Blocker** — alur broken/salah fatal, tidak bisa production
- 🟠 **Major** — gap fungsional yang langsung dirasakan pengguna/HR
- 🟡 **Minor** — missing feature yang ideal untuk enterprise HRIS lengkap

---

## Ringkasan Eksekutif

Sistem ini sudah punya **fondasi domain yang solid** — 22 modul, 150+ model Prisma, perhitungan payroll sesuai regulasi Indonesia. Tapi ada **dua jenis gap** yang berbeda:

1. **Alur yang ada tapi tidak berjalan** — implementasi parsial, titik sambung antar-modul putus (overtime tidak masuk payslip, attendance summary tidak ada review stage, self-approval tidak dicegah, formula tidak diimplementasi).
2. **Alur yang sama sekali belum ada** — fitur yang diekspektasikan di HRIS enterprise level tapi tidak ada model maupun flow-nya (bank transfer file, attendance correction, contract monitoring, carry-over otomatis, PPh21 annual reconciliation).

---

## Domain 1: Attendance (Absensi)

### 🔴 GAP-01 — Attendance Correction/Regularization Flow

**Yang seharusnya ada:** karyawan yang lupa check-in, check-in di luar zona GPS, atau ada error sistem bisa mengajukan **koreksi absensi** (regularization request) ke supervisor untuk diapprove. Setelah approve, record absensi diperbarui dan deduction tidak berlaku.

**Kondisi saat ini:** tidak ada model `AttendanceCorrection`/`AttendanceRegularization`, tidak ada endpoint, tidak ada flow approval. Karyawan tidak punya mekanisme formal koreksi — data absensi mentah langsung dikonsumsi oleh payroll.

**Dampak:** absensi error → potong gaji tanpa bisa dikoreksi → complaint operasional tinggi.

---

### 🟠 GAP-02 — Attendance Summary Review Stage Sebelum Payroll

**Yang seharusnya ada:** sebelum payroll run dikunci, HR bisa review **summary absensi per karyawan per periode** (hadir, tidak hadir, terlambat, lembur, cuti) dalam satu tampilan — bisa edit jika ada koreksi manual — baru kemudian lock dan proses payroll.

**Kondisi saat ini:** `calculatePayroll()` langsung memproses dari data mentah tanpa tahap review. Attendance summary ada di endpoint terpisah (`GET /attendance/summary`) tapi tidak terintegrasi sebagai gating step sebelum payroll lock.

**Dampak:** payroll tidak akurat, HR tidak punya visibility sebelum commit → kesalahan baru ketahuan setelah gaji keluar.

---

### 🟠 GAP-03 — Default Attendance Policy di Level Company

**Yang seharusnya ada:** kalau `BranchAttendancePolicy` tidak diset untuk sebuah branch, sistem **fallback ke policy level company**. Tidak boleh ada branch yang tidak punya policy sama sekali.

**Kondisi saat ini:** `BranchAttendancePolicy` wajib per-branch, tidak ada default. Kalau company punya 20 cabang, HR harus set 20 konfigurasi identik satu per satu.

**Dampak:** friction operasional untuk company kecil/menengah, kemungkinan branch tanpa policy → behavior undefined.

---

### 🟡 GAP-04 — Shift Scheduling Per Karyawan

**Yang seharusnya ada:** HR bisa assign shift spesifik ke karyawan tertentu untuk tanggal/rentang tertentu, berbeda dari ShiftFormula default departemennya.

**Kondisi saat ini:** `EmployeeShiftOverride` sudah ada di schema tapi service/controller belum ada. Endpoint `work-calendar` tidak expose override management.

---

## Domain 2: Leave (Cuti)

### 🔴 GAP-05 — Perhitungan Hari Cuti Pakai Hari Kalender, Bukan Hari Kerja

**Yang seharusnya ada:** saat karyawan ajukan cuti 5 hari Senin–Jumat, sistem hitung 5 hari kerja. Kalau ada libur nasional di tengahnya, potong saldo cuti 4 hari saja.

**Kondisi saat ini (`leave.repository.ts`):**
```ts
totalDays: endDate - startDate // hari kalender, weekend & holiday ikut terhitung
```
Modul `work-calendar` (termasuk `NationalHoliday`) sudah ada tapi **tidak dipakai** di sini.

**Dampak:** potong saldo cuti lebih dari seharusnya → complaint langsung dari karyawan.

---

### 🟠 GAP-06 — Leave Carry-Over & Expiry Otomatis

**Yang seharusnya ada:** tiap pergantian tahun/periode, saldo cuti yang tidak terpakai di-carry-over ke tahun berikutnya (dengan batas maksimal) atau expired. Proses ini berjalan otomatis via cron job.

**Kondisi saat ini:** field `expiredAt` ada di `LeaveBalance` tapi tidak ada scheduler/cron yang menjalankan carry-over atau expire otomatis. Infrastruktur BullMQ sudah ada, tinggal implementasinya.

---

### 🟠 GAP-07 — Self-Approval Tidak Dicegah di Leave (dan modul lain)

**Yang seharusnya ada:** requester tidak bisa approve pengajuannya sendiri. Jika approver-nya adalah dirinya sendiri dalam workflow, sistem skip ke approver berikutnya atau eskalasi.

**Kondisi saat ini:** `leave.service.ts` → `approveLeave()` tidak validasi `approverId !== request.employeeId`. Pola yang sama ada di `permission-request` dan `travel-expense`.

**Dampak:** supervisor dengan `leave:approve` bisa approve cutinya sendiri.

---

### 🟡 GAP-08 — Cuti Bersama (Mass Leave)

**Yang seharusnya ada:** admin bisa deklarasikan tanggal tertentu sebagai "cuti bersama" yang memotong saldo cuti semua karyawan (atau karyawan tertentu) secara massal — mirip kebijakan pemerintah libur bersama Lebaran.

**Kondisi saat ini:** tidak ada model atau endpoint untuk ini. `NationalHoliday` ada tapi bukan cuti yang memotong saldo.

---

### 🟡 GAP-09 — Leave Encashment

**Yang seharusnya ada:** untuk perusahaan yang menerapkan kebijakan "saldo cuti bisa ditukar uang", ada alur formal pengajuan encashment → approve → otomatis jadi komponen tambahan di payslip.

**Kondisi saat ini:** tidak ada model maupun flow untuk ini.

---

## Domain 3: Payroll

### 🔴 GAP-10 — Overtime & Attendance Tidak Masuk ke Payslip

**Yang seharusnya ada:** saat payroll run dieksekusi, engine otomatis query overtime approved + data kehadiran dalam periode → hitung upah lembur + potongan absen/terlambat → masukkan ke komponen payslip.

**Kondisi saat ini (`payroll.service.ts → calculatePayroll()`):**
```ts
workDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, overtimeHours: 0 // hardcode 0
```
Engine `calculateOvertimePay()` sudah benar secara hukum (Permenaker 6/2016) tapi cuma bisa dipakai manual, tidak otomatis ke payslip. Model `ensureLoanDeductionComponent` sudah contoh pola yang benar — tinggal diterapkan ke overtime & attendance.

**Dampak:** payslip tidak akurat, ini fitur utama HRIS yang diharapkan HR.

---

### 🔴 GAP-11 — Potongan Gaji Otomatis untuk Telat/Tidak Masuk

**Yang seharusnya ada:** policy potongan gaji per menit terlambat (atau per hari absen) dikonfigurasi di company/branch settings, lalu otomatis dihitung saat payroll run.

**Kondisi saat ini:** `SalaryComponent.calculationMethod: 'FORMULA'` dideklarasikan di schema tapi **tidak diimplementasi** — kalau dipilih di UI, tidak ada yang terjadi. `BranchAttendancePolicy` hanya atur toleransi & GPS, bukan deduction.

---

### 🟠 GAP-12 — Tidak Ada Bank Transfer File Generation

**Yang seharusnya ada:** setelah payroll diapprove, HR bisa export **file transfer bank** (format BCA KlikBizz, BNI Payroll, Mandiri Cash Management, dll.) yang langsung bisa di-upload ke internet banking perusahaan.

**Kondisi saat ini:** tidak ada endpoint atau service untuk ini. Payroll bisa "disburse" di sistem tapi tidak ada output file ke bank.

**Dampak:** HR masih harus input manual di internet banking → error prone, tidak efisien.

---

### 🟠 GAP-13 — Payslip Distribution Otomatis

**Yang seharusnya ada:** saat payslip diterbitkan (status `PUBLISHED`), sistem otomatis kirim email ke karyawan dengan PDF payslip ter-attach atau link secure.

**Kondisi saat ini:** notification module scoped benar, email infrastructure ada, tapi tidak ada trigger event saat payslip published. Karyawan harus login sendiri untuk lihat payslip.

---

### 🟠 GAP-14 — Tidak Ada Correction Run / Payroll Susulan

**Yang seharusnya ada:** kalau ada kesalahan input atau karyawan yang terlewat di payroll run sebelumnya, HR bisa buat **correction run** atau payroll susulan untuk periode yang sama.

**Kondisi saat ini:** satu `PayrollPeriod` hanya bisa punya satu `PayrollRun` aktif — tidak ada mekanisme correction atau susulan.

---

### 🟠 GAP-15 — Payroll Maker-Checker (Approve ≠ Disburse)

**Yang seharusnya ada:** prinsip four-eyes — satu orang yang approve payroll tidak boleh juga yang disburse. Minimal permission berbeda atau flag audit.

**Kondisi saat ini (`payroll.routes.ts`):** approve dan disburse pakai permission identik `payroll:approve`. Satu orang bisa approve lalu langsung disburse tanpa oversight.

---

### 🟡 GAP-16 — PPh21 Annual Reconciliation

**Yang seharusnya ada:** di Desember, sistem hitung ulang total PPh21 setahun per karyawan dan sesuaikan dengan yang sudah dipotong tiap bulan. Kekurangan/kelebihan potong harus dikoreksi di payslip Desember.

**Kondisi saat ini:** perhitungan PPh21 per bulan sudah sesuai regulasi, tapi tidak ada flow rekonsiliasi tahunan. Kurang umum untuk HRIS skala menengah-besar.

---

### 🟡 GAP-17 — Gross-Up Salary Method

**Yang seharusnya ada:** opsi metode perhitungan PPh21 di mana perusahaan menanggung pajak karyawan — kalkulasi terbalik dari net salary ke gross.

**Kondisi saat ini:** tidak ada. Beberapa perusahaan (terutama asing) menggunakan metode ini.

---

## Domain 4: Organization & Employee

### 🟠 GAP-18 — Employee Transfer/Mutation Flow

**Yang seharusnya ada:** alur formal mutasi karyawan — HR/atasan ajukan → approval → effective date — setelah approved, data employee (department, position, branch, atasan) otomatis berubah di tanggal efektif. History terjaga di `EmployeeCareerTransaction`.

**Kondisi saat ini:** `EmployeeCareerTransaction` ada di schema, tapi tidak ada service/controller untuk alur mutasi dengan approval. Perubahan posisi/department dilakukan langsung edit employee tanpa approval flow.

---

### 🟠 GAP-19 — Contract/PKWT Renewal Monitoring

**Yang seharusnya ada:** sistem tracking tanggal berakhir kontrak PKWT karyawan, kirim reminder otomatis ke HR X hari sebelum expired (misal 30, 14, 7 hari). HR bisa mark: perpanjang, angkat tetap, atau tidak diperpanjang.

**Kondisi saat ini:** field `contractEndDate` ada di `Employee`, tapi tidak ada scheduler untuk reminder maupun alur perpanjangan kontrak.

---

### 🟠 GAP-20 — Probation Monitoring & Review

**Yang seharusnya ada:** karyawan baru punya masa probasi (3–6 bulan). Sistem tracking deadline probasi, kirim reminder ke atasan untuk lakukan review, atasan input keputusan (lulus/diperpanjang/tidak lulus).

**Kondisi saat ini:** field `probationEndDate` ada di `Employee`, tapi tidak ada flow review probasi maupun reminder.

---

### 🟠 GAP-21 — Salary Revision Formal Flow

**Yang seharusnya ada:** alur formal kenaikan/penurunan gaji — HR ajukan revision proposal (effective date, component changes, reason) → approval → otomatis update `EmployeeSalary` di tanggal efektif dan record di career history.

**Kondisi saat ini:** gaji diubah langsung edit di endpoint salary tanpa approval flow atau effective date management.

---

### 🟡 GAP-22 — Headcount Planning / Man Power Planning (MPP)

**Yang seharusnya ada:** sebelum buka rekrutmen, ada proses formal MPP — department head ajukan kebutuhan headcount (posisi, jumlah, timeline, justifikasi budget) → approval → baru job posting dibuat.

**Kondisi saat ini:** `JobPosting` langsung dibuat tanpa MPP. Tidak ada model `HeadcountRequisition`.

---

## Domain 5: Workflow & Approval

### 🟠 GAP-23 — Workflow Engine Tidak Dipakai Konsisten

**Yang seharusnya ada:** semua alur yang butuh approval (leave, overtime, travel expense, loan, mutation, salary revision, payroll) menggunakan `WorkflowEngine` yang sudah dibangun — bukan hardcode permission flat.

**Kondisi saat ini:**
- Payroll: masih pakai `payroll:approve` flat permission, tidak lewat workflow engine
- Leave: approval lewat service langsung, tidak lewat workflow engine
- Permission-request: tidak pakai workflow engine
- Travel-expense: tidak pakai workflow engine

`WorkflowEngine` (fondasi sudah solid) hanya dipakai di performance review — belum diadopsi modul lain.

---

### 🟠 GAP-24 — Company Settings & Policy Tidak Dipakai

**Yang seharusnya ada:** setiap company bisa konfigurasi policy mereka sendiri — cut-off date payroll, metode PPh21, default leave policy, fitur yang diaktifkan/dinonaktifkan.

**Kondisi saat ini:** tabel `CompanySetting`, `GroupSetting`, `GroupPolicy` sudah ada di schema Prisma tapi **0% dipakai** di service/controller manapun. Semua setting masih hardcoded atau tidak ada.

---

## Domain 6: Training & Performance

### 🟡 GAP-25 — Training Post-Evaluation

**Yang seharusnya ada:** setelah training selesai, peserta bisa isi form evaluasi (reaction level — Kirkpatrick Level 1), trainer bisa input nilai (learning level). Ada rekap efektivitas training per course.

**Kondisi saat ini:** `TrainingAttendance` ada (attendance tracking) tapi tidak ada model untuk evaluasi/nilai post-training.

---

### 🟡 GAP-26 — Performance Goal Cascade (Top-Down Alignment)

**Yang seharusnya ada:** OKR/goal perusahaan/divisi bisa di-cascade ke bawah — goal atasan jadi konteks/referensi saat bawahan bikin goal mereka. Ada visualisasi alignment tree.

**Kondisi saat ini:** `Goal` model ada dengan field `parentGoalId` untuk hierarchy, tapi tidak ada UI cascade atau validasi alignment parent-child.

---

## Domain 7: Document Management

### 🟡 GAP-27 — E-Signature Workflow Tidak Terstruktur

**Yang seharusnya ada:** dokumen yang butuh tanda tangan punya urutan signer yang jelas (misal: karyawan sign dulu → HR sign → direktur sign), dengan deadline per signer dan reminder otomatis.

**Kondisi saat ini:** `DocumentSignature` model ada tapi tidak ada workflow ordering — semua signer setara tanpa urutan.

---

## Domain 8: System & Infrastructure

### 🟠 GAP-28 — Notification Event Mapping Tidak Lengkap

**Yang seharusnya ada:** setiap event penting (leave approved/rejected, payslip published, overtime approved, contract akan expired, probation deadline) otomatis trigger notifikasi ke user yang relevan.

**Kondisi saat ini:** notification module securitynya sudah benar, tapi tidak ada mapping komprehensif event → notifikasi. Hanya beberapa event yang trigger notifikasi — sebagian besar tidak.

---

### 🟡 GAP-29 — Report Module Belum Diimplementasi

**Yang seharusnya ada:** minimal report standar HRIS: headcount per department/status, turnover rate, absenteeism rate, payroll summary per department, leave balance per karyawan, overtime per periode.

**Kondisi saat ini:** modul `reports` ada strukturnya (routes/controller/service) tapi implementation-nya tidak ada — semua endpoint placeholder.

---

### 🟡 GAP-30 — Self-Service Portal Incomplete

**Yang seharusnya ada:** karyawan bisa akses semua kebutuhan mereka sendiri dari satu halaman: lihat payslip, ajukan cuti, ajukan lembur, koreksi absensi, lihat jadwal shift, lihat saldo cuti, update data pribadi, download dokumen.

**Kondisi saat ini:** `self-service/` folder ada di frontend tapi kontennya skeleton/placeholder. Sebagian fitur self-service tersebar di modul masing-masing tanpa unified portal view.

---

## 📊 Tabel Parity GreatDay HR — Summary Update (Follow-up 2026-09-02)

Ringkasan progress item-item gap yang dilaporkan dalam Laporan Paritas GreatDay HR, termasuk koreksi klaim lama dan follow-up Face/Menu/Data Access.

| Prior | Area | Kondisi Awal (Sebelum Plan A) | Status Sekarang (2026-09-02) | Fix / Keterangan |
|-------|------|--------------------------------|-------------------------------|------------------|
| **P0** | Menu Access UI | ❌ UI lama masih statis dan tidak aman untuk workflow admin nyata | ✅ **IMPLEMENTED (2026-09-02)** | Role diambil dari backend, menu dikelompokkan dan dapat dicari, tersedia bulk allow/deny per grup, dirty-state guard, serta loading/error/empty state. Sidebar tetap memakai deny list; halaman dan route admin sekarang konsisten memerlukan `rbac:update`. Visibilitas menu bukan pengganti otorisasi API. |
| **P0** | Data Access Scope UI | ❌ Scope unit memakai UUID mentah dan feedback state minim | 🟡 **ADMIN UI IMPLEMENTED; ENFORCEMENT HARDENING REMAINS** | Role/branch/department/subdepartment memakai data live dan picker bernama yang dapat dicari, dilengkapi preview scope efektif dan dirty-state guard. Namun enforcement baris perlu diverifikasi per modul/resource; `MANAGER_TEAM` masih placeholder sehingga belum boleh diklaim 100% universal. |
| **P1** | Face Recognition Wiring | ⚠️ Parsial: cuma vector comparison dan data turunan client dipercaya | 🟡 **REAL SERVER-SIDE WIRING IMPLEMENTED; STAGING VALIDATION REQUIRED** | Server mendecode JPEG/PNG, mendeteksi tepat satu wajah, mengekstrak learned descriptor 256-dim dengan Human/WASM, mengenkripsi template AES-256-GCM, dan membandingkan embedding di server. Client vector/verdict/URL ditolak; foto sumber tidak disimpan. Enrollment dan check-in UI sudah terhubung. Challenge liveness saat ini masih heuristic client-side, bukan certified anti-spoof; wajib ukur FAR/FRR dan spoof resistance sebelum rollout luas. |
| **P1** | Daily Activity Module | ❌ Tidak ada module, cuma pure operations helpers di shared | ✅ **FULL WRAPPED (80% code reuse existed)** — 100% Module Lengkap: schema/model, CRUD API, RBAC, AuditLog, Frontend 2 Pages (Employee GPS capture + Admin Approval Queue) | 3-Strike Rule verified Strike2 helpers 80% existed (`validateOverlapHours`, `validateActivityGeoRadius`, `calculateTotalMinutes`) → wrap module tinggal import saja, write 20% CRUD scaffold. Geofence validate & overlap hours BEFORE create; Self-guard role employee tidak bisa create atas nama lain; Complete action dengan foto evidence 6 foto MAX. |
| **P2** | Earned Wage Access (EWA) | ⚠️ Logic ada di helper, tapi belum jadi module API/UI; period & earnedGross trusted dari client (celah finansial!) | ✅ **PRODUCTION READY 100% — CRITICAL FIXED Re-Review #4** | (a) Module Lengkap: routes + controller + service + repository + zodDTO + auditLog + 13 RBAC permission matrix 6 roles; (b) Payroll end-to-end: PAID EWA list auto aggregate → `EWA-DEDUCT` component (sortOrder 995) + BULK MARK step5 prevent double deduct; (c) **CRITICAL Re-Review #4 Fix:** earnedGross HAPUS TOTAL dari client input → server calculate sendiri 4-step (baseSalary aktif ÷ workDays × presentDays + approvedOvertimePay). periodStart/end dari PayrollPeriod DB atau auto bulan ini (BOD/EOM). Controller guard throw BadRequest jika client kirim field terlarang. |
| **P2** | Engagement Portal (Announcement/Survey) | ❌ Gap pure logic not wired — pure logic di shared engagement tapi not yet module production (opsional next step Opsi A #3 user) | ⏳ **PENDING Optional Next Step (User Request)** | Pure logic shared `isAnnouncementVisibleTo()` + survey models existed — tinggal wrap CRUD module 6 files backend + 2 pages frontend home widget. Bisa gas jika user pilih opsi lanjut. |
| **P2** | Task Assignment Basic / Patrol Realtime | ❌ Gap pure logic shared exist tapi not yet module production (opsional next) | ⏳ **PENDING Optional (P2 Low Priority Schedule)** | FSM state machine isTaskTransitionValid + Patrol compliance rate existed. Mirip pattern wrap DailyActivity. Sisa gap 3 modules engagement/task/patrol bisa lanjut sesi berikutnya jika user minta. |

**Plan A Optimal Parity Minggu 6 (Urutan 1-4 user pilih "a"): 100% TUTUP BUKU.** Exit: Backend TSC 0, Frontend TSC 0, Jest pure = 229 PASS. Prisma validate/generate 0.

---

## Security Gaps (Referensi review.md)

Security gaps sudah didokumentasikan detail di `review.md`. Berikut ringkasan blocker-nya untuk konteks checklist:

| ID | Issue | Severity |
|----|-------|----------|
| SEC-01 | Privilege escalation: user biasa bisa jadi SUPER_ADMIN | 🔴 Blocker |
| SEC-02 | CompanyScope tidak dipakai → cross-tenant data leak di 21 modul | 🔴 Blocker |
| SEC-03 | findMyPayslips: employeeId dari query param, bisa intip gaji orang lain | 🔴 Blocker |
| SEC-04 | IDOR di 7 sub-entity employee | 🔴 Blocker |
| SEC-05 | auditLog() middleware hanya di 2 route dari ratusan | 🔴 Blocker |
| SEC-06 | Refresh token di localStorage (XSS risk) | 🟠 Major |
| SEC-07 | Payroll: tidak ada maker-checker (→ GAP-15) | 🟠 Major |
| SEC-08 | Employee loan: tanpa validasi, employeeId dari body | 🟠 Major |
| SEC-09 | generateRandomPassword() pakai Math.random() | 🟡 Minor |
| SEC-10 | CSV export formula injection | 🟡 Minor |

---

## Checklist Perbaikan

### Fase 1 — Security Blockers (wajib sebelum production)

- [ ] **SEC-01** Fix privilege escalation RBAC — validasi scope saat role assignment, SUPER_ADMIN hanya bisa di-grant oleh SUPER_ADMIN
- [ ] **SEC-02** Implementasi Prisma middleware global untuk inject `companyId` filter dari `req.user` — hapus ketergantungan pada client-sent companyId di semua query
- [ ] **SEC-03** `findMyPayslips`: paksa `employeeId = req.user.employeeId`, pisahkan endpoint untuk HR
- [ ] **SEC-04** Ownership check di 7 sub-entity employee (family, education, skill, training, experience, emergency contact, attachment) — contek pola `updateCompanyAssignment`
- [ ] **SEC-05** Pasang `auditLog()` middleware di semua endpoint sensitif: role/permission mutation, payroll approve/disburse, employee CRUD, company mutation, approval actions
- [ ] **SEC-06** Pindahkan refresh token ke httpOnly cookie (sudah selesai per commit `859c68a`, verifikasi ulang)
- [ ] **SEC-08** Employee loan: validasi amount/installment vs LoanType.maxAmount/maxTenor; employeeId self-service dari req.user

### Fase 2 — Alur Inti yang Broken (core flows tidak berfungsi)

- [ ] **GAP-05** Fix perhitungan hari cuti: pakai hari kerja (exclude weekend + NationalHoliday), bukan hari kalender
- [ ] **GAP-07** Cegah self-approval di leave, permission-request, dan travel-expense
- [ ] **GAP-10** Sambungkan overtime approved + attendance data ke `calculatePayroll()` — contek pola `ensureLoanDeductionComponent`
- [ ] **GAP-11** Implementasi `SalaryComponent.calculationMethod: 'FORMULA'` — atau drop opsi dari UI sampai siap
- [ ] **GAP-15** Pisahkan permission payroll `approve` vs `disburse` (maker-checker)
- [ ] **GAP-01** Buat flow Attendance Correction/Regularization — model + approval + update attendance record
- [ ] **GAP-02** Tambahkan Attendance Summary Review stage sebelum payroll lock — endpoint summary editable, gating step sebelum `PayrollRun` bisa dieksekusi

### Fase 3 — Missing Key HRIS Flows

- [ ] **GAP-03** Default attendance policy di level company sebagai fallback BranchAttendancePolicy
- [ ] **GAP-06** Implementasi leave carry-over & expiry otomatis via BullMQ scheduler (jalankan tiap awal tahun/periode)
- [ ] **GAP-12** Bank transfer file generation — export format BCA/BNI/Mandiri setelah payroll disburse
- [ ] **GAP-13** Payslip distribution otomatis via email saat status `PUBLISHED`
- [ ] **GAP-14** Correction run / payroll susulan untuk periode yang sudah berjalan
- [ ] **GAP-18** Employee transfer/mutation flow — model proposal + approval + effective date + auto-update data
- [ ] **GAP-19** Contract/PKWT expiry monitoring + reminder otomatis via BullMQ scheduler
- [ ] **GAP-20** Probation review flow — reminder ke atasan + form keputusan
- [ ] **GAP-21** Salary revision formal flow — proposal + approval + effective date management
- [ ] **GAP-23** Adopsi WorkflowEngine secara konsisten: leave, overtime, travel-expense, loan, payroll approve
- [ ] **GAP-24** Implementasi Company Settings — CRUD endpoint + pakai di service yang relevan (cut-off date, PPh21 method, dll.)
- [ ] **GAP-28** Lengkapi notification event mapping — setiap approval event trigger notifikasi ke user relevan

### Fase 4 — Enhancement & Polish

- [ ] **GAP-04** Implementasi EmployeeShiftOverride — service + controller + UI management
- [ ] **GAP-08** Cuti bersama (mass leave) — model + endpoint admin + potong saldo karyawan massal
- [ ] **GAP-16** PPh21 annual reconciliation — December adjustment run
- [ ] **GAP-22** Headcount Planning / Man Power Planning sebelum JobPosting
- [ ] **GAP-25** Training post-evaluation — form evaluasi peserta + penilaian trainer
- [ ] **GAP-26** Performance goal cascade — UI alignment parent-child goal
- [ ] **GAP-27** E-Signature workflow ordering — urutan signer + deadline + reminder
- [ ] **GAP-29** Implementasi Reports module — setidaknya 5 laporan standar: headcount, turnover, absenteeism, payroll summary, leave balance
- [ ] **GAP-30** Self-Service Portal — unified view untuk karyawan: payslip, cuti, lembur, koreksi absensi, jadwal, data pribadi

### Fase 5 — Code Quality & Hardening (dari review.md)

- [ ] **SEC-09** Ganti `Math.random()` di `generateRandomPassword()` ke `crypto.randomBytes`
- [ ] **SEC-10** Sanitasi field CSV export untuk cegah formula injection
- [ ] Ganti 6 `console.log` ke Winston logger
- [ ] Bersihkan 36 penggunaan `: any` untuk strict typing
- [ ] Tambahkan test coverage untuk auth flow, controller, middleware (authorize, CompanyScope)
- [ ] **GAP-09** Leave encashment (low priority — tergantung kebijakan perusahaan klien)
- [ ] **GAP-17** Gross-up salary method (low priority — untuk perusahaan asing/multinasional)
- [ ] **GAP-21b** Rapel/correction payment dalam payroll

---

## Prioritas Urutan Implementasi

```
Fase 1: SEC-01 → SEC-02 → SEC-03 → SEC-04 → SEC-05 → SEC-08
   ↓
Fase 2: GAP-05 → GAP-07 → GAP-10 → GAP-15 → GAP-01 → GAP-02 → GAP-11
   ↓
Fase 3: GAP-03 → GAP-06 → GAP-12 → GAP-13 → GAP-19 → GAP-24 → GAP-23 → GAP-18 → GAP-21 → GAP-28
   ↓
Fase 4: GAP-04 → GAP-08 → GAP-29 → GAP-30 → GAP-14 → GAP-20 → GAP-22 → GAP-25 → GAP-26 → GAP-27
   ↓
Fase 5: Hardening & polish
```

**Total gap teridentifikasi:** 30 gap fungsional + 10 security gap = **40 item**
- 🔴 Blocker: 7 item (5 security + GAP-05, GAP-10)
- 🟠 Major: 18 item
- 🟡 Minor: 15 item

---

*Dokumen ini adalah hasil analisis statis dan perbandingan fitur publik. Disarankan validasi ulang setiap item dengan stakeholder bisnis sebelum implementasi — tidak semua gap relevan untuk semua segmen klien.*

---

## Re-verifikasi 29 September 2026 — 30 gap ditelusuri ulang ke kode

Setiap gap di atas diperiksa lagi terhadap source saat ini, bukan diingat dari
laporan sebelumnya. Kolom bukti menunjuk file yang membuat verdict-nya bisa
diperiksa sendiri.

| Gap | Verdict | Bukti / catatan |
|---|---|---|
| GAP-01 koreksi absensi | ✅ tertutup | `attendance-correction.{routes,service}.ts`; snapshot nilai sebelum koreksi, wajib alasan, template workflow `ATTENDANCE_CORRECTION`, dan ditolak bila periode payroll sudah CLOSED |
| GAP-02 review absensi sebelum payroll | ✅ tertutup | `payroll.service.ts` menolak run dengan "Attendance harus dikonfirmasi sebelum payroll dihitung"; gerbangnya `confirmAttendanceReview` → `PayrollPeriod.attendanceReviewedAt` |
| GAP-03 default policy level company | ✅ tertutup | `attendance-context.service.ts:188` — policy branch, lalu fallback ke baris `branchId: null` milik company |
| GAP-04 shift per karyawan | ✅ tertutup (29 Sep) | `POST/GET/DELETE /work-calendars/employees/:employeeId/shift-assignments` menulis override `HR_ASSIGNMENT`; payroll kini menerimanya dengan syaratnya sendiri, menolak rentang di periode payroll tertutup, dan tidak menimpa swap yang sudah disetujui |
| GAP-05 cuti pakai hari kerja | ✅ tertutup | `leave.repository.countLeaveDays` — hari kerja dikurangi `NationalHoliday`, dipakai saat submit dan validasi `maxDays` |
| GAP-06 carry-over & expiry | ✅ tertutup (29 Sep) | Job tahunan SUDAH ada sejak lama (`leave.scheduler.ts`, `leave:yearly-accrual`, cron 1 Jan 01:00, terdaftar di worker). Cacat sebenarnya bukan penjadwalan: expire dijalankan SEBELUM accrual sehingga `remainingDays` tahun lalu sudah nol saat carry-over membacanya — carry-over tidak pernah membawa apa pun. Urutannya diperbaiki dan dikunci test |
| GAP-07 self-approval | ✅ tertutup | Dicegah di level engine (subject-level + separation of duties), bukan per modul |
| GAP-08 cuti bersama | 🔴 terbuka | Tidak ada model/endpoint; `NationalHoliday` tidak memotong saldo |
| GAP-09 leave encashment | 🔴 terbuka | Tidak ada model maupun alur |
| GAP-10 lembur & absensi ke payslip | ✅ tertutup | Payslip menyimpan `workDays/presentDays/leaveDays/absentDays` dan lembur terpisah workday vs holiday (`overtimeWorkdayHours`/`overtimeHolidayHours`) |
| GAP-11 potongan telat/absen | ✅ tertutup | `late_deduction_*` + `absence_deduction_daily_basic_percent` per company, komponen potongan dibuat otomatis saat run |
| GAP-12 file transfer bank | ✅ tertutup | `payroll-payment.service.exportBatch` → `generateBankCsv` per `bankCode`, batch jadi `EXPORTED`, dan aksinya masuk audit `MANUAL_BANK_FILE_EXPORTED` |
| GAP-13 distribusi payslip otomatis | 🔴 terbuka | Tidak ada trigger email saat payslip terbit. Yang ada: self-service terlindungi PIN/reauth — karyawan tetap harus menarik sendiri |
| GAP-14 correction run / susulan | 🟠 sebagian | Run salah bisa di-VOID sehingga periode bisa dihitung ulang penuh, tapi tidak ada run tambahan untuk karyawan yang terlewat saja |
| GAP-15 maker-checker payroll | ✅ tertutup | `payroll:disburse` permission tersendiri, approver ≠ pembuat, dan transisi status terjaga |
| GAP-16 rekonsiliasi PPh21 tahunan | 🔴 terbuka | Perhitungan bulanan sesuai regulasi; tidak ada penyesuaian Desember |
| GAP-17 gross-up | 🔴 terbuka | Tidak ada |
| GAP-18 mutasi karyawan | ✅ tertutup | `EmployeeCareerTransaction` + template `CAREER_MOVEMENT`; future-dated diterapkan scheduler, snapshot asal diambil dalam advisory lock |
| GAP-19 monitoring kontrak PKWT | 🔴 terbuka (butuh schema) | **Koreksi:** `contractEndDate` TIDAK ada di model `Employee`. Yang ada hanya enum `EmploymentType.CONTRACT` dan `EmploymentStatus.CONTRACT_END`, plus `Offer.probationMonths` di sisi rekrutmen. Reminder butuh field + migrasi dulu |
| GAP-20 monitoring probasi | 🔴 terbuka (butuh schema) | **Koreksi:** `probationEndDate` TIDAK ada di model `Employee`; tidak ada tanggal akhir probasi per karyawan sama sekali |
| GAP-21 revisi gaji formal | 🟠 sebagian | Transaksi karier bisa membawa `toBaseSalary` dengan effective date dan lewat approval, lalu membuat `EmployeeSalary` baru; belum ada alur proposal revisi gaji tersendiri |
| GAP-22 MPP / headcount requisition | 🔴 terbuka | Tidak ada model; `JobPosting` masih bisa dibuat tanpa requisition |
| GAP-23 konsistensi workflow engine | ✅ tertutup | Sembilan domain lewat engine (leave, loan, business-trip, expense-claim, shift-swap, overtime, career-movement, permission-request, attendance-correction), semuanya template-gated dengan fallback direct-approve |
| GAP-24 company settings dipakai | ✅ tertutup | Workweek, potongan telat/absen, cuti unpaid, benefit deduction, batas cicilan pinjaman, dan retensi semuanya dibaca dari `CompanySetting` |
| GAP-25 evaluasi pasca-training | 🔴 terbuka (field menganggur) | `TrainingEnrollment.score` ada di schema tetapi tidak dipakai kode manapun; belum ada form reaksi peserta maupun rekap efektivitas |
| GAP-26 cascade goal | 🔴 terbuka (premis berubah) | Klaim lama menyebut `parentGoalId` sudah ada di model `Goal` — sekarang **tidak ada** field itu di schema, jadi hierarki goal perlu dimodelkan dulu sebelum bicara cascade |
| GAP-27 urutan e-signature | 🔴 terbuka | `DocumentSignature` tanpa urutan/deadline per signer |
| GAP-28 pemetaan event → notifikasi | ✅ tertutup (29 Sep) | **Koreksi premis:** event untuk cuti/lembur/slip memang tidak pernah dipublikasikan, jadi memasang consumer saja tak menghasilkan apa-apa. Notifikasi keputusan kini dibangun di workflow engine (menjangkau sembilan domain sekaligus, ditulis dalam transaksi yang sama dengan keputusannya) dan approve payroll memberi tahu setiap karyawan bahwa slipnya terbit — tanpa nominal |
| GAP-29 modul report | ✅ tertutup | Enam endpoint (`summary`, `headcount`, `attendance`, `leave`, `payroll`, `turnover`) dengan repository dan agregat nyata; report payroll ikut ter-audit |
| GAP-30 portal self-service | ✅ tertutup | `SelfServicePage.tsx` ~1.380 baris: cuti, izin, lembur, koreksi absensi, jadwal/shift, saldo, profil, dan slip gaji terlindungi PIN |

**Skor awal pemeriksaan (29 Sep pagi):** 16 tertutup, 5 sebagian, 9 terbuka. **Setelah pekerjaan hari itu:** 19 tertutup, 3 sebagian, 8 terbuka — dari kondisi awal dokumen ini
yang mencatat 3 blocker, 16 major, 11 minor.

### Yang tersisa, dipisah menurut siapa yang memutuskan

**Sudah dikerjakan pada 29 September 2026:**

- GAP-28 notifikasi keputusan & slip gaji. Premisnya ternyata salah: event untuk
  cuti/lembur/slip tidak pernah dipublikasikan, jadi memasang consumer saja
  tidak menghasilkan apa pun. Notifikasi dibangun di workflow engine — satu
  tempat yang dilewati sembilan domain approval — dan approve payroll memberi
  tahu tiap karyawan bahwa slipnya terbit.
- GAP-06 carry-over. Scheduler-nya sudah ada sejak lama; yang rusak urutannya
  (expire mendahului accrual sehingga carry-over selalu nol).
- GAP-04 penetapan shift oleh HR. Menulis override baru ternyata memerlukan
  perubahan di payroll lebih dulu: resolver-nya menolak override apa pun yang
  bukan shift-swap, sehingga setiap hari yang ditugaskan akan menggagalkan
  payroll run.

**Koreksi: GAP-19 dan GAP-20 BUKAN pekerjaan yang siap dibangun.** Dokumen lama
menyebut `Employee.contractEndDate` dan `Employee.probationEndDate` sudah ada,
dan ringkasan pertama saya mengulanginya tanpa memeriksa. Field itu tidak ada —
tidak ada tanggal akhir kontrak maupun probasi per karyawan di schema. Keduanya
butuh model data dulu, jadi tempatnya di daftar berikut.

**Butuh keputusan kamu dulu:**

- GAP-08 cuti bersama dan GAP-09 encashment — keduanya memotong atau menukar
  saldo cuti, jadi kebijakannya harus ditetapkan sebelum dikodekan.
- GAP-13 distribusi payslip lewat email — mengirim slip gaji ke luar sistem
  adalah keputusan privasi, bukan teknis. Kontras dengan desain sekarang yang
  justru memperketat akses slip dengan PIN.
- GAP-19 monitoring kontrak PKWT dan GAP-20 monitoring probasi — perlu
  keputusan apa yang disimpan (tanggal akhir kontrak/probasi per karyawan,
  riwayat perpanjangan) dan kapan siapa diingatkan, baru bisa dimodelkan.
- GAP-14 payroll susulan, GAP-16 rekonsiliasi PPh21 tahunan, GAP-17 gross-up,
  GAP-21 alur proposal revisi gaji, GAP-22 MPP, GAP-25 evaluasi training,
  GAP-26 hierarki & cascade goal, GAP-27 urutan e-signature — semuanya alur
  bisnis baru yang bentuknya bergantung kebijakan HR kamu.

  Catatan untuk GAP-16: PPh21 memakai metode annualized net (pajak setahun
  dibagi 12), sehingga selisih akhir tahun umumnya kecil — tetapi tetap tidak
  ada rekonsiliasi Desember. Untuk GAP-25, `TrainingEnrollment.score` sudah ada
  di schema namun tidak dipakai kode manapun.

### Keputusan yang menunggu

Sepuluh gap yang tersisa sudah dirinci menjadi pilihan konkret di
`docs/open-hr-decisions.md` — apa yang diputuskan, opsinya, rekomendasi, dan
ukuran implementasinya. Tidak ada yang tertahan pekerjaan teknis.

### Catatan metode

Angka-angka di atas datang dari membaca kode, bukan dari ringkasan lama. Empat
klaim lama terbukti tidak akurat saat diperiksa, dan dua di antaranya sempat
saya ulangi sebelum memeriksanya sendiri:

- `parentGoalId` (GAP-26) tidak ada di schema.
- `EmployeeShiftOverride` (GAP-04) ternyata sudah ditulis oleh alur shift-swap.
- `Employee.contractEndDate` dan `Employee.probationEndDate` (GAP-19, GAP-20)
  tidak ada sama sekali.
- GAP-06 bukan soal scheduler yang hilang — job-nya ada, urutannya yang salah.

Pelajaran metodenya: mencari berdasarkan kata di dokumen lama (`carry-over`)
melewatkan kode yang ada dengan nama lain (`leave:yearly-accrual`). Verifikasi
berikutnya sebaiknya berangkat dari model schema dan daftar job/cron, bukan dari
istilah di laporan sebelumnya.

Referensi GreatDay HR tetap dari materi publik sebagai tolok ukur fitur, bukan
hasil membongkar produknya.

---

## Perbandingan ulang — 29 September 2026, sore

**Skor tidak berubah: 19 tertutup, 3 sebagian, 8 terbuka.** Tidak ada fitur baru
sejak pemeriksaan pagi; yang berubah adalah kekuatan bukti di belakang beberapa
verdict. Itu perbedaan yang layak dicatat terpisah, supaya "tertutup" tidak
diam-diam berarti "ada kodenya, belum ada yang mengujinya".

### Verdict yang kini punya bukti eksekusi, bukan hanya kode

| Gap | Sebelumnya | Sekarang |
|---|---|---|
| GAP-01, GAP-05 koreksi absensi & hari kerja cuti | dibaca dari kode | `leave-journey.mysql` menguji pengajuan → approval → potongan saldo → pembatalan di MySQL sungguhan, termasuk potongan yang mendarat tepat sekali saat dua approval berlomba dan penolakan approval di periode payroll tertutup |
| GAP-28 notifikasi keputusan | baru saja dibangun | `decision-notification.mysql` membuktikan satu baris ke requester, approver tidak menerima apa pun, dan workflow dua tingkat tidak menulis apa pun sampai keputusannya final |
| GAP-29 modul report | endpoint ada | `reports.mysql` mengikat angkanya dan batas tenant-nya: filter departemen tidak bisa dipakai menembus perusahaan lain, dan laporan cuti hanya menghitung yang APPROVED |
| Sesi & self-service (lintas gap) | tidak ada uji browser | suite Playwright: token tidak terbaca JavaScript, token basi diganti transparan, akun nonaktif dilempar ke login, plus alur ajukan/batalkan cuti |

### Delapan yang terbuka, diperiksa ulang dari schema

Metodenya sengaja dibalik setelah pelajaran pagi ini (mencari kata "carry-over"
melewatkan job bernama `leave:yearly-accrual`): kali ini berangkat dari nama
model, nama field, dan daftar job — bukan dari istilah di laporan lama.

Hasilnya kedelapan tetap terbuka, dan satu temuan baru:

- **GAP-22 penamaan yang menyesatkan.** Komentar schema menyebut `JobPosting`
  sebagai "Job posting / requisition", tetapi modelnya tidak punya jumlah
  headcount, anggaran, maupun approval — hanya `status` DRAFT/…. Jadi bukan
  requisition yang setengah jadi; requisition-nya tidak ada, dan komentarnya
  membuatnya tampak ada. Siapa pun yang membaca schema untuk memutuskan
  prioritas bisa tertipu di titik ini.
- GAP-08 cuti bersama: `LeaveType` tidak punya penanda kolektif, tidak ada model
  terkait. GAP-09 encashment: tidak ada apa pun.
- GAP-13 email slip gaji: `MailService` ada dan dipakai — tetapi **hanya** untuk
  password reset. Tidak ada jalur payslip ke email.
- GAP-16 rekonsiliasi PPh21, GAP-17 gross-up, GAP-25 evaluasi training (field
  `TrainingEnrollment.score` tetap menganggur), GAP-26 hierarki goal (tidak ada
  `parentGoalId`), GAP-27 urutan e-signature (tidak ada field urutan/tenggat):
  tidak berubah.

### Yang menunggu keputusan

Kesepuluh item beserta opsi, rekomendasi, dan ukuran implementasinya ada di
`docs/open-hr-decisions.md`. Tidak ada satu pun yang tertahan pekerjaan teknis.

---

## Gap baru di luar daftar 30 — 29 September 2026

Pemeriksaan sebelumnya memverifikasi ulang 30 gap yang sudah tercatat.
Pertanyaan berikutnya berbeda: **apakah ada area fitur GreatDay yang belum pernah
masuk daftar sama sekali?** Enam area diperiksa dari schema, enum, dan daftar
endpoint. Hasilnya lima gap baru, dan satu di antaranya bukan sekadar fitur yang
belum ada.

### 🔴 GAP-31 — Metode absensi FINGERPRINT dipercaya dari klien

Ini yang paling perlu perhatian, karena bentuknya bukan "fitur belum ada"
melainkan asimetri kepercayaan yang menyesatkan.

`AttendancePolicyMethod` dan `AttendanceCaptureMethod` keduanya punya nilai
`FINGERPRINT`, dan DTO check-in menerima `method: 'FINGERPRINT'` apa adanya
(`attendance.dto.ts`). Tidak ada integrasi perangkat, tidak ada kredensial
mesin, tidak ada endpoint impor punch. Artinya satu-satunya cara punch
"fingerprint" masuk adalah **klien menyatakannya sendiri** lewat API biasa.

Bandingkan dengan dua metode lain pada kebijakan yang sama:

| Metode | Yang memverifikasi |
|---|---|
| `FACE_RECOGNITION` | server: decode gambar, deteksi satu wajah, ekstrak descriptor, cocokkan di server; vector/verdict dari klien ditolak |
| `MOBILE_GPS` | server: geofence per cabang + deteksi mock location (`CONFIRMED_FAKE` ditolak) |
| `FINGERPRINT` | **tidak ada** — nilai enum yang dikirim klien |

Konsekuensinya praktis: cabang yang menyetel kebijakan fingerprint-only karena
menganggapnya paling ketat justru mendapat jalur paling lemah — dan seed demo
ikut menarasikan "Head office menggunakan fingerprint only untuk seluruh
karyawan onsite", sehingga kondisi ini tampak seperti fitur yang berjalan.

Dua jalan keluar, keduanya keputusan:
1. integrasi perangkat sungguhan (mesin mem-posting punch dengan kredensial
   perangkat, atau impor berkala dari mesin), atau
2. hapus `FINGERPRINT` dari kebijakan dan DTO sampai ada integrasinya, supaya
   tidak ada yang mengandalkan jaminan yang tidak ada.

### 🟠 GAP-32 — Tidak ada bukti potong PPh21 tahunan (1721-A1)

Perhitungan PPh21 bulanan sudah sesuai regulasi dan slip gaji tersedia sebagai
PDF, tetapi tidak ada bukti potong tahunan (1721-A1) yang wajib diterima
karyawan. Tidak ada model, endpoint, maupun template untuk itu.

### 🟠 GAP-33 — Tidak ada ekspor pelaporan BPJS / e-Bupot

Tabel referensi BPJS dipakai untuk menghitung iuran, tetapi tidak ada ekspor
laporan bulanan BPJS maupun berkas e-Bupot/SPT. Yang ada hanya ekspor berkas
transfer bank (GAP-12).

### 🟡 GAP-34 — Payroll mono-mata-uang secara desain

`payroll.dto.ts` mengunci `currency: z.literal('IDR')`, dan jalur formula
menolak alokasi non-IDR secara eksplisit. Ini pilihan yang sah untuk payroll
lokal dan lebih baik daripada mendukungnya setengah jalan — tetapi perusahaan
dengan karyawan ekspatriat atau kontrak mata uang asing tidak bisa dilayani, dan
itu belum pernah dicatat sebagai batasan.

### 🟡 GAP-35 — Tidak ada timesheet / pencatatan waktu per proyek

`DailyActivity` mencatat aktivitas harian dengan bukti GPS dan foto, tetapi tidak
ada timesheet per proyek/klien dengan jam billable dan approval — yang dipakai
perusahaan jasa untuk menagih. Tidak ada model proyek sama sekali.

### 🟡 GAP-36 — Pencairan payroll hanya berkas manual, bukan API bank

GAP-12 ditutup dengan ekspor CSV per bank yang bisa diunggah ke internet
banking. Pencairan langsung lewat API bank/payment gateway (beserta rekonsiliasi
status transaksi otomatis) belum ada. Ledger pembayaran dan status transaksinya
sudah siap menampung itu bila kelak diputuskan.

### Yang diperiksa dan ternyata sudah ada

Supaya daftar ini tidak terbaca lebih kosong dari kenyataannya: succession
planning muncul di kode hanya sebagai kata dalam pengklasifikasi teks, bukan
fitur — dan itu memang sudah tercatat di P2 §47 bersama career path dan 9-box,
jadi tidak dihitung sebagai gap baru.

**Total setelah pemeriksaan ini: 36 gap tercatat** — 19 tertutup, 3 sebagian,
14 terbuka (8 lama + 6 baru). Yang paling mendesak dari yang baru adalah GAP-31,
karena satu-satunya yang menjanjikan keamanan yang tidak dimilikinya.
