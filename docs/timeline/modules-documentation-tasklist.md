# 📋 Task Breakdown 22 Modules — Detail Specification Dokumen

> **Purpose**: Task list checklist pembuatan 22 dokumen modul HRIS Enterprise. Setiap modul distandardisasi ke **10-section Template** sama dengan format dokumen Travel & Expenses. Total effort: **~94 jam kerja**.
>
> Referensi Template contoh hasil jadi: [travel-expense-detail.md](file:///Users/f/Documents/sdk-project/hris-draft/.docs/travel-expense-detail.md)

---

## 🧱 Standard Template 10 Section Per Modul

Semua 22 dokumen modul **WAJIB** mengikuti struktur 10 section berikut (copy-paste dari Travel & Expense yang sudah jadi):

| Section | Nama Section | Isi Minimal |
|---|---|---|
| 1 | 📌 Overview + Codebase References | Link file clickable: routes.ts, dto.ts, controller.ts, repository.ts + baris entities di schema.prisma (line #Lxx-Lyy) |
| 2 | 🔐 Role Matrix 7×N | Table ✅❌: SUPER_ADMIN s.d EMPLOYEE × semua operasi di modul (create, read, approve, reject, delete, export) |
| 3 | 🧾 Data Model Entities & Relations | Semua tables Prisma milik modul + 1 diagram relasi ASCII (parent-child, FK, nullable fields, enum types) |
| 4 | 🔄 State Machine per Status Enum | Alur status seperti REQUESTED → APPROVED/REJECTED → COMPLETED + method repository trigger yang mengubah status |
| 5 | 📖 Use Case End-to-End Riil | 5-8 step cerita user journey contoh nyata dengan nominal rupiah / tanggal / nama orang + Prisma operation di tiap step |
| 6 | ✅ Zod DTO Validator List | Semua schema Zod dari file dto.ts + penjelasan field required / optional min/max range enum |
| 7 | 🔌 API Endpoints Table | Semua route dari routes.ts: Method + URL + Middleware Auth/Role + DTO Validator + Deskripsi singkat |
| 8 | 🔗 Integration Antar Modul | Data flow ke modul lain (contoh: loan → payroll deduction, travel claim method PAYROLL → salary component) |
| 9 | ⚠️ Business Rules Gap (5-6 items) | Aturan bisnis yang masih mengandalkan judgment manusia (manual check) — harus di-hardening sebagai validation di service layer |
| 10 | 🎯 TL;DR Flowchart (30 Detik) | Ringkasan 6-8 step end-to-end alur modul dengan symbol arrow ASCII |

---

## 📊 Effort Summary Per Tier Complexity

| Complexity Tier | Jumlah Modul | Effort Rata-rata | Total Jam |
|---|---|---|---|
| 🔴 TIER 1 (Highest) | 6 modul | 8,5 jam / modul | 51 jam |
| 🟡 TIER 2 (Medium) | 8 modul | 4,5 jam / modul | 36 jam |
| 🟢 TIER 3 (Low) | 8 modul | 1,25 jam / modul | 10 jam |
| **TOTAL** | **22 modul** | | **97 jam** + buffer 5% = **~102 jam kerja total** |

---

---

## 🔥🔴 TIER 1: HIGH COMPLEXITY MODULES (6 Modul = 51 Jam)

### TASK T1-01 — 🎖 Performance Management (8 Phase)
- **Estimasi**: 12 jam
- **Codebase**: [performance module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/performance) + 11 migration files phase 1-8 (folder migrations `performance_phase*`)
- **Dependencies**: Tidak ada (standalone)
- **Subtasks Checklist**:
  - [ ] Section 1: Overview + reference files (performance.dto, performance.repository, schema entities `review_cycles s.d performance_periods`)
  - [ ] Section 2: Role Matrix 7 roles × 24 operasi (configure cycle, assign employee, submit self-review, manager review, calibration adjust, publish, dispute appeal)
  - [ ] Section 3: 15+ entities: `review_cycles, performance_periods, performance_period_config_snapshots, review_sections, review_scores, review_cycle_assignments, goals, goal_updates, feedback_requests, feedback_responses, performance_methods, performance_libraries, calibration_sessions, workflows, approval_reopen_notifications` + relasi diagram
  - [ ] Section 4: State Machine per object: ReviewAssignment (DRAFT_ASSIGN → SELF_REVIEW_OPEN → MANAGER_REVIEW → L2_REVIEW → CALIBRATION → PUBLISHED → DISPUTE_WINDOW → FINAL_LOCKED) dan Goals (PLANNED → IN_PROGRESS → CHECKED_IN → COMPLETED)
  - [ ] Section 5: Use Case 9 step: "Perusahaan Q4 Cycle Semester 2: HR setup cycle → 74 employee auto-assign → Budi isi self-review KPI 6 item → Manager Rudi review nilai 3,8 → L2 Dept Head adjust → Calibration session paksa distribusi 10-20-40-20-10 → Publish → Budi dispute nilai → L2 approve penyesuaian 4,0 → Final Lock"
  - [ ] Section 6: Zod DTO list 12+ schema (create cycle, assign employees, submit self review, manager review, calibration update, publish, dispute create, goal update)
  - [ ] Section 7: 20+ API endpoint list: `/cycles`, `/periods`, `/my-review`, `/libraries`, `/planning/:id/goals`, `/execution/:id/check-in`, `/calibration/adjust`, `/publish`, `/dispute`
  - [ ] Section 8: Integration ke Notification (Event 12 jenis per phase), Employee (performance history di tab profile), Payroll (bonus tahunan berdasarkan final rating ≥ 4,5), Reports (bell curve performance by dept)
  - [ ] Section 9: 6 Business Rules gap: (1) Snapshot immutable mid-cycle config tidak boleh berubah, (2) Max 3 adjustment calibration per employee, (3) Dispute window tutup auto 7 hari, (4) Manager tidak bisa review dirinya sendiri (skip self), (5) Bobot KPI vs Competency vs OKR 40:30:30 weighted sum, (6) Bell curve forced 10-20-40-20-10 per departemen min 10 sample
  - [ ] Section 10: TL;DR 9 phase flowchart Config → Libraries → Template → Snapshot → Governance → Planning Cascading → Execution → Calibration + Publish → Dispute → Final Lock
- **✅ Acceptance Criteria**: 9 phase 11 migration + 15 entities tercover semua deskripsi, 1 use case flow cover state changes

---

### TASK T1-02 — 💰 Payroll Engine + Pajak PPh21 & 5 BPJS
- **Estimasi**: 10 jam
- **Codebase**: [payroll module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/payroll)
- **Dependencies**: Employee Salary Components, Attendance (overtime/leave), Loans (cicilan), Travel-Expense (method=PAYROLL), Work Calendar (hari kerja)
- **Subtasks Checklist**:
  - [ ] Section 1: Overview link ke payroll.controller, payroll.service, payroll.validation + entities `payroll_periods, payroll_runs, payslips, payslip_components, employee_salaries, salary_components, employee_salary_components`
  - [ ] Section 2: Role Matrix 7×15 aksi (create periode, calculate, lock run, unlock, generate payslip PDF, export BA, export SPT 1721, reversal)
  - [ ] Section 3: 7 entities payroll + relasi many-to-many ke components, 1 employee punya N salary component type (ALLOWANCE/DEDUCTION/TAX/BPJS)
  - [ ] Section 4: State Machine: PayrollPeriod (DRAFT → DATA_COLLECTION → IN_CALCULATION → REVIEW → LOCKED → PAID → RECONCILED); Payslip (DRAFT → CALCULATED → LOCKED → DISTRIBUTED → VIEWED_BY_EMPLOYEE)
  - [ ] Section 5: Use Case 8 step "Periode November 2024: 1 Nov HR buka period → Tarik data (48 hadir, 2 izin unpaid, 15 lembur total 32 jam, 1 pinjaman cicilan 850rb, 3 reimbursement PAYROLL 2,4jt) → Hitung per 50 employee batch via BullMQ (progress bar 0→100%) → Manager review 2 item anomali gaji > 40jt → Lock → Generate PDF payslip password protected per orang → Generate BA BCA 50 rows → Upload DJP SPT 1721 file 1721 csv → Payment tanggal 25 Nov → Reconcile"
  - [ ] Section 6: Zod DTO 8 schema (create period, run calculate, component add to employee, lock run, reimburse linked claim, export BA, generate SPT, reverse payslip)
  - [ ] Section 7: 18 Endpoints + prefix `/payroll/periods`, `/runs`, `/payslips/:id/pdf`, `/components`, `/exports/ba-bank`, `/exports/spt-1721`
  - [ ] Section 8: Integration: Tarik attendance (hari hadir, telat, overtime minutes), Leave (unpaid cuti days = deduction / tidak dihitung), Loans (installment bulan ini), Travel Expense method PAYROLL → insert allowance component
  - [ ] Section 9: 6 Rules Pajak & BPJS (semua gap harus jadi code formula): (1) PTKP 2024: TK0=54jtk, K0=58,5, K1=63, K2=67,5, K3=72jt/tahun, (2) PKP lapisan 5% lapis 1 ≤60jt, 15% 60-250jt, 25% 250-500jt, 30% >500jt, (3) PPh21 Method Gross vs Net Up, (4) JHT 2% kary + 3,7% per, (5) Jaminan Pensiun 1% kary + 2% per, (6) JKK sliding 0.24 s/d 1.27% berdasarkan golongan risiko industri perusahaan per KEP-101, (7) BPJS Kesehatan 1% + 4% Cap 12.000.000 upah, (8) THR 1 bulan jika ≥ 12 bulan kerja, prorata jika < 12 bulan / masa kerja / 12 x 1 gaji.
  - [ ] Section 10: TL;DR 8 step flowchart end-to-end
- **✅ Acceptance Criteria**: 8 formula pajak/BPJS ditulis jelas exact angka + contoh perhitungan 1 karyawan (gaji 10 jt K/1 = hitung detail PPh21 bruto, BPJS, total deduction, THA bersih ditransfer)

---

### TASK T1-03 — 🏖 Leave Management + Balance Calculation
- **Estimasi**: 8 jam
- **Codebase**: [leave module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/leave)
- **Dependencies**: Work Calendar (holiday + tanggal merah), Attendance (izin = hari tidak hadir), Payroll (cuti unpaid = pro-rate deduction gaji)
- **Subtasks Checklist**:
  - [ ] Section 1: Overview code files leave.routes, leave.dto, leave.repository + entities leave_types, leave_balances, leave_requests table
  - [ ] Section 2: Role Matrix 7×11 (type CRUD, balance read, request, cancel, approve level 1, approve level 2 HR final, reject, list company)
  - [ ] Section 3: 3 entities: types (7 jenis), balances (per tahun per employee per type), requests + approval chain
  - [ ] Section 4: LeaveRequest Status: SUBMITTED → MANAGER_APPROVED → HR_APPROVED/REJECTED → TAKEN/CANCELLED; Balance accrual log
  - [ ] Section 5: Use Case 6 step "Budi join 15 April 2023: akhir tahun pro-rate 246 hari / 365 × 12 = 8,08 hari cuti tahunan (bulatkan floor 8 hari). Budi request 3 hari libur natal tanggal 23-25 Des 2024. Manager approve, HR validasi overlap = tidak ada, balance 8 - 3 = 5 sisa. 1 Jan 2025 reset: 5 + 12 baru = 13, tapi carry over max 1 jadi sisa cuti tahun ini = 1 sisa lama + 12 baru = 13. Budi resign 1 Maret 2025: 59 hari tahun 2025 / 365 × 12 = 1,9 hari = 0 sisa hak cuti dibayar?"
  - [ ] Section 6: Zod DTO 5 schema (type create, request create, approve/reject, cancel, balance edit admin)
  - [ ] Section 7: 11 API endpoints: `/types`, `/my-balances`, `/my-requests`, `/request`, `/:id/approve-level-1`, `/:id/approve-final`, `/:id/reject`, `/:id/cancel`, `/company-requests`, `/export-balances`
  - [ ] Section 8: Integration ke Calendar (hitung tanggal efektif cuti = skip weekend + libur merah), Attendance (auto mark absent hari cuti approved, not late), Payroll (Leave Unpaid = TIDAK ADA balance tersedia tapi tetap ambil = deduct gaji (basic / 22 hari kerja × jumlah unpaid days)), Notifications (pending approvals)
  - [ ] Section 9: 6 Rules bisnis gap: (1) Pro-rate join date hitung floor, (2) Reset balance anniversary join date, (3) Carry over max 1 hari expire 31 Maret tahun berikutnya, (4) Cuti melahirkan 90 hari (full gaji) tidak pakai balance cuti tahunan, (5) Cuti tahunan tidak boleh diambil kurang dari 1 hari berturut-turut kecuali dengan HR Manager approval manual, (6) Race condition 2x request tanggal sama: transaction row-lock `SELECT ... FOR UPDATE` query check overlap saat create
  - [ ] Section 10: TL;DR 7 step Request → Validasi Tanggal Merah + Overlap → Manager Approve → HR Final Approve → Balance Deduct → Tanda Tanggal Tercatat Cuti → Setelah berlalu status = TAKEN
- **✅ Acceptance Criteria**: Contoh perhitungan exact pro-rate 3 skenario (join pertengahan tahun, resign pertengahan, carry over expire)

---

### TASK T1-04 — ⏰ Attendance Management + Overtime Formula
- **Estimasi**: 8 jam
- **Codebase**: [attendance module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/attendance) + branch_attendance_policy, shift_formulas, shift_swap_requests tables
- **Dependencies**: Work Calendar (hari libur), Leave (cuti = auto hadir tidak diperlukan), Employee shift_override, Payroll (deduction keterlambatan, overtime pay allowance)
- **Subtasks Checklist**:
  - [ ] Section 1: Overview files attendance-context.service, attendance.routes, attendance.dto, shift_swap entity
  - [ ] Section 2: Role Matrix 7×14 (clock in/out, import mesin CSV, shift CRUD per company, swap request approve, attendance edit admin, export recap bulanan, policy create per branch)
  - [ ] Section 3: 7 entities: `attendances, branch_attendance_policies, shift_formulas, shift_formula_days, employee_shift_overrides, shift_swap_requests, branch_attendance_settings`
  - [ ] Section 4: Status Attendance (CLOCKED_IN → CLOCKED_OUT = PRESENT; LATE_PARTIAL; EARLY_LEAVE; ABSENT; ON_LEAVE; HOLIDAY_AUTO), ShiftSwap (PENDING → APPROVED/REJECTED → APPLIED)
  - [ ] Section 5: Use Case 7 step "Pabrik Cikarang Shift 3 Malam 23:00-07:00. Karyawan Joko shift formula: Senin-Jumat Pagi, Sabtu ½ hari. Senin 4 Nov 2024: Joko datang 07:18 = late 18 menit → category ≤15? Tidak → 16-30 menit = potong ½ uang makan. Jumat selesai kerja Manager minta lembur 3 jam: 0,5x upah perjam pertama (jam ke-1 lembur), 2x jam 2 dan 3 → total OT Pay = (Rp 5.000.000 / 173 jam kerja efektif) × (1×1,5 + 2×2) = 28.902 × 5,5 = Rp 158.960 bulan ini. Joko ajukan tukar shift Sabtu ke Budi → Manager Approve → Attendance Sabtu Joko TIDAK perlu clock-in (auto mark ON_SWAP)"
  - [ ] Section 6: Zod DTO 8 schema (clock in out GPS coordinates validate, CSV upload import mesin 3 vendor format, shift create per branch, swap request, overtime create, attendance manual create admin, policy edit branch, generate recap bulanan)
  - [ ] Section 7: 16 endpoint list `/clock-in`, `/clock-out`, `/my-attendance/today`, `/branch/:id/recap?month=2024-11`, `/import-machine-csv`, `/shifts`, `/shifts/:id/formula`, `/swaps/request`, `/swaps/:id/approve`, `/overtime`
  - [ ] Section 8: Integration Calendar (libur = auto status HOLIDAY_AUTO tidak perlu clock-in, tidak hitung keterlambatan), Leave (approved cuti = status ON_LEAVE auto deduc hari kehadiran), Payroll (OT Pay = component allowance addition; late >30 menit ½ hari unpaid = deduction, uang makan deduction), Notifications Swap status update
  - [ ] Section 9: 6 Rules UU Ketenagakerjaan: (1) Max lembur 4 jam per hari / 18 jam per minggu, (2) Formula jam kerja 173 jam sebulan (rumus 22 hari × 8 jam = 176 → dikurangi 3 hari libur nasional = 173 rata-rata setahun), (3) Overtime rate UU Pasal 78: jam pertama 1,5, jam berikutnya 2x, lembur hari libur minggu = penuh 2x dari awal, (4) Tk keterlambatan 4 tingkat: 0-15 menit warning, 16-30 menit pot ½ uang makan, 31-60 menit pot 1x uang makan + ½ hari basic, >60 menit 1 hari cuti unpaid, (5) WFH check in valid IP range kantor VPN / selfie GPS + face match, (6) Shift malam allowance 10% basic (00:00-05:00)
  - [ ] Section 10: TL;DR 6 step Clock-In → Validate Branch Policy Check → Kategori Late/OT Calculation → Auto Sync Deduction/Allowance Payroll Component → Monthly Recap Generate → Export
- **✅ Acceptance Criteria**: Contoh kalkulasi lembur exact nominal + upah per jam + keterlambatan 4 tingkat berapa potongan nya

---

### TASK T1-05 — 🔀 No-Code Workflow Engine
- **Estimasi**: 7 jam
- **Codebase**: [workflow-engine module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/workflow-engine)
- **Dependencies**: Semua modul lain (leave, claim, loan, resignation, performance publish) adalah consumer dari workflow instances
- **Subtasks Checklist**:
  - [ ] Section 1: files routes controller repository dto + 9 entities workflow_templates, stages, condition_rules, approver_assignments, instances, instance_steps, instance_logs
  - [ ] Section 2: Role Matrix 7×8 (create template company, edit template, activate/deactivate, instance list all, my inbox approvals, forward task, escalate, force complete)
  - [ ] Section 3: 9 Entities relasi 1 Template = N Stage = N Approver, 1 Instance dijalankan dari Template = N Step (tanggal real time)
  - [ ] Section 4: WorkflowInstance Status: INITIATED → IN_PROGRESS step 1/N → APPROVED → COMPLETED / REJECTED_ANY_STAGE → CANCELLED_BY_INITIATOR; InstanceStep: PENDING → ASSIGNED_TO_USER → ACTION_REQUIRED → APPROVED/REJECTED/ESCALATED → COMPLETED
  - [ ] Section 5: Use Case 5 step "Buat Template 'Approval Pengeluaran Karyawan' untuk Company A: Stage 1: Atasan Langsung → Condition: IF nominal ≤ 500.000 SKIP ke Stage 3, Stage 2: IF nominal > 5.000.000 wajib CFO, Stage 3: Finance verify. SLA Escalation 2 hari auto lempar ke atasan approver. Test case: Karyawan claim 750.000 → Skip Stage 2 → Manager approve → Finance verify → selesai dalam 15 menit"
  - [ ] Section 6: Zod DTO 6 schema (template create, stage add to template, condition rule create, approver assignment dynamic, instance initiate from event, step action approve/reject/escalate)
  - [ ] Section 7: 14 Endpoint `/templates`, `/templates/:id/stages`, `/templates/:id/conditions`, `/inbox/my-pending`, `/instances/:id/timeline`, `/instances/steps/:id/action`
  - [ ] Section 8: Integration dengan SEMUA 5 module consumer (Leave request create → initiate instance; Expense claim → initiate; Loan request → initiate; Resign → initiate; Performance calibration publish → initiate) + EventBus RabbitMQ publish workflow.completed → update claim.status = APPROVED di modul travel-expense leave dll
  - [ ] Section 9: 6 Business Rules: (1) Stage bisa Reject = langsung finish instance REJECTED, (2) All approver vs Any approver mode parallel, (3) Escalation counter SLA deadline 24/48/72 jam configurable, (4) Delegation: Approver bisa assign temporary 2 minggu cuti ke rekan kerja lain, (5) Template published immutable, copy dulu sebelum edit, (6) History immutable instance_logs tidak bisa diedit admin
  - [ ] Section 10: TL;DR 5 step Create Template Builder → Test Simulation → Publish Active → Event Consumer Initiate Instance → Inbox Approve Flow → Complete → Callback Update Consumer Entity Status
- **✅ Acceptance Criteria**: 1 use case 3 nominal berbeda (≤500k skip stage 2, ≤5jt normal, >5jt butuh CFO) melewati stage berbeda

---

### TASK T1-06 — 🚪 Onboarding + Exit Clearance + Career Transactions
- **Estimasi**: 6 jam
- **Codebase**: [onboarding module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/onboarding) + career_transactions entity schema, employee_loans + asset_assignments for clearance
- **Dependencies**: Recruitment (HIRED → create onboarding checklist auto), Asset Management (return barang stage 3), Travel Expense (outstanding advance belum settlement), Payroll (Final Payroll calc pesangon + sisa cuti dibayar)
- **Subtasks Checklist**:
  - [ ] Section 1: Overview files + 5 entities onboarding_checklists, onboarding_task_templates, resignation_requests, exit_clearances, exit_clearance_items, career_transactions
  - [ ] Section 2: Role Matrix 7×13 (checklist task template CRUD per dept, assign PIC, complete task, exit interview, clearance approve 4 departemen, final payroll approve, career transaction create promosi mutasi dengan SK approval lampiran)
  - [ ] Section 3: 6 entities list relasi resignation → exit_clearance → clearance_items (IT/HR/Finance/Dept Head), career_transaction 1:N ke employee
  - [ ] Section 4: State Machine: Resignation (SUBMITTED → EXIT_INTERVIEW_DONE → ASSET_RETURN_PARTIAL → 4_STAGE_CLEARANCE_IN_PROGRESS → HR_FINAL_APPROVED → FINAL_PAYROLL_PROCESSED → COMPLETED); Onboarding (DRAFT_PRE_ONBOARD → DAY_0_READY → IN_PROGRESS_30_DAY → 30-60-90_CHECKPOINT_PASSED → COMPLETED_PROBATION → CONFIRMED)
  - [ ] Section 5: Use Case 6 step Resign: "Karyawan Siti ajukan resign 10 Oktober 2024 dengan alasan Pindah Kerja → notice 30 hari = tanggal terakhir 9 Nov 2024. Exit Interview dengan HR: alasan gaji kurang kompetitif → dicatat feedback anonymously untuk Laporan Attrition. Exit Clearance 4 tahap: (1) Dept Head approve: semua task selesai, (2) IT: laptop Lenovo X1 + charger + dongle USB returned good condition, (3) HR: ID card + kunci lemari, PIN access card, (4) Finance cek: Travel advance Rp 1,2 juta ke Bali yang belum dipertanggungjawabkan = TRUE = tagih Siti Rp 1,2jt dikurangi dari final payroll. Final Payroll Calculate: 9 hari kerja November = pro-rate gaji, Pesangon 0 (resign bukan PHK), Sisa cuti 2 hari = 2 × basic/hari kerja dibayar, DEDUCT: 1,2 juta outstanding travel advance. Tanggal 25 Nov = THA ditransfer bersih + dokumen BPJS pindah + Paklaring"
  - [ ] Section 6: Zod DTO 7 schema (template checklist per departemen, assign PIC, task complete %, exit interview submit, 4 department clearance approve, final payroll calc, career transaction create promosi + attachment SK)
  - [ ] Section 7: 16 endpoint `/checklists/templates`, `/checklists/:id/tasks`, `/my-onboarding/progress`, `/resignations/submit`, `/exit-interview/:id`, `/clearance/:id/department/:dept/approve`, `/clearance/:id/final-payroll`, `/career-transactions`, `/career-transactions/:id/attachment-upload`
  - [ ] Section 8: Integration Recruitment kandidat HIRED → trigger auto generate checklist (IT, HR, Facility tasks dari template dept tujuan). Asset Management untuk stage 3 barang return. Travel Advance outstanding Finance clearance query outstanding belum reconcile milik employee ID = jika ada >0 = status NOT_CLEARED. Payroll Final Payroll component addition (pesangon + sisa cuti dibayar) & deduction (pinjaman unpaid balance + travel advance tagih)
  - [ ] Section 9: 6 Business Rules UU Ketenagakerjaan No 13 Tahun 2003 Pasal 156: (1) Pesangon PHK 1 bulan gaji untuk 1-4 tahun kerja, 2 bulan untuk 5-9 tahun, 3 bulan untuk 10+ tahun, (2) Uang penghargaan masa kerja 12 tahun = 1 bulan gaji, (3) Penggantian hak = sisa cuti tahunan + reimbursement biaya pulang kampung (jika pekerja kontrak), (4) Notice period min 14 hari sebelum masa PKWT habis jika tidak diperpanjang, (5) Career Transaction mutasi = jika lintas company → employee_company_assignments pivot table update + user_company_access auto tambahkan baru, (6) Exit Data Deletion Policy 7 tahun terakhir setelah resign: data PII encrypt archive, tidak delete audit dan performance history.
  - [ ] Section 10: TL;DR 7 step dari Create Checklist Pre-boarding → Day 0 Welcome → Cekpoint 30/60/90 → Konfirmasi Employee Probation → Resignation diajukan → 4 Tahap Exit Clearance → Final Payroll + TH Transfer → Selesai
- **✅ Acceptance Criteria**: 1 contoh perhitungan exact pesangon 3 skenario (PHK 10 tahun kerja, resign 2 tahun, PKWT selesai tidak diperpanjang)

---

---

## 🟡 TIER 2: MEDIUM COMPLEXITY MODULES (8 Modul = 36 Jam)

### TASK T2-07 — 👤 Employee MDM (Master Data) + Validator Indonesia
- **Estimasi**: 5 jam
- **Codebase**: [employee module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee) + [shared/validators/indonesian-identity.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/shared/validators/indonesian-identity.ts) + 8 detail tabs frontend `employee/components/detail-tabs`
- **Subtasks Checklist**:
  - [ ] Section 1: Overview 9 file repository dto + 8 sub-entities education, family, emergency contact, experience, skills, trainings, attachments, career transactions
  - [ ] Section 2: Role Matrix 7×12 (create, read, update basic, update sensitive PII, import CSV, delete, edit salary, read dept own vs all company)
  - [ ] Section 3: 1 employee master + 8 sub 1:N entities
  - [ ] Section 4: Status Enum Employee: PROBATION → ACTIVE → INACTIVE (suspend) → RESIGNED → TERMINATED → RETIRED
  - [ ] Section 5: Use Case Import CSV Batch 5000 data: 3 error baris (NIK 15 digit = invalid, Tanggal lahir 13 tahun = kurang umur, nomor rekening BCA panjang 11 digit = harus 10) → Report error export Excel baris mana error apa, 4997 berhasil diinsert
  - [ ] Section 6: 8 Zod Schema validator (NIK KTP 16 digit parse provinsi/kab/kec/ttl/gender/counter, NPWP 15 old or 16 new nik-derived, BPJS 11/13 digit, Phone E.164 libphonenumber ID, Bank account number per provider, tanggal join > DOB+15 tahun, unique NIK composite companyId)
  - [ ] Section 7: 18 Endpoint CRUD + `/import-csv` + `/export?department_id=x` + `/detail/:id/tabs` 8 endpoints per tab
  - [ ] Section 8: Integration ke Payroll (salary dari employee_salaries), DMS (attachments masuk DMS signed URL), Training (history tab), Performance (history tab), Loans (open pinjaman tab), Travel (trips + claims tab)
  - [ ] Section 9: 5 Rules Gap: (1) NIK Provinsi Code BPS referensi 34 daftar valid, (2) NPWP format 00.000.000.0-000.000 dot separator canonical, (3) Cross DOB Join Date 15 tahun, (4) Nomor rekening bank Luhn check digit Mandiri/BCA, (5) Unique idNumber + companyId prevent duplicate NIK per company, error message user-friendly "NIK 32xxx sudah dipakai employee Maya dengan nomor 028"
  - [ ] Section 10: TL;DR 5 Step: Create Biodata → Save Validator Check Pass/Fail → Isi 8 Sub Entitas (keluarga/pendidikan/darurat/kerja lama/skill/training/lampiran) → Confirm Save → History Log Career

---

### TASK T2-08 — 💳 Employee Loans + Amortisasi Cicilan
- **Estimasi**: 5 jam
- **Codebase**: [employee-loan module](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee-loan)
- **Dependencies**: Payroll deduction (cicilan per bulan auto insert ke component), Employee tenure eligibility
- **Subtasks Checklist**:
  - [ ] Section 1: Overview routes dto repo
  - [ ] Section 2: Role Matrix 7×9 (apply, list all company, approve level manager, approve level HR, approve finance, disbursed BA, settlement pelunasan, default tagih payroll, schedule view)
  - [ ] Section 3: loan_types, loans, loan_installments tables
  - [ ] Section 4: State: REQUESTED → MGR_APPROVED → HR_APPROVED → FINANCE_APPROVED → DISBURSED → IN_REPAYMENT (cicilan X dari N bulan berjalan) → PAID_OFF / DEFAULTED_3X / PREPAID_SETTLED
  - [ ] Section 5: Use Case Pinjaman Pendidikan Rp 30.000.000 tenor 24 bulan flat bunga 6% pa: amortisasi table 24 baris = pokok 1.250.000 + bunga 150.000 = total cicilan per bulan 1.400.000. Auto deduction gaji tanggal 25 setiap bulan ke employee_salary_components loan_installment ID link. Setelah 12 bulan, Karyawan mau bayar pelunasan sisa 18.000.000 pokok tanpa penalty bunga sisa 12 × 150rb = lunas PREPAID_SETTLED
  - [ ] Section 6: Zod 5 schema
  - [ ] Section 7: 12 endpoint
  - [ ] Section 8: Integration payroll monthly deduction, Travel advance tidak lunas menjadi loan otomatis? (opsi future)
  - [ ] Section 9: 6 Rules: (1) Eligibility tenure > 12 bulan (probasi tidak bisa), (2) Max 3x take home pay (plafon), (3) Tidak ada loan lain IN_REPAYMENT dengan outstanding > 50% (kecuali pendidikan), (4) Effective rate vs flat rate perbedaan display admin, (5) 3x berturut-turut tidak bayar = tagih via final payroll jika resign, (6) Denda 0,5% / hari jika lewat tanggal 30 cicilan belum terpotong (gaji nol bulan itu karena unpaid cuti panjang)
  - [ ] Section 10: TL;DR Apply → 3 Approve → Disbursed → Table Amortisasi Dibuat → Deduction Gaji Bulanan → Lunas
- **✅ AC**: Tabel amortisasi 24 baris exact angka

---

### TASK T2-09 — 🏥 Benefits Enrollment (Open Enrollment Period November)
- **Estimasi**: 4 jam
- **Subtasks**: 10 section sama
- **AC**: Contoh kasus Budi K1 status PTKP, BPJS Kesehatan: tanggungan istri + 2 anak = 4 orang covered → kontribusi 4% perusahaan cap 12jt × 4 orang? Tidak cap per hitung orang.

### TASK T2-10 — 🚪 Recruitment ATS Pipeline
- **Estimasi**: 5 jam
- **AC**: 7 stage pipeline dengan 1 kandidat HIRED → otomatis create draft employee + generate onboarding checklist otomatis. Time to hire per stage rata-rata.

### TASK T2-11 — 💻 Asset Management + Depresiasi Akuntansi 4 Metode
- **Estimasi**: 5 jam
- **AC**: Contoh perhitungan depresiasi Laptop Rp 15.000.000 umur ekonomis 4 tahun dengan Straight Line dan Double Declining. Asset Hilang → Calculate Nilai Buku sisa depresiasi 2 tahun = Rp 7.500.000 → Deduction Final Payroll Employee Resign Rp 7.500.000.

### TASK T2-12 — 🗂 DMS + Signed URL Anti IDOR
- **Estimasi**: 4 jam
- **AC**: Contoh signed URL generation HMAC-SHA256 dengan TTL 15 menit. Perhitungan access matrix 4 level untuk document "Kontrak_Kerja_Budi_2024.pdf" (hanya Budi, HR Manager, dan Direktur yang bisa view = 3 orang).

### TASK T2-13 — 📚 Training + Kirkpatrick 4 Level Evaluasi
- **Estimasi**: 4 jam
- **AC**: Use Case Training "K3 General Awareness" 100 karyawan pabrik: Kirkpatrick Level 1 (Reaksi rata-rata 4,5/5), Level 2 (Learning: Pretest 60, Post-test 85 = Δ25 point), Level 3 (Behavior: 3 bulan kemudian Manager survey bahwa prosedur pakai APD meningkat 20%).

### TASK T2-14 — 👮 RBAC System Rules + 74 Permissions Matrix
- **Estimasi**: 4 jam
- **AC**: 7 × 74 Permissions Matrix 518 cells ✅❌ dalam table, rules immutable system roles, custom role scope.

---

## 🟢 TIER 3: LOW COMPLEXITY MODULES (8 Modul = 10 Jam)

*(Setiap modul ~1-1,5 jam karena mostly CRUD tapi tetap wajib 10 section)*

| Task ID | Nama Modul | Estimasi |
|---|---|---|
| T3-15 | 📦 Organization 8 Level Hierarchy + Position Grade (P/M/D) | 1,5 jam |
| T3-16 | 🔐 Auth Security Middleware Chain (12 Step Pipeline) | 1,5 jam |
| T3-17 | 📣 Notification Center Event Bus 40+ Events | 1 jam |
| T3-18 | 🛡 Audit Log Compliance + Integrity SHA256 Hash Anti Tamper | 1,5 jam |
| T3-19 | 📊 Reports Katalog 24 Standard + Dashboard KPI Per Role | 1 jam |
| T3-20 | 📅 Work Calendar Holiday 3 Source (National/Shared/Local) | 1 jam |
| T3-21 | 👥 User Management (Active/Deactivate/Delete Soft) + Multi Company Switcher | 1 jam |
| T3-22 | ⚙️ Admin Settings + Group Policy Enforce Override Children | 1 jam |
| | **Total TIER 3** | **~10 jam** |

---

---

## ✅ Definition of Done (DOD) Checklist Per Dokumen Modul

Setiap dokumen **SELESAI** jika semua checklist ini terpenuhi:

- [ ] Semua 10 Section template terisi (TIDAK ADA yang "TBD" atau section kosong)
- [ ] Section 1 References: Semua link ke file codebase clickable valid (test klik di IDE / preview)
- [ ] Section 2 Role Matrix: Semua operasi CRUD + approve/reject di-cover 7 role sel horizontal ✅❌
- [ ] Section 3 Entities: Semua fields penting di DB (pk, fk, enum, decimal precision) tercantum + relasi diagram ASCII
- [ ] Section 4 State Machine: Untuk setiap status enum, ada trigger method dan kondisi SEBELUM action bisa dijalankan
- [ ] Section 5 Use Case: Minimal 6 langkah dengan nominal / tanggal / nama orang riil
- [ ] Section 6 Zod DTO: Semua schema dari file dto.ts modul tertulis semua (tidak kurang 1)
- [ ] Section 7 API Endpoints: Jumlah endpoint sesuai route.ts (bisa dicocokkan hitung manual GET/POST/PATCH/DELETE count)
- [ ] Section 8 Integration Antar Modul: Minimal 4 link ke modul lain dengan field FK yang tercantum
- [ ] Section 9 Business Rules Gap: Minimal 5 item (jumlah angka, atau formula UU, atau validasi) yang saat ini BELUM diimplementasikan sebagai validasi code = perlu di-hardening
- [ ] Section 10 TL;DR: Ringkasan 6-8 step dengan arrow ASCII flow
- [ ] Final pass: File disimpan dalam folder `.docs/` dengan nama `{module-kebab-case}-detail.md` (contoh: `performance-management-detail.md`, `payroll-engine-detail.md`)
