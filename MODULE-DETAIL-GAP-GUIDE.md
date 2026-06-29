# HRMS Module Detail Gap Guide

> Pedoman untuk mendetailkan setiap modul HRMS berdasarkan `prd.md`, `fix-prd.md`, dan `HRMS-PROJECT-TASKS.md`
> Status: draft kerja
> Tanggal: 2026-06-28

---

## 1. Tujuan Dokumen

Dokumen ini dibuat untuk menjawab gap yang saat ini masih terasa di project:

- Banyak modul sudah punya daftar fitur, schema, dan endpoint, tetapi belum cukup detail pada level alur operasional, edge case, validasi, dan perilaku UI.
- Beberapa modul secara status task terlihat "selesai", tetapi implementasi di frontend masih ada placeholder, route belum tersambung, atau flow approval belum benar-benar end-to-end.
- Beberapa kebutuhan lintas modul seperti company scope, role visibility, workflow approval, seed data, notifikasi, audit log, dan bilingual belum terdokumentasi konsisten per modul.

Dokumen ini dipakai sebagai:

- checklist detail minimum yang wajib ada di tiap modul
- peta gap per modul yang masih perlu diperdalam
- dasar membuat dokumen turunan per modul
- acuan refinement backlog sebelum implementasi lanjutan

---

## 2. Cara Pakai

Untuk setiap modul, jangan berhenti di level "fitur ada" atau "endpoint tersedia". Modul dianggap cukup detail bila minimal sudah menjawab:

1. masalah bisnis apa yang diselesaikan
2. siapa aktor dan role yang boleh mengakses
3. alur utama dari submit sampai selesai
4. alur gagal, ditolak, dibatalkan, diubah, expired, atau konflik
5. data apa yang wajib diisi dan apa validasinya
6. status apa saja yang mungkin muncul
7. integrasi ke modul lain seperti apa
8. bentuk UI, empty state, loading state, error state, dan feedback user
9. approval, notifikasi, audit log, dan reporting-nya bagaimana
10. perilaku multi-company / company-group / RBAC / scope akses-nya bagaimana

---

## 3. Standar Detail Minimum Tiap Modul

Setiap dokumen modul disarankan minimal punya 16 bagian di bawah ini:

### 3.1 Ringkasan Modul

- tujuan bisnis
- KPI atau hasil yang diharapkan
- dependency ke modul lain

### 3.2 Aktor dan Hak Akses

- role yang bisa view / create / approve / export / configure
- pembatasan data per company, branch, department, group
- menu apa yang tampil atau tidak tampil per role

### 3.3 Entitas dan Data Utama

- daftar entity
- field penting
- relasi antar tabel/model
- field yang sensitif

### 3.4 Status dan State Machine

- status record
- transisi status yang valid
- siapa yang boleh mengubah status
- kapan status terkunci

### 3.5 Alur Utama

- langkah user
- respons sistem
- perubahan data
- notifikasi yang dikirim

### 3.6 Alur Alternatif dan Exception

- reject
- cancel
- revise
- duplicate
- expired
- conflict
- fallback bila dependency gagal

### 3.7 Validasi dan Business Rules

- field wajib
- rule tanggal/periode
- rule nominal / limit / kuota
- rule company scope
- rule approval

### 3.8 UI/UX Detail

- list page
- detail page
- create/edit form
- filter/search/sort
- pagination
- modal/dialog
- toast/alert/error banner
- empty state
- skeleton/loading state

### 3.9 API dan Error Contract

- endpoint
- payload request
- response shape
- error yang mungkin muncul
- retry atau recovery strategy

### 3.10 Approval dan Workflow

- apakah modul pakai approval
- actor approver
- SLA
- escalation
- backup approver
- kondisi rule-based

### 3.11 Notification dan Reminder

- event yang memicu notifikasi
- channel: in-app/email/push
- siapa penerimanya
- kapan reminder dikirim

### 3.12 Audit dan Compliance

- aksi apa saja yang wajib tercatat
- data sensitif apa yang perlu proteksi khusus
- dokumen/legal evidence apa yang harus disimpan

### 3.13 Reporting dan Dashboard

- metrik yang ditampilkan
- export yang dibutuhkan
- filter yang dibutuhkan
- agregasi per company/group

### 3.14 Seed dan Demo Scenario

- data demo minimum agar halaman tidak kosong
- skenario happy path
- skenario reject path
- data historis minimum

### 3.15 Open Questions

