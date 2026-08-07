# 📅 Timeline Eksekusi Dokumentasi 22 Modul — 14 Minggu (3,5 Bulan)

> **Start Date**: Senin, 12 Agustus 2025 (Week 0) → **Target Selesai**: Jumat, 15 November 2025 (Week 13).
>
> **Asumsi Kapasitas**: 1 orang Technical Writer / Product Documentation, 10 jam kerja per minggu dedicated untuk dokumentasi modul (Total target ~102 jam kerja).
>
> **File Task Detail**: [modules-documentation-tasklist.md](file:///Users/f/Documents/sdk-project/hris-draft/.docs/modules-documentation-tasklist.md) — berisi subtask + AC per modul detail.

---

## 🎯 Key Metrics

| Metric | Target |
|---|---|
| Total Modul | 22 modul backend |
| Total Jam Kerja | ~102 jam (dengan buffer 5% error) |
| Durasi | 14 Minggu efektif |
| Output Standar | 1 file `.md` per modul, 10 section template, min 3000 kata/modul complex |
| Quality Gate | Definition of Done (DOD) 12-point checklist per file |

---

## 🔗 Dependency Graph Antar Modul (Urutan Kerja WAJIB)

Beberapa modul **HARUS** dikerjakan berurutan karena ada referensi integrasi:

```
Tier 1 (Complexity Tertinggi - dikerjakan duluan):
  [Work Calendar 📅]  →  prerequisite for [Leave 🏖] + [Attendance ⏰]
                        ↓
  [Payroll 💰]  ←  depends on: [Leave] + [Attendance] + [Employee Loans 💳] + [Travel Expenses ✅]
                   ↓ prerequisite for
                [Exit Clearance Final Payroll Calculation in Onboarding 🚪]

  [RBAC 👮] → prerequisite for ALL modules (Role Matrix × setiap modul 7 role × N aksi)
  [Auth 🔐] → prerequisite for ALL modules (middleware security references)

Tier 2 (dapat parallel):
  - Recruitment 🚪 → depend on → Onboarding (HIRED → checklist auto generate)
  - Asset 💻 → depend on → Onboarding (Exit Clearance stage 3 asset return)
  - Performance 🎖 → standalone (no hard dependency)
  - Workflow Engine 🔀 → standalone tapi dijadikan referensi alur approval semua modul consumer di Section 8 Integration

Tier 3 (parallel bebas):
  - Notifications 📣, Audit Log 🛡, Reports 📊, Settings ⚙️, Org Structure 📦, Training 📚, DMS 🗂, Users 👥 → all parallelizable
```

---

## 📊 Weekly Capacity Plan (10 Jam / Minggu)

| Minggu | Modul Target | Effort Jam (Est) | Sisa Backlog |
|---|---|---|---|
| Week 0 | Kickoff + Template Finalisasi | 2 jam setup | 22 / 22 modul |
| Week 1 | T1-01 Performance Management (12) | 10 j | 21 |
| Week 2 | T1-02 Payroll Engine (10) | 10 j | 20 |
| Week 3 | T1-03 Leave + T3-20 Work Calendar (8 + 1 = 9) | 10 j | 18 |
| Week 4 | T1-04 Attendance + Overtime (8) | 9 j | 17 |
| Week 5 | T1-05 Workflow Engine (7) + T3-16 Auth Chain (1,5) + T3-21 User Mgmt (1) | 9,5 j | 14 |
| Week 6 | T1-06 Onboarding + Exit Clearance (6) + T3-15 Org Chart (1,5) | 8 j | 12 |
| Week 7 | T2-07 Employee MDM Validator ID (5) + T2-14 RBAC Permissions Matrix (4) | 9 j | 10 |
| Week 8 | T2-08 Employee Loans Amortisasi (5) + T2-12 DMS Signed URL (4) | 9 j | 8 |
| Week 9 | T2-09 Benefits Enrollment (4) + T2-10 Recruitment ATS Pipeline (5) | 9 j | 6 |
| Week 10 | T2-11 Asset Management Depresiasi (5) + T3-17 Notification Center (1) + T3-18 Audit Log (1,5) + T3-22 Admin Settings (1) | 8,5 j | 2 |
| Week 11 | T2-13 Training Kirkpatrick (4) + T3-19 Reports Dashboard KPI (1) + Quality Review Week 1-10 (5 j revisi & feedback PM/Client) | 10 j | 1 |
| Week 12 | **Buffer + Polish Week** — Semua gap revisi, tambah example missing, 1 final check DOD 22 modul | 10 j | 0 Backlog |
| Week 13 | Handover, Final Review All 24 File `.docs/` + Index readme summary | 8 j | ✅ DONE 24/24 |

---

---

## 📆 Minggu per Minggu Timeline Detail + Checklist

---

### 🌱 WEEK 0 — Senin 12/8/2025 s/d Jumat 16/8/2025
**Tema**: Kickoff & Standardisasi Template

| Task ID | Deskripsi | PIC | Status Checkbox |
|---|---|---|---|
| W0-1 | Final review 10-section Standard Template dari file travel-expense-detail.md contoh jadi | Writer + PM | [ ] |
| W0-2 | Final review 12-point Definition of Done di file tasklist page terakhir | Writer + QA | [ ] |
| W0-3 | Buat folder `/docs/modules/` subfolder untuk simpan 22 files modul terpisah dari overview docs | Ops | [ ] |
| W0-4 | Cross-check 22 modul files exist di codebase (routes + repo + entities ada?) — pastikan tidak ada modul typo | Writer | [ ] |
| W0-5 | Setup dokumentasi version control: branch `docs/all-22-modules` dari main, commit per modul | DevOps | [ ] |

**🚩 Milestone W0**: Template ✔ 100%, Backlog ready 22 modul siap dikerjakan.
**Output**: `modules-documentation-tasklist.md` + `modules-documentation-roadmap.md` disetujui PM.

---

### 🔥 WEEK 1 — 18/8 s/d 24/8
**Modul**: 🎖 **Performance Management (Phase 1-8)**
- Effort: 12 jam / priority Tertinggi
- Dependency: Tidak ada (standalone)

| Subtask (dari file tasklist T1-01) | Status |
|---|---|
| S1 Overview + References 15 entities phase 1-8 migration | [ ] |
| S2 Role Matrix 7 × 24 operasi modul | [ ] |
| S3 Data Model 15 entities relation diagram | [ ] |
| S4 State Machine ReviewAssignment + Goals status enum | [ ] |
| S5 Use Case Q4 Semester 2 Budi 9 step end-to-end | [ ] |
| S6 Zod DTO 12 schema list | [ ] |
| S7 API 20+ endpoints list | [ ] |
| S8 Integration ke Notification + Employee Payroll Reports | [ ] |
| S9 Business Rules Gap 6 items Snapshot immutable, bell curve forced distribusi | [ ] |
| S10 TL;DR 9 phase flowchart | [ ] |
| Final DOD Check (12 points page terakhir tasklist.md) | [ ] |

🚩 Milestone W1: **Modul Performance selesai 10 section + DOD pass**

---

### 🔥 WEEK 2 — 25/8 s/d 31/8
**Modul**: 💰 **Payroll Engine + PPh21 & 5 BPJS Formula**
- Effort: 10 jam
- Dependency: butuh referensi modul Leave, Attendance, Loans nanti ditambahkan di Section 8 Integration (placeholder link dulu)

| Subtask T1-02 | Status |
|---|---|
| S1 Overview files + 7 entities payroll | [ ] |
| S2 Role Matrix 7 × 15 | [ ] |
| S3 7 entities + employee_salary_components 1:M | [ ] |
| S4 Period State + Payslip status enums | [ ] |
| S5 Use Case Periode November 2024: 8 step dengan 50 employee BullMQ chunk 50 progress 0-100% | [ ] |
| S6 Zod 8 DTO | [ ] |
| S7 18 Endpoints + PDF Payslip, Export BA, SPT 1721 | [ ] |
| S8 Section 8: Integration tarik Attendance/Loans/Leave + Travel Expense Method PAYROLL (placeholder, link isi nanti Week 3/4/8) | [ ] |
| S9 Business Rules 8 items exact formula PPh21 2024 PTKP TK0-K3 + 5 BPJS ratio THA calculation example karyawan gaji 10jt K/1 | [ ] |
| S10 TL;DR Flowchart | [ ] |
| DOD Final Pass | [ ] |

🚩 Milestone W2: **Payroll Formula Exact + Contoh THA Hitung Manual Cocok 100%**

---

### 🔥 WEEK 3 — 1/9 s/d 7/9
**Modul**: 🏖 **Leave Balance Calc** (8j) + 📅 **Work Calendar** (1j = quick win done duluan karena simple)
- Dependency: Work Calendar prerequisite Week 3.
- Total: 9 jam (sisa 1j buffer untuk review W2 revisi)

| Subtask T1-03 Leave + T3-20 Calendar | Status |
|---|---|
| Calendar: S1-S10 quick win (Holiday 3 source National/Company/Local branch) | [ ] ✅ cepat |
| Leave S1 Overview files entity types/balances/requests | [ ] |
| Leave S2 Role Matrix | [ ] |
| Leave S3 3 entities + Balance accrual log | [ ] |
| Leave S4 State machine approval | [ ] |
| Leave S5 Use Case Budi join 15 April 2024 pro-rate balance 3 scenario exact | [ ] |
| Leave S6 5 Zod schema | [ ] |
| Leave S7 11 Endpoints | [ ] |
| Leave S8 Integration Calendar skip holiday/weekend effective days, Payroll unpaid deduction | [ ] |
| Leave S9 6 Rules: Carry over, Resign Prorate, Unpaid, Race condition overlap | [ ] |
| Leave S10 TL;DR | [ ] |
| 2x DOD Pass | [ ] |

🚩 Milestone W3: **Leave Pro-Rate 3 Scentario (Join Pertengahan/Resign/Carry Over) Ter-Validasi**

---

### 🔥 WEEK 4 — 8/9 s/d 14/9
**Modul**: ⏰ **Attendance Management + Overtime Formula UU + Shift Swap**
- Effort: 8 jam
- Dependency: Butuh Work Calendar (Week3 Selesai ✔) → integration Section 8 reference sudah bisa diisi riil bukan placeholder

| Subtask T1-04 | Status |
|---|---|
| S1 Overview 7 entities shift/swap/override branch policy | [ ] |
| S2 Role Matrix 7×14 | [ ] |
| S3 7 entities ASCII diagram | [ ] |
| S4 Attendance state machine + ShiftSwap Pending/Approved/Applied | [ ] |
| S5 Use Case 7 step Pabrik Cikarang 3 shift, OT 3 jam exact calculation nominal Rp | [ ] |
| S6 8 Zod Schema | [ ] |
| S7 16 Endpoint (clock in/out, CSV import mesin, swap) | [ ] |
| S8 Integration Calendar, Leave Approved → ON_LEAVE status → Payroll Deduction/Allowance OT Pay component | [ ] |
| S9 6 Rules UU Pasal 78: Max 4 jam/day / 18 jam/minggu + 4 tier keterlambatan | [ ] |
| S10 TL;DR | [ ] |
| DOD Pass | [ ] |

🚩 Milestone W4: **Tier 1 6 Modul (Performance/Payroll/Leave/Calendar/Attendance) 5/6 selesai**

---

### 🔥 WEEK 5 — 15/9 s/d 21/9
**Modul**: 🔀 **No-Code Workflow Engine** (7j) + 🔐 **Auth Middleware Chain** (1.5j) + 👥 **User Management** (1j)
- Total Effort: 9,5 jam
- Dependency: Auth & User = prerequisite untuk semua modul Role Matrix

| Subtasks T1-05, T3-16, T3-21 | Status |
|---|---|
| Workflow S1-S10 (7j) 9 entities + Builder UI concept + Condition Rule percabangan IF nominal > 5jt → stage CFO | [ ] |
| Auth S1-S10 (1.5j) 12 step pipeline + JWT refresh rotate + CSRF double cookie + Rate Limit 2 level | [ ] |
| User Mgmt S1-S10 (1j) Active/Deactivate/Soft-delete + user_company_access pivot multi company switcher | [ ] |
| 3 × DOD Pass review | [ ] |

🚩 Milestone W5: **Tier 1 COMPLETE 6/6 modul + TIER3 basic security modul selesai. Backlog tersisa 14 modul.**

---

### 🔥 WEEK 6 — 22/9 s/d 28/9
**Modul**: 🚪 **Onboarding + Exit Clearance + Career Transactions** (6j) + 📦 **Org Structure 8 Level** (1.5j)
- Effort Total: 7.5 + 1j buffer review W5 = 8.5 jam
- Dependency: Recruitment (Week 9) akan refer back ke sini

| Subtasks T1-06, T3-15 | Status |
|---|---|
| Onboarding/Exit S1-S10 (6j) 6 entities + Use Case Resign 6 step perhitungan pesangon exact 3 case UU Pasal 156 No.13 2003 | [ ] |
| Org Structure S1-S10 (1.5j) Group→Company→Branch→Div→Dept→SubDept→Position→Employee 8 level hierarchy, Position grading P/M/D, org chart adjacency list recursive | [ ] |
| 2 × DOD Pass | [ ] |

🚩 Milestone W6: **SEMUA TIER 1 (6 modul) COMPLETED + 2 Tier3 = 8/22. 14 Modul sisa Tier 2 + Tier 3.**

---

### 🔥 WEEK 7 — 29/9 s/d 5/10
**Modul**: 👤 **Employee MDM** (5j) + 👮 **RBAC Permissions Matrix 74×7** (4j)
- Effort Total: 9 jam
- Dependency: Employee = core entity semua modul refer di section 8; RBAC = semua role matrix bisa cross-check.

| Subtasks T2-07, T2-14 | Status |
|---|---|
| Employee S1-S10 Validator Indonesia NIK parse BPS 34 provinsi, NPWP format, BPJS, Phone E.164, Bank account Luhn check, 8 sub entities education/family/emergency/experience/skills/trainings/attachments/career use case Import CSV 5000 row error report 3 invalid baris | [ ] |
| RBAC S1-S10 System roles immutable rules (HARD CONSTITUTION), Custom role scope immutable companyId/groupId, Seed Idempotent rules, 7×74 table 518 cell ✅❌ FULL PERMISSION MATRIX | [ ] |
| 2 × DOD Pass | [ ] |

🚩 Milestone W7: **Tier 2 Mulai. Core HR Data + Security Matrix lengkap = referensi semua modul ada.**

---

### 🔥 WEEK 8 — 6/10 s/d 12/10
**Modul**: 💳 **Employee Loans + Amortisasi Table** (5j) + 🗂 **DMS Signed URL** (4j)
- Effort: 9 jam
- Dependency: Loan → reference Payroll Week2 (Deduction component integration)

| Subtasks T2-08, T2-12 | Status |
|---|---|
| Loans S1-S10 (5j): Eligibility tenure check 12 bulan, Amortisasi 24 baris table Pinjaman 30jt 6% flat 24 bln exact pokok+bunga+total+sisa, State Machine 6 status → Integration Payroll Deduction Monthly auto-component link ID | [ ] |
| DMS S1-S10 (4j): 4 Level ACL Access Matrix per dokumen, Digital Signature Counter 3 pihak kontrak, Versioning v1.x, Signed URL HMAC TTL 15 menit anti IDOR, Retensi 7 tahun, Audit Access immutable | [ ] |
| 2 × DOD Pass | [ ] |

🚩 Milestone W8: **4/8 Tier 2 selesai. 4 Tier 2 + 8 Tier3 = 12 sisa.**

---

### 🔥 WEEK 9 — 13/10 s/d 19/10
**Modul**: 🏥 **Benefits Enrollment** (4j) + 🚪 **Recruitment ATS Pipeline** (5j)
- Effort: 9 jam
- Dependency: ATS Pipeline → refer ke Onboarding Week6 (HIRED → auto checklist trigger)

| Subtasks T2-09, T2-10 | Status |
|---|---|
| Benefits S1-S10 6 Kategori BPJS/Asuransi Jiwa/Kesehatan Swasta/THR 1 bulan prorata calculation, Kendaraan Dinas, Tunjangan Pendidikan, Open Enrollment Nov 1 bulan window, BPJS Kesehatan ratio 1% + 4% cap upah 12jt example | [ ] |
| Recruitment S1-S10 7 stage Pipeline NEW→SCREEN→HR INT→USER INT→TEST→OFFER→HIRED, Scorecard interviewer penilaian kriteria, Auto sync Hired → Employee Draft + Onboarding checklist auto-generated, Time-to-Hire rata-rata per dept report | [ ] |
| 2 × DOD Pass | [ ] |

🚩 Milestone W9: **Tier 2 = 6/8 selesai**

---

### 🔥 WEEK 10 — 20/10 s/d 26/10
**Modul**: 💻 **Asset Management Depresiasi** (5j) + 📣 **Notification** (1j) + 🛡 **Audit Log** (1.5j) + ⚙️ **Settings Group Policy** (1j)
- Effort: 8.5 jam
- Dependency: Asset → refer Exit Clearance Week6 Stage 3 Return Barang

| Subtasks T2-11, T3-17,18,22 | Status |
|---|---|
| Asset S1-S10 (5j): 4 Metode Depresiasi Straight Line example Laptop 15jt 4 tahun = penyusutan per tahun Rp 3,75jt Nilai Buku. Assignment tanda tangan digital. Return barang hilang → sisa nilai buku 2 tahun = 7.5jt deduction final payroll saat resign | [ ] |
| Notification S1-S10 (1j quick) 40+ domain events list, BullMQ queue fan-out bulk notify 500 employee dalam chunk | [ ] |
| Audit Log S1-S10 (1.5j): Old/New JSON diff, sensitive field PII mask exclude gaji password, SHA256 hash tiap entry integrity anti tamper, Retensi 7 tahun, Export CSV filter by date range actor entity | [ ] |
| Settings S1-S10 (1j quick): Parameter company level list 12 item, Group ENFORCE_TO_ALL_CHILD flag override child company tidak bisa edit | [ ] |
| 4 × DOD Pass | [ ] |

🚩 Milestone W10: **TIER 2 7/8 = hampir selesai. Cuma T2-13 Training Kirkpatrick tersisa.**
**Backlog Tersisa = T2-13 Training (4j) + T3-19 Reports (1j) = 2 modul tertinggal + Quality Review.**

---

### 🔥 WEEK 11 — 27/10 s/d 2/11
**Modul**: T2-13 **Training Kirkpatrick 4 Level** (4j) + T3-19 **Reports Dashboard KPI** (1j) + **Revisi & Feedback 10 minggu pertama Quality Review Loop 22 file (5j)**
- Effort: 10 jam full

| Subtasks | Status |
|---|---|
| Training S1-S10 (4j) 8 step lifecycle TNA→Budget→Course→Enroll→Attendance QR→Feedback L1 Reaction 1-5, L2 Pretest/Post-test Δscore, L3 3 bulan survey Manager behavior, L4 ROI business impact (future), Certificate PDF 80% attendance + pass 70 score | [ ] |
| Reports S1-S10 (1j quick) Katalog 24 standard reports list, 4 role Dashboard layouts berbeda (Super Admin vs HR vs Manager vs Employee), Excel xlsx styling, PDF portrait landscape company logo header | [ ] |
| **Quality Review Pass 1**: Review semua file 20 modul Week1-10 berdasarkan DOD checklist — isi yang kosong section placeholder Integration yang belum lengkap (link Payroll ← Loans ↔ Week8 sudah beres sekarang isi actual bukan placeholder) | [ ] |
| Feedback Loop 1 round dengan PM: Revisi 10% content perbaikan typo, format table, link clickable broken | [ ] |

🚩 Milestone W11: **SEMUA 22 MODUL DOKUMEN SELESAI DRAFT. Backlog 0 / 22. 100% complete draft.**

---

### ⚙️ WEEK 12 — 3/11 s/d 9/11 — **Buffer Polish & Final Quality Gate 2 Pass**
| Task | Status |
|---|---|
| Polish Pass 1: Semua 22 dokumen → styling heading konsisten H1-H5, spacing paragraph, alignment ASCII diagram, checkbox seragam | [ ] |
| Polish Pass 2: Cross-reference semua Section 8 Integration antar modul — tiap modul referensi modul lain link absolute clickable benar | [ ] |
| Final DOD Checklist 22 × 12 items = 264 checkboxes total, validate no "TBD" / section blank | [ ] |
| Client / Stakeholder Review 1 putaran → catat Revisi minor | [ ] |
| Apply Revisi minor round feedback | [ ] |

🚩 Milestone W12: **Quality Gate DONE 264/264 DOD checklist PASS.**

---

### 🚀 WEEK 13 — 10/11 s/d 15/11 — **Handover Week**
| Task | Status |
|---|---|
| Merge branch `docs/all-22-modules` → Pull Request → Code Review 1 round → Merge ke Main | [ ] |
| Buat **Index Dokumen** file `.docs/README.md` — list 24 dokumen (overview portal, travel, + 22 modul detail) dengan deskripsi 1 kalimat per file, hyperlink clickable ke semua file .md | [ ] |
| Handover session ke Product Team + Technical Team — presentasi ringkasan 15 menit: struktur dokumen, cara menemukan formula PPh21/BPJS di file payroll, cara gunakan Permission Matrix 518 cells | [ ] |
| Upload handoff ke knowledge base Notion / Confluence jika diperlukan | [ ] |
| Rapat closing + Retrospective: 3 hal baik, 3 hal improvement untuk dokumentasi kedepannya | [ ] |

🏆 **FINAL MILESTONE W13**: **DOKUMENTASI 22 MODUL + 2 OVERVIEW = 24 FILE SIAP PRODUKSI 🎉**

---

---

## 🚩 7 Milestone Utama (Report ke Stakeholder)

Report progress setiap 2 minggu sekali ke manajemen / klien dengan status milestone berikut:

| # | Tanggal Target | Milestone | KPI Sukses | Status |
|---|---|---|---|---|
| M1 | Jumat W2 (31/8) | Performance + Payroll Dokumentasi Formula exact valid | Contoh hitung PPh21 BPJS 1 karyawan 10jt K/1 = match hitung manual 100% | [ ] |
| M2 | Jumat W4 (14/9) | SEMUA TIER 1 6 Modul Complexity Tertinggi Selesai | 6/6 Tier 1 DOD Pass = 27% total progress dokumentasi | [ ] |
| M3 | Jumat W6 (28/9) | Core HR Sistem Selesai: Employee + RBAC + Onboarding/Exit + Auth | Employee MDM NIK NPWP BPJS validator + 518 cell RBAC Permission Matrix complete | [ ] |
| M4 | Jumat W8 (12/10) | Finansial Modul Selesai: Payroll + Loans + Asset + Travel | 4 Modul flow uang end-to-end ter dokumentasi: request → approve → pencairan → laporan | [ ] |
| M5 | Jumat W10 (26/10) | 20/22 Modul Draft Selesai | 90% Backlog Clear | [ ] |
| M6 | Jumat W11 (2/11) | 100% 22 Modul Draft Selesai + Quality Review Pass 1 | 22 × DOD 12 points PASS 100% tanpa TBD | [ ] |
| M7 | Jumat W13 (15/11) | HANDOVER SELESAI + Index Readme | Semua stakeholder bisa temukan dokumen dengan click dari .docs/README.md | [ ] |

---

## 📊 Progress Tracking Template (Copy Paste Weekly Standup)

Setiap hari Jumat sore, isi progress update ini:

```
Week ke-3 / Tanggal 7 September 2025
=====================================

✅ DONE Minggu Ini:
  - Leave Management: 10/10 sections (S1-S10) + DOD Pass 12/12 check
  - Work Calendar: Quick Win Completed S1-S10
  - Total File Selesai = 5 (W1 Performance, W2 Payroll, W3 Leave + Calendar + W0 Overview) → 5/22 = 23%

🔧 IN PROGRESS (50%):
  - Attendance Management (Week4): S1-S4 selesai, S5 use case otw

⏳ NEXT Minggu:
  - Selesaikan Attendance (S5 use case pabrik shift + hitung OT exact Rp)
  - Mulai Workflow Engine (Week5)

⚠️ Blocker / Risk:
  - Rumus perhitungan overtime shift malam 10% allowance butuh konfirmasi ke HR stakeholder apakah default 10% atau company parameter. Schedule meeting Senin depan jam 10 pagi dengan pak Arief Senior HR Manager.

📈 Overall Progress: 23%
```

---

## ✅ Final File List Setelah 14 Minggu (Total 24 Files di Folder `.docs/`)

| # | Nama File | Modul |
|---|---|---|
| 1 | `portal.md` | ✅ SUDAH ADA — All overview product brief |
| 2 | `travel-expense-detail.md` | ✅ SUDAH ADA — Modul Travel & Expenses (contoh template) |
| 3 | `performance-management-detail.md` | Week1 |
| 4 | `payroll-engine-detail.md` | Week2 |
| 5 | `leave-management-detail.md` | Week3 |
| 6 | `work-calendar-detail.md` | Week3 |
| 7 | `attendance-management-detail.md` | Week4 |
| 8 | `workflow-engine-detail.md` | Week5 |
| 9 | `auth-security-pipeline-detail.md` | Week5 |
| 10 | `user-management-detail.md` | Week5 |
| 11 | `onboarding-exit-clearance-detail.md` | Week6 |
| 12 | `organization-structure-detail.md` | Week6 |
| 13 | `employee-mdm-validator-detail.md` | Week7 |
| 14 | `rbac-permission-matrix-detail.md` | Week7 |
| 15 | `employee-loans-amortization-detail.md` | Week8 |
| 16 | `document-management-detail.md` | Week8 |
| 17 | `benefits-enrollment-detail.md` | Week9 |
| 18 | `recruitment-ats-detail.md` | Week9 |
| 19 | `asset-management-depreciation-detail.md` | Week10 |
| 20 | `notification-center-detail.md` | Week10 |
| 21 | `audit-log-compliance-detail.md` | Week10 |
| 22 | `admin-settings-policy-detail.md` | Week10 |
| 23 | `training-development-kirkpatrick-detail.md` | Week11 |
| 24 | `reports-dashboard-kpi-detail.md` | Week11 |
| 25 | `README.md` (W13 — Index file semua dokumen) | Week13 |