- aturan bisnis yang belum pasti
- keputusan product yang masih perlu owner approval
- dependency regulasi / kebijakan perusahaan

### 3.16 Definition of Done

- backend selesai
- frontend selesai
- route tersambung
- permission benar
- seed tampil di UI
- placeholder hilang
- diagnostics bersih

---

## 4. Prioritas Pendetailan

### P1 - Harus Didetailkan Dulu

Modul-modul ini paling berisiko karena langsung mempengaruhi UX, approval, dokumen, atau proses bisnis inti:

- `6.24 Document Management System`
- `6.20 Travel & Expense Claim`
- `6.23 Workflow Engine` sebagai engine lintas modul, terutama integrasi ke leave, loan, self service, expense
- `6.8 Self Service Request`
- `6.9 Payroll`
- `6.1 Authentication & Authorization`
- `6.3 Organization Structure`

### P2 - Perlu Pendalaman Operasional

- `6.2 Master Employee`
- `6.5 Work Calendar`
- `6.6 Attendance`
- `6.7 Leave Management`
- `6.14 Recruitment & ATS`
- `6.15 Onboarding & Offboarding`
- `6.16 Asset Management`
- `6.18 Compensation & Benefit`
- `6.19 Employee Loan`

### P3 - Perlu Pendalaman Strategis dan Cross-Module

- `6.10 Performance Management`
- `6.11 Dashboard & Reporting`
- `6.12 Notification & Alert`
- `6.13 Audit Log`
- `6.17 LMS`
- `6.21 Talent & Succession`
- `6.22 Employee Engagement`
- `6.25 Integration Hub`
- `6.26 Policy & Compliance`
- `6.27 Disciplinary Action`
- `6.28 Workforce Planning & Budgeting`

---

## 5. Gap Umum yang Muncul di Banyak Modul

Sebelum melihat modul satu per satu, ada gap berulang yang muncul hampir di seluruh sistem:

- detail role vs menu vs route vs API belum selalu sinkron
- belum semua create/edit flow punya form frontend yang benar-benar jalan
- beberapa tombol masih placeholder atau baru memberi toast
- belum semua approval flow disambungkan ke `Workflow Engine`
- belum semua modul punya empty state, loading state, dan error state yang jelas
- belum semua modul punya detail notification trigger
- belum semua modul punya audit rule yang tegas
- belum semua modul mendetailkan behavior untuk company group / multi-company
- belum semua modul mendetailkan seed scenario agar data benar-benar muncul di UI
- belum semua modul punya acceptance criteria yang bisa dites

---

## 6. Gap Per Modul

Bagian ini menjelaskan apa saja yang masih perlu didetailkan pada tiap modul.

### 6.1 Authentication & Authorization

Perlu didetailkan:

- matrix role ke menu, route, API permission, dan fallback permission code lama vs baru
- alur login multi-company: kapan company switcher muncul, bagaimana company aktif dipilih, kapan local storage di-sync
- token contract final: claim wajib (`roles`, `permissions`, `companyId`, `groupId`, `company_scope[]`)
- skenario session expiry, refresh token gagal, forced logout, dan device/session management
- detail forgot/reset password, OTP, 2FA, lockout, dan audit event per skenario

### 6.2 Master Employee

Perlu didetailkan:

- pembagian field mana yang editable oleh HR Staff, HR Manager, Manager, dan Employee
- approval flow untuk perubahan data sensitif seperti gaji, bank, NPWP, status kerja
- struktur riwayat mutasi, promosi, demosi, transfer company, dan secondment
- detail upload dokumen employee dan kaitannya ke DMS
- import/export rule, mapping CSV/Excel, dan error report row-by-row

### 6.3 Organization Structure

Perlu didetailkan:

- aturan lengkap company group, company, branch, division, department, sub-department, position
- rules untuk active/inactive, merge/split department, dan perubahan struktur yang sudah dipakai employee aktif
- ownership data per company dan efeknya ke seluruh query/filter
- org chart behavior untuk group view vs company view
- batasan CRUD agar tidak merusak referensi payroll, employee, workflow, dan approval chain

### 6.4 Shift Management

Perlu didetailkan:

- tipe shift dan rule masing-masing: fixed, flexi, rotating, split
- algoritma assignment shift per individu, tim, dan bulk
- aturan tukar shift, override shift, dan perubahan shift yang sudah berjalan
- keterkaitan shift ke overtime, grace period, late, early out
- tampilan jadwal mingguan/bulanan dan conflict detection

### 6.5 Work Calendar

Perlu didetailkan:

- hierarki override calendar dari group sampai employee
- perbedaan `WD`, `WS`, `WE`, `NH`, `JL`, `CH`, `RH`, `OT` pada behavior sistem
- lock period setelah payroll final dan dampaknya ke update calendar
- detail team calendar, employee calendar, export iCal/PDF/Excel, dan holiday import
- skenario konflik cuti massal, notifikasi H-7, dan overlay shift/attendance/leave

### 6.6 Attendance

Perlu didetailkan:

- seluruh mode absensi: mobile GPS, QR, manual, face recognition, offline sync
- validasi geofence, selfie, late tolerance, overtime, duplicate check-in
- rule koreksi absensi dan approval chain-nya
- hubungan attendance ke work calendar, leave, self service, payroll, dan disciplinary action
- UI check-in/check-out, overtime, correction, anomaly alert, dan supervisor view

### 6.7 Leave Management

Perlu didetailkan:

- jenis cuti, kuota, carry-over, pro-rate, dan rule per status karyawan
- state machine request dari draft sampai approved/rejected/cancelled
- validasi konflik dengan team calendar, blackout period, dan notice period
- approval by leave type, by employee level, by duration, dan by company
- halaman admin approval, leave stats, leave balance history, dan reporting detail

### 6.8 Self Service Request

Perlu didetailkan:

- daftar request type final: izin, sakit, on duty, koreksi absensi, lembur, shift swap, dokumen
- per type: field form, attachment rule, validator, approver, SLA, dan status
- pemisahan request employee self vs manager approval queue
- kapan request update modul target secara otomatis dan kapan harus menunggu approval final
- desain dashboard self-service agar bukan cuma tab list, tapi benar-benar end-to-end

### 6.9 Payroll

Perlu didetailkan:

- formula payroll rinci per komponen, termasuk pro-rata, attendance allowance, overtime, THR, loan deduction, reimbursement
- cutoff, lock period, reopen policy, adjustment next period, dan approval finalization
- rule per company untuk BPJS, PPh21, bank export, dan salary component mapping
- struktur payslip, payroll detail, payroll exception list, dan audit
- skenario employee join mid-month, resign, unpaid leave, secondment, dan cross-charge

### 6.10 Performance Management

Perlu didetailkan:

- struktur KPI template, assignment, scoring formula, review cycle, dan calibration
- detail 1-on-1 flow antara employee dan manager
- kapan self-assessment dibuka/ditutup dan apa yang terjadi jika melewati deadline
- hubungannya ke merit increase, PIP, succession, dan training recommendation
- UI review form, score breakdown, final rating, acknowledgement, dan history

### 6.11 Dashboard & Reporting

Perlu didetailkan:

- widget per role beserta source data dan permission-nya
- definisi metrik agar angka antar halaman konsisten
- group view vs company view vs self view
- drill-down dari widget ke modul asal
- daftar report final, filter, export, caching, dan background generation

### 6.12 Notification & Alert

Perlu didetailkan:

- event catalog lengkap dari seluruh modul
- channel strategy: mana in-app only, mana email, mana push
- retry, deduplication, read/unread state, dan delivery failure handling
- preference per user/role/company
- roadmap real-time push yang saat ini masih future

### 6.13 Audit Log

Perlu didetailkan:

- daftar aksi wajib log per modul, bukan hanya generic CRUD
- before/after payload mana yang disimpan dan mana yang harus dimasking
- akses detail audit by role dan by company scope
- retention policy, export policy, dan investigasi trail
- halaman detail audit yang sekarang masih belum lengkap di frontend

### 6.14 Recruitment & ATS

Perlu didetailkan:

- flow manpower request sampai vacancy publish sampai convert to employee
- detail pipeline stage, mandatory data per stage, dan alasan reject
- interview schedule, panel, feedback aggregation, dan offer flow
- multi-vacancy candidate, talent pool, duplicate candidate resolution
- create candidate / create interview / make offer pages yang sekarang belum benar-benar lengkap

### 6.15 Onboarding & Offboarding

Perlu didetailkan:

- onboarding checklist template per department dan SLA tiap item
- preboarding portal, dokumen wajib, contract signing, account activation
- offboarding clearance lengkap: IT, GA, HR, Finance, Manager
- intercompany transfer vs resign betulan
- halaman create/update/complete onboarding yang sekarang backend ada tetapi flow UI belum lengkap

### 6.16 Asset Management

Perlu didetailkan:

- asset lifecycle dari procurement sampai dispose
- assignment, BAST, return verification, maintenance, lost/damaged handling
- integrasi ke onboarding/offboarding dan payroll deduction
- perbedaan group-shared asset vs company asset
- form create, assign, return yang sekarang belum tersedia penuh di frontend

### 6.17 Learning Management System

Perlu didetailkan:

- course type, lesson structure, enrollment source, completion rule, certification rule
- learning path by role/position/competency
- assessment flow, attempt policy, passing score, retake approval
- hubungan hasil LMS ke performance dan succession
- create course, enroll, complete flow yang backend ada tetapi UI action belum lengkap

### 6.18 Compensation & Benefit

Perlu didetailkan:

- salary grade, band, compa-ratio, salary review flow, benefit eligibility
- effective dating dan history salary / benefit changes
- policy THR, insurance, allowance, dan benefit enrollment lifecycle
- approval untuk out-of-range salary dan impact ke payroll
- create/update benefit plan dan employee benefit consumption yang belum lengkap di frontend

### 6.19 Employee Loan

Perlu didetailkan:

- jenis pinjaman, formula cicilan, limit terhadap THP, dan tenor policy
- approval chain berdasarkan nominal dan status karyawan
- pelunasan dipercepat, skip installment, penalti, dan resign settlement
- integrasi payroll deduction yang masih future
- halaman admin approval loan dan monitoring portfolio loan

### 6.20 Travel & Expense Claim

Perlu didetailkan:

- pemisahan jelas antara travel request, travel advance, expense claim, approval, dan reimbursement
- reconciliation advance vs actual expense
- policy per category: receipt wajib/tidak, limit, lump-sum, per diem, VAT/tax handling
- receipt upload nyata multipart file, bukan sekadar path/url
- approval matrix berbasis nominal, project, company, dan director escalation

### 6.21 Talent & Succession Planning

Perlu didetailkan:

- definisi critical position, HIPO criteria, nine-box formula, readiness level
- hubungan dengan appraisal history, LMS, promotion, dan mobility lintas company
- succession chart per company dan per group
- governance talent review committee dan frequency review
- dashboard risk untuk posisi kritikal tanpa successor

### 6.22 Employee Engagement

Perlu didetailkan:

- survey builder, anonymity threshold, segmentation rule, eNPS formula
- suggestion box lifecycle dan SLA follow-up
- recognition point system, badge, reward, dan moderation rule
- hubungan engagement score dengan turnover risk dashboard
- hasil report by company, department, dan trend period

### 6.23 Workflow Engine

Perlu didetailkan:

- desain approval type standard lintas modul
- rule builder: by amount, department, request type, company, role, backup approver
- SLA reminder, escalation, reassignment, dan audit per action
- integrasi nyata ke modul leave, self service, loan, recruitment offer, expense, resignation
- governance perubahan template agar tidak memutus instance yang sedang berjalan

### 6.24 Document Management System

Perlu didetailkan:

- taxonomy dokumen: employee, company, legal, policy, contract, certificate
- upload, preview, download, versioning, expiry monitoring, dan access log
- access control per role, per owner, per company, dan restricted document flow
- e-sign flow internal vs third-party provider
- integrasi ke employee, onboarding, recruitment, LMS, policy, disciplinary, dan audit

### 6.25 Integration Hub

Perlu didetailkan:

- daftar integrasi yang benar-benar akan dibangun per fase, jangan terlalu generik
- auth method per provider, credential rotation, encryption, dan revoke flow
- mapping field, retry policy, dead-letter handling, dan observability
- ownership integrasi di level group vs company
- fallback manual import/export saat integrasi gagal

### 6.26 Policy & Compliance Management

Perlu didetailkan:

- lifecycle policy dari draft sampai active sampai superseded
- target audience, acknowledgement rule, reminder, dan bukti legal
- audit schedule, finding severity, corrective action, dan closure rule
- relasi policy ke onboarding, DMS, disciplinary, dan dashboard compliance
- pembedaan policy group-wide vs company-specific

### 6.27 Disciplinary Action Management

Perlu didetailkan:

- klasifikasi pelanggaran, severity, investigator authority, dan bukti minimal
- alur investigasi, confidentiality rule, dan approval SP1/SP2/SP3
- masa berlaku SP dan rule kenaikan level
- hubungan disciplinary record ke performance review, promotion, dan exit process
- blocking rule untuk mutasi/resign saat investigasi aktif

### 6.28 Workforce Planning & Budgeting

Perlu didetailkan:

- manpower plan cycle tahunan/kuartalan, owner, dan approval chain
- budget allocation, used vs remaining, reallocation, dan over-budget governance
- relasi ke recruitment requisition dan payroll forecast
- dashboard plan vs actual per department/company/group
- scenario planning untuk expansion, freeze hiring, dan internal transfer

---

## 7. Modul yang Secara Implementasi Masih Punya Gap Nyata

Berdasarkan `HRMS-PROJECT-TASKS.md`, modul di bawah ini butuh perhatian tambahan karena gap-nya bukan cuma dokumentasi, tapi sudah terlihat di produk:

### 7.1 Belum Dimulai

- `6.24 Document Management System`

### 7.2 Partial atau Perlu Polish

- `6.20 Travel & Expense Claim`
- `6.13 Audit Log`
- `6.12 Notification & Alert` untuk real-time push
- `6.19 Employee Loan` untuk payroll deduction

### 7.3 Backend Ada, UI Flow Belum Lengkap

- `6.6 Attendance` untuk check in/check out/overtime admin flow
- `6.7 Leave Management` untuk create/approve UI
- `6.15 Onboarding & Offboarding` untuk create/update/complete flow
- `6.18 Compensation & Benefit` untuk create/update benefit plan
- `6.14 Recruitment & ATS` untuk create candidate, schedule interview, make offer
- `6.17 LMS` untuk create/enroll/complete course
- `6.16 Asset Management` untuk create/assign/return asset

---

## 8. Format Dokumen Turunan per Modul

Di bawah ini format `.md` yang bisa dipakai ulang untuk tiap modul.

```md
# [Nama Modul]

## 1. Ringkasan
- Tujuan bisnis:
- Masalah yang diselesaikan:
- Dependency:

## 2. Aktor dan Akses
- Role yang terlibat:
- Hak akses per role:
- Scope company/group:

## 3. Entitas dan Data
- Entity utama:
- Field wajib:
- Data sensitif:
- Relasi:

## 4. Status
- Daftar status:
- Transisi status:
- Locking rule:

## 5. Alur Utama
1. ...
2. ...
3. ...

## 6. Alur Alternatif / Exception
- Reject:
- Cancel:
- Revise:
- Expired:
- Conflict:

## 7. Validasi dan Business Rules
- ...

## 8. UI/UX
- List page:
- Detail page:
- Form create/edit:
- Filter/search:
- Empty/loading/error state:

## 9. API Contract
- Endpoint:
- Request:
- Response:
- Error:

## 10. Workflow / Approval
- Trigger approval:
- Approver:
- SLA:
- Escalation:

## 11. Notification
- Trigger:
- Recipient:
- Channel:

## 12. Audit Log
- Aksi wajib log:
- Data yang dimasking:

## 13. Reporting
- Dashboard widget:
- Export:

## 14. Seed / Demo Scenario
- Data minimum:
- Happy path:
- Reject path:

## 15. Open Questions
- ...

## 16. Acceptance Criteria
- ...
```

---

## 9. Rekomendasi Output Lanjutan

Setelah dokumen ini, disarankan lanjut membuat dokumen turunan berikut:

- `docs/modules/06.24-document-management.md`
- `docs/modules/06.20-travel-expense.md`
- `docs/modules/06.23-workflow-engine.md`
- `docs/modules/06.08-self-service-request.md`
- `docs/modules/06.09-payroll.md`
- `docs/modules/06.14-recruitment-ats.md`

Urutan di atas dipilih karena paling cepat memberi dampak ke:

- menu yang masih kosong
- flow approval yang belum konsisten
- dokumen dan upload file
- proses employee self-service
- keterhubungan backend-frontend yang belum penuh

---

## 10. Kesimpulan

Kalau diringkas, yang masih kurang dari "seluruh modul" bukan cuma jumlah fitur, tetapi kedalaman definisi operasionalnya. Hampir semua modul masih perlu dipertegas pada 5 area utama:

- role dan scope akses
- status dan business rule
- alur end-to-end plus exception
- UI behavior yang benar-benar terasa selesai
- integrasi lintas modul, terutama workflow, notification, audit, dan company scope

Dokumen ini bisa dipakai sebagai master checklist supaya refinement per modul lebih terarah dan implementasi berikutnya tidak lagi menghasilkan halaman kosong, tombol no-op, atau behavior yang membingungkan.
