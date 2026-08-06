# 🎯 Portalku HRIS Enterprise

> **Solusi Digital Manajemen Sumber Daya Manusia Terintegrasi untuk Perusahaan Indonesia Skala Menengah & Besar**

![Status](https://img.shields.io/badge/Status-Production%20Ready-blue)
![Modules](https://img.shields.io/badge/Modules-24%20Integrated-green)
![Roles](https://img.shields.io/badge/Roles-7%20Tier%20RBAC-orange)
![DB Tables](https://img.shields.io/badge/DB-110%2B%20Tables-red)

---

## 📋 Executive Summary

**Portalku HRIS Enterprise** adalah platform Human Resource Information System (HRIS) berbasis web modern yang dirancang khusus untuk menjawab kompleksitas operasional SDM di perusahaan Indonesia. Platform ini mengotomatiskan seluruh siklus hidup karyawan — mulai dari rekrutmen, onboarding, manajemen data karyawan, absensi & cuti, payroll & pajak, performance management, hingga exit clearance — dalam satu portal terintegrasi dengan keamanan enterprise-grade.

Dibangun dengan arsitektur **multi-tenant (group-of-companies)**, Portalku HRIS mampu mengelola **banyak anak perusahaan dalam satu portal**, dengan isolasi data ketat antar company namun tetap memberikan visibilitas terpusat di level holding/Group.

---

## ✨ Unique Selling Points (USP)

| # | Apa yang Bikin Portalku Berbeda? |
|---|----------------------------------|
| 1 | 🇮🇩 **Native Indonesia Compliance** — Built-in perhitungan PPh21 Pasal 21, BPJS Ketenagakerjaan (JHT/JKK/JKM/JP), BPJS Kesehatan, UMR regional, & formula THR sesuai regulasi Pemerintah RI |
| 2 | 🏢 **Group-of-Companies Multi-Tenant** — Satu portal untuk 10+ anak perusahaan, isolasi data per company + visibilitas terpusat di level Group/holding |
| 3 | ⚙️ **No-Code Workflow Engine** — Semua approval (cuti, izin, lembur, pengeluaran, resign, dll) bisa custom flow per-company tanpa coding: stages, approvers, escalation, SLA |
| 4 | 🏅 **Full Performance Management Suite** — OKR/KPI 360°, goal cascading top-down, self-review ➔ manager review ➔ calibration ➔ publish/dispute workflow + approval |
| 5 | 🔒 **7-Tier RBAC Hierarki Ketat** — SUPER_ADMIN → GROUP_ADMIN → COMPANY_ADMIN → HR_MANAGER → HR_STAFF → MANAGER → EMPLOYEE, dengan granular permission 74+ point & custom roles scoped per company/group |
| 6 | 📊 **110+ Entities Satu Source of Truth** — Semua data SDM terpusat: 50+ relasi karyawan, riwayat mutasi, sertifikasi, keluarga, pendidikan, aset perusahaan, dokumen digital, semuanya terhubung |
| 7 | 🗂 **Audit Trail Lengkap** — Setiap perubahan data tercatat: who, what, when, from which IP, before/after values — memenuhi syarat audit internal & eksternal |
| 8 | 🚀 **Modern Premium UI** — Antarmuka desain modern terinspirasi Linear/Vercel, bersih, responsive mobile + desktop, tanpa "AI slop" |

---

## 👥 User Personas & Portals

Portalku menyediakan **pengalaman berbeda** sesuai role, bukan hanya beda permission tapi beda dashboard & workflow:

### 🎖 Portal 1 — Super Admin (Platform Owner)
- **Siapa**: Vendor IT, system integrator, tim IT pusat holding
- **Akses**: Semua perusahaan dalam group, semua data, semua module
- **Fokus**: Konfigurasi platform, system settings, manage company, role global permission, audit log seluruh tenant

---

### 👔 Portal 2 — Group / Holding Level
- **Siapa**: Direksi Group, GM SDM Pusat
- **Yang Dilihat**:
  - Dashboard agregasi headcount, attrition rate, payroll cost, performance summary **semua anak perusahaan**
  - Compare antar anak perusahaan: headcount growth, ratio FTE vs outsourcing, cost per employee
  - Policy & benefit standard group yang bisa di-implementasi ke semua child company
  - Approval untuk mutasi antar company, promosi level manajer senior keatas

---

### 🏢 Portal 3 — Company / HR Management
- **Siapa**: HR Manager, HR GA, Payroll Officer, Branch Manager
- **Yang Dikelola**:
  - Data lengkap **seluruh karyawan di company sendiri** (termasuk history mutasi, keluarga, pendidikan)
  - Semua approval workflow masuk ke inbox mereka
  - Payroll run, generate payslip, laporan SPT Masa PPh21
  - Rekrutmen: lowongan kerja, pipeline kandidat, jadwal interview
  - Training & development: enroll karyawan, attendance training, feedback

---

### 🎯 Portal 4 — Manager / Kepala Departemen
- **Siapa**: Supervisor, Section Head, Dept Head, Divisi Head
- **Yang Dikelola** (hanya **bawahan langsung & tidak langsung** mereka):
  - Approval cuti, izin, lembur, pengeluaran timnya
  - Performance planning (set KPI ke anggota tim), review midway, end-of-cycle review, penilaian 360°
  - Dashboard performa tim: attendance rate, productivity, target vs realisasi
  - Feedback 1:1 dengan anggota tim

---

### 👤 Portal 5 — Employee (Self-Service)
- **Siapa**: Semua karyawan biasa
- **Yang Bisa Dilakukan** (hanya **data milik sendiri**):
  - Dashboard personal: cuti tersisa, total lembur bulan ini, payslip bulan lalu
  - Pengajuan cuti, izin sakit, izin pribadi, lembur, perjalanan dinas, pengeluaran reimbursement
  - Update profile (kontak darurat, alamat, bank) — perubahan auto kirim notifikasi ke HR buat approval
  - Lihat & download payslip (password protected PDF)
  - Enroll training, lihat benefit yang di-enroll (BPJS, asuransi kesehatan keluarga, dll)
  - Performance: self-review, input update progres KPI, dispute hasil review

---

## 🔐 7-Tier Role-Based Access Control (RBAC)

| Tingkat | Role Code | Hak Akses |
|---------|-----------|-----------|
| 1 | **SUPER_ADMIN** | 🟢 Full access SEMUA company, SEMUA module, system configuration & role management — *scope: global* |
| 2 | **GROUP_ADMIN** | 🟢 Full access 1 Company Group + semua company di dalemnya — *scope: group* |
| 3 | **COMPANY_ADMIN** | 🟢 Full access 1 company tertentu — manage users, konfigurasi company, semua module — *scope: single company* |
| 4 | **HR_MANAGER** | 🟡 Read+Write module HRIS di company: approve workflow level final, payroll, rekrutmen, performance — *scope: company* |
| 5 | **HR_STAFF** | 🟡 Read + input data karyawan, attendance processing, generate dokumen (tanpa approve final payroll), approval level 1 — *scope: company* |
| 6 | **MANAGER** | 🟠 Approval bawahan (cuti, izin, lembur), performance review tim, read-only data karyawan bawahannya |
| 7 | **EMPLOYEE** | 🔴 Self-service ONLY: lihat data sendiri, ajukan cuti/izin, update profile, performance self-review, download payslip sendiri |

**Custom Roles**: Selain 7 System Roles diatas, admin bisa bikin **Custom Role** dengan granular permission (74 permission point tersedia) yang di-scope ke company / group tertentu, e.g. "Payroll Only" role, "Recruitment Admin" role, dll.

---

## 🧩 24 Integrated Feature Modules

Berikut semua module yang tersedia di Portalku HRIS Enterprise:

---

### 📦 MODULE 1 — Organization Structure (Dasar Perusahaan)
> *Pondasi utama sistem — semua module lain refer ke struktur ini.*

| Fitur | Deskripsi |
|---|---|
| 🏢 Company Group | Holding company / grup usaha — parent dari banyak anak perusahaan |
| 🏭 Company Management | Data legal PT: NPWP, NIB, SIUP, alamat kantor pusat, tax treaty |
| 🌿 Branch / Cabang | Kantor cabang, pabrik, gudang dengan attendance policy per-cabang (flexible shift, libur lokal) |
| 📊 Division / Department / Sub-Department | 3 level hierarki organisasi per company |
| 🛠 Position / Jabatan | Master jabatan, level (P1-P10/M1-M5/D1-D5), job description, reporting manager |
| 👥 Organization Chart | Visualisasi org-chart interaktif per company — who reports to whom |

---

### 👤 MODULE 2 — Employee Master Data Management (MDM)
> *Source of Truth data karyawan — 50+ data points per karyawan.*

| Fitur | Deskripsi |
|---|---|
| 📝 Biodata Karyawan | Lengkap: NIK KTP, NPWP, BPJS, alamat, agama, golongan darah, dll |
| 🧑‍💼 Employment Info | Status (PKWT/PKWTT/outsourcing), tanggal join, tanggal kontrak habis, cuti join date |
| 🏦 Payroll Info | Rekening gaji, NPWP, metode penggajian, no BPJS Jamsostek + Kesehatan, PTKP status (TK/0, K/1, etc) |
| 📚 Riwayat Pendidikan | S1/S2/S3, IPK, universitas, tahun lulus, scan ijazah |
| 💼 Pengalaman Kerja | Sebelum masuk perusahaan, alasan pindah, last salary |
| 👨‍👩‍👧 Data Keluarga | Istri/suami + anak (untuk hitung tunjangan keluarga & BPJS tanggungan) |
| 🚨 Kontak Darurat | Yang dihubungi saat kecelakaan kerja |
| 🏆 Skill & Sertifikasi | Sertifikasi profesional (e.g. PMP, SHRM, SAP), masa berlaku expired reminder |
| 🎬 Riwayat Karir (Career Transactions) | LOG semua mutasi: promosi, demosi, mutasi lintas departemen/cabang/company, perubahan gaji, dengan tanggal efektif & approval log |
| 📎 Attachments | Scan KTP, KK, ijazah, kontrak kerja, medical checkup, dokumen lainnya — all digital |
| 📋 Employee 360° View | Satu halaman master data lengkap, tab-based (biodata / kontrak / pendidikan / keluarga / karir / gaji / training / performa) |

---

### 🚪 MODULE 3 — Recruitment Management (Akuisisi Bakat)
| Fitur | Deskripsi |
|---|---|
| 📢 Job Posting | Publish lowongan internal + eksternal, syarat kualifikasi, range salary, closing date |
| 📑 Candidate Pipeline | Pipeline kandidat per lowongan: New → Screening → HR Interview → User Interview → Test → Offer → Hired / Rejected |
| 👥 Kandidat Database | Talent pool reusable untuk lowongan mendatang |
| 📅 Interview Scheduling | Auto kirim undangan interview ke interviewer + kandidat (via Email/WhatsApp nantinya) |
| 📝 Interview Feedback | Form penilaian per interviewer, rekomendasi Lanjut/Tidak, rangkuman |
| 💰 Offer Letter Generator | Template offer letter, generate PDF sign digital, track acceptance |
| 🔄 Data Hired → Employee Auto-sync | Kandidat berstatus **HIRED** otomatis jadi draft Employee + checklist onboarding dibuat |

---

### 🛳 MODULE 4 — Onboarding & Offboarding (Employee Lifecycle)
| Fitur | Deskripsi |
|---|---|
| ✅ Onboarding Checklist Per Department | Checklist task onboarding: "buat akun email", "siapkan laptop", "training peraturan perusahaan", "tanda tangan kontrak" — assign ke PIC, track completion 100% sebelum day-1 |
| 📚 Pre-day 1 Welcome Pack | Kirim ke kandidat baru: handbook perusahaan, form data diri, dll |
| 🚪 Exit Clearance Workflow | 5-step resign process: Pengajuan Resign → Exit Interview → Asset Return → Clearance dari Dept/IT/HR/Finance → Final Payroll Calc (pesangon/THR pro-ratio) |
| 📤 Resignation Approval | Employee ajukan resign → Manager approve → HR hitung notice period (30 hari sesuai UU Ketenagakerjaan) → tanggal terakhir bekerja otomatis |

---

### ⏰ MODULE 5 — Attendance Management (Kehadiran)
| Fitur | Deskripsi |
|---|---|
| 🕐 Multiple Clock-In Methods | Support Mesin Absen (pull data via API), Selfie GPS (mobile), Check-in via Web (WFH) |
| 📅 Work Calendar Per Branch | Hari libur nasional + libur lokal + hari cuti bersama per company/branch |
| 📍 Branch Attendance Policy | Flexible working hour per cabang: WFO 9-5 / Hybrid / Shift Factory (3 shift) |
| 🔄 Shift Management & Swap | Jadwal shift rotatif karyawan produksi, pengajuan tukar shift antar karyawan (persetujuan manager) |
| ⏱ Overtime / Lembur Calculation | Auto hitung sesuai UU Ketenagakerjaan: 1.5x jam pertama, 2x jam berikutnya, max 4 jam/hari |
| 📊 Daily Attendance Recap | Dashboard late count, early leave, absences per dept/cabang per hari |
| 📝 Import CSV | Batch import dari mesin absen 3rd party via CSV (contoh: mesin Fingerprint/SmartFace) |

---

### 🏖 MODULE 6 — Leave & Permission Management
| Fitur | Deskripsi |
|---|---|
| 📋 Jenis Cuti Karyawan (Leave Types) | Cuti Tahunan (12 hari), Cuti Besar (tahunan ke-7 = 2 bulan), Cuti Sakit, Cuti Melahirkan (90 hari), Cuti Alasan Penting (pernikahan, keluarga meninggal, dll), Cuti Tidak Dibayar |
| 💵 Leave Balance Auto-Calc | Saldo cuti di-pro-rate untuk karyawan baru, reset tiap tahun kerja, carry-over max 1 cuti tahunan |
| 📝 Form Pengajuan Cuti/Izin | Pilih jenis cuti, tanggal, attachment surat dokter untuk cuti sakit > 2 hari |
| 🔁 Approval Workflow **(Custom per Company)** | Karyawan ➔ Atasan Langsung ➔ Manager L2 ➔ HR Approval — tiap stage bisa di-escalate jika > 3 hari tidak ditindak |
| ✋ Permission Request (Izin ½/1 jam) | Izin keluar kantor sebentar (ambil dokumen, ke dokter gigi) — approval cepat, impact kurang jam kerja |
| 🔒 Race Condition Prevention | Anti 2x ambil cuti di tanggal yang sama (database transaction level lock) |

---

### 💰 MODULE 7 — Payroll Management (Penggajian End-to-End)
> *Ini module paling kompleks & paling high-value — 7 sub-modules dalam satu.*

| Sub-Modul | Isinya |
|---|---|
| 💸 **Salary Components** | Component template bisa custom per company: Basic, Tunjangan Jabatan, Tunjangan Keluarga, Tunjangan Makan, Transport, Overtime Pay, BPJS TK Perusahaan, BPJS Kesehatan Perusahaan, dll — tiap component punya formula |
| 📅 **Payroll Periods** | Periode gaji bulanan: tanggal range payroll, tanggal payment, status draft/locked/payment-processed |
| ⚙️ **Payroll Run Engine** | Async queue-based: hitung gaji 500+ employee per company dalam ~2 menit, chunking 50 employee per job, progress bar realtime, resume-able jika gagal tengah jalan |
| 🧾 **Perhitungan Pajak & BPJS Otomatis (Native Indonesia)** | <ul><li>✅ PPh21 Pasal 21 method gross/net-up, PTKP A/B/C 2024 terbaru</li><li>✅ BPJS JHT 2% karyawan + 3.7% perusahaan</li><li>✅ BPJS Jaminan Pensiun (JP) 1% karyawan + 2% perusahaan</li><li>✅ JKK (Jaminan Kecelakaan Kerja) 0.24% - 1.27% sesuai risiko industri</li><li>✅ JKM (Jaminan Kematian) 0.3% perusahaan</li><li>✅ BPJS Kesehatan 1% karyawan + 4% perusahaan (dibayar perusahaan, potong cap upah Rp 12 Jt)</li></ul> |
| 📄 **Payslip Generation** | PDF payslip individual password protected, email otomatis, download via employee self-service |
| 📊 **Bank Transfer File (BA)** | Generate file upload ke Bank BCA/BNI/Mandiri/BRI format standard — tinggal upload ke corporate online banking, gak perlu ketik manual |
| 📑 **Laporan PPh21 SPT Masa** | File CSV format DJP 1721-I untuk import e-Faktur pajak |

---

### 🎖 MODULE 8 — Performance Management (Manajemen Kinerja)
> *Module performance PALING LENGKAP dikelasnya — 8 phase development process, 11 migrations full cycle.*

| Phase | Apa yang Terjadi |
|---|---|
| 📌 **Phase 1 — Configuration** | Setup performance cycle: 1 semester / tahunan, weight KPI vs Competency vs OKR, metode rating (1-5, bell curve, forced distribution), approval template |
| 📚 **Phase 2 — Libraries** | Bank pertanyaan competency, bank KPI per departemen, rating scale definitions |
| ⚙️ **Phase 3 — Workflow Template** | Template stage: Self-Review → Manager Review → L2 Review → Calibration → Publish → Dispute Window 7 hari |
| 🎯 **Phase 4 — Period Config Snapshot** | Snapshot immutable dari config cycle — menjaga integritas data, config tidak berubah ditengah cycle |
| 🛡 **Phase 5 — Governance Hardening** | Siapa yang bisa akses apa, visibility scoped per role (manager cuma lihat timnya) |
| 📈 **Phase 6 — Planning & Assignment** | Goal cascading: CEO set company goal → Director turunin ke Division → Dept Head ke Team → Employee ke individu — OKR alignment 100% top-down, 74 employee di assign otomatis ke cycle |
| 🏃 **Phase 7 — Execution** | Midway check-in, employee update progres KPI, 1:1 feedback form, manager give coaching notes |
| 📊 **Phase 8 — Results, Calibration & Dispute** | Self-Review employee → Manager Review (rating + narasi) → Calibration Session (adjust distribution curve paksa) → Publish Final Rating → Dispute 7 hari window jika keberatan → Final Rating Lock |

---

### 📚 MODULE 9 — Training & Development (Pengembangan SDM)
| Fitur | Deskripsi |
|---|---|
| 🗂 Training Categories | Softskill, Technical, Compliance (K3, Anti-Fraud), Leadership |
| 📚 Training Courses Library | Master syllabus kursus, durasi, trainer, biaya, learning objectives |
| 📅 Training Sessions | Jadwal sesi pelaksanaan training per batch, kuota, venue, link Zoom |
| 📝 Training Materials | Slide deck, video recording, dokumen pendukung |
| 🎫 Enrollment | HR assign / employee self-enroll, approval manager untuk training di jam kerja |
| ✅ Attendance Training | Absensi per sesi — hadir / izin / alpha |
| 📝 Post-Training Feedback | Form evaluasi trainer, materi, implementasi di pekerjaan |
| 📊 Employee Training History | Tersimpan di profile karyawan, muncul di tab "Training" 360 view |

---

### 💳 MODULE 10 — Employee Loans (Pinjaman Karyawan)
| Fitur | Deskripsi |
|---|---|
| 💼 Loan Types | Pinjaman Uang Muka, Pinjaman Kendaraan, Pinjaman Pendidikan Anak — interest rate per jenis |
| 💰 Loan Application Workflow | Employee ajukan jumlah + tenor (6-36 bulan) → Manager approve → HR verify eligibility (min 1 tahun bekerja) → Finance approve → Auto-potong gaji bulanan |
| 🧾 Installment Amortization Table | Table cicilan per bulan: pokok + bunga + sisa pinjaman, auto sync ke payroll deduction |
| 🧾 Payroll Deduction Integration | Cicilan bulan ini **otomatis masuk sebagai deduction component** di payroll run employee terkait — tidak perlu entry manual |

---

### 🏥 MODULE 11 — Employee Benefits & Compensation
| Fitur | Deskripsi |
|---|---|
| 🧾 Benefit Plans | BPJS Keluarga, Asuransi Kesehatan Swasta (AXA/Manulife), Asuransi Jiwa Group, Mobil Dinas, Tunjangan Pendidikan Anak |
| 📋 Benefit Enrollment | Open enrollment period tahunan, employee pilih benefit (e.g. naikkan BPJS tanggungan anak ke-3) |
| 📊 Benefit Deductions Auto-Calc | Premi dibayar karyawan di-potong auto via payroll component, premi perusahaan masuk cost center |

---

### 💼 MODULE 12 — Travel & Expense Management
| Fitur | Deskripsi |
|---|---|
| ✈️ Business Trip Request | Perjalanan dinas luar kota/negeri: purpose, itinerary, transport, hotel, estimasi biaya — approval manager |
| 💵 Travel Advance (Uang Muka Perjalanan Dinas) | Berdasarkan SPPD, cairkan 70% estimasi, sisanya settlement setelah kembali |
| 🧾 Expense Claims (Reimbursement) | Kuitansi parkir, tol, makan client, obat-obat dinas — upload lampiran foto kuitansi, approval manager+finance |
| 🔁 Approval Chain | Sesuai jumlah nominal: < 1jt manager, < 5jt Dept Head, ≥ 5jt CFO — via workflow engine |
| 💸 Payoff Integration | Approved claim **masuk ke payroll component** bulan berikutnya atau transfer via BA bank terpisah |

---

### 💻 MODULE 13 — Asset Management (Aset Perusahaan)
| Fitur | Deskripsi |
|---|---|
| 🗃 Asset Categories | Laptop, Monitor, HP Kantor, Kendaraan Dinas, Seragam, Kursi Kantor |
| 📦 Asset Items | Data lengkap per unit: merk, serial number, tanggal beli, harga perolehan, masa depresiasi |
| 📝 Asset Assignments | Penyerahan aset ke karyawan: tgl serah, kondisi, tanda tangan terima |
| ✅ Asset Return Tracking | Di exit clearance: checklist barang karyawan harus dikembalikan, jika hilang potong final payroll |

---

### 🗂 MODULE 14 — Document Management System (DMS)
| Fitur | Deskripsi |
|---|---|
| 📁 Document Categories | Kontrak Kerja, Peraturan Perusahaan, SOP Internal, Formulir, Peraturan Kementerian Ketenagakerjaan |
| 🔐 Granular Access Control | Per-document bisa di-set: hanya HR, hanya manager + diatas, semua employee di dept X |
| ✍️ Digital Signature Tracking | Siapa yang sign, kapan, IP address — untuk kontrak & SPMK |
| 👀 Document Access Log | Setiap view / download tercatat: who, when, IP — compliance audit |
| 🔒 Anti IDOR Signed URL | URL share dokumen TIDAK sequential `uploads/contract_123.pdf`, semua signed URL 15 menit HMAC expiry |

---

### 🔀 MODULE 15 — Workflow Engine (Custom No-Code)
> Ini **jantung otomatisasi** Portalku — semua approval flow pake engine yang sama.

| Konsep | Apa Itu |
|---|---|
| **Workflow Template** | Blueprint per-company: "Approval Cuti > 3 hari", "Approval Lembur", "Approval Resign" — dibuat HR tanpa coding |
| **Stages** | Urutan approval: Stage 1 = Atasan Langsung, Stage 2 = Manager L2, Stage 3 = HR (final) |
| **Condition Rules** | Percabangan no-code: IF nominal > 5.000.000 → tambah stage CFO approval, ELSE skip |
| **Escalation SLA** | Jika approver tidak merespon 3 hari → auto lempar ke atasan approver + notifikasi |
| **Workflow Instance** | Per request concrete instance, e.g. "Cuti Andi tanggal 10 Nov 2024" — track log semua perubahan |
| **Instance Log** | Immutable log: 10:32 Andi Kirim → 11:05 Manager Budi Approve → 14:22 HR Siti Approve — with IP, comment, attach lampiran |

---

### 👮 MODULE 16 — Role, Permission & User Management (RBAC)
| Fitur | Deskripsi |
|---|---|
| 🔑 74 Granular Permissions | e.g. `employee:read`, `employee:create`, `payroll:run-finalize`, `performance:calibration-adjust-rating`, `audit-log:read` — 74 granular points |
| 🏷 7 System Roles (Immutable) | SUPER_ADMIN to EMPLOYEE diatas, tidak boleh diubah permissions (read-only) |
| ✏️ Custom Roles Per Scope | Buat role baru scoped ke **1 company saja** / 1 group — misal role "Payroll Staff Cabang Surabaya" cuma bisa baca data cabang SBY |
| 🧑‍💼 Multi-Company User Access | Satu user (misal: GM HR Regional) bisa akses 3 company sekaligus tanpa login ulang — company switcher di pojok kanan atas UI |
| 🔐 Permission Request Validation | Semua API request check 4 layer pipeline: Authenticated (JWT valid) → Token not blacklisted → User in scope company → Role punya permission endpoint |

---

### 🛡 MODULE 17 — Audit Log & Compliance
| Fitur | Deskripsi |
|---|---|
| 📜 Auto Audit Log Middleware | **Setiap** POST/PUT/PATCH/DELETE request otomatis tercatat — no code tambahan |
| 🔍 Info Tercatat | actor (userId), entity apa, entity ID, action (create/update/delete), timestamp, IP address, user-agent, **old_values, new_values** JSON diff |
| 🔎 Audit Log Viewer | Halaman filter search: by user, by entity type (employee/payroll/etc), tanggal range, action type |
| 🛡 Compliance Ready | Memenuhi audit internal maupun eksternal (misal audit OJK untuk industri finansial) |

---

### 📣 MODULE 18 — In-App Notification Center
| Fitur | Deskripsi |
|---|---|
| 🧾 Event-Driven Notifications | Semua event domain auto-create notifikasi: `LeaveRequestSubmitted` → Manager, `PayrollPublished` → Employee, `NewJobPosting` → Semua |
| ✉️ Inbox Pusat | Bell icon top navbar, unread badge, mark all read, notification detail page |
| 🔔 Push ke Email/Webhook next phase | Versi ini on-app dulu, next phase bisa kirim email dan WhatsApp Bot secara otomatis |

---

### 📊 MODULE 19 — Reports & Analytics
| Fitur | Deskripsi |
|---|---|
| 🧾 Standard Reports | Headcount report, turnover / attrition report, attendance recap bulanan, payroll cost report per dept, leave utilization report |
| 📥 Export Excel & PDF | Semua list page bisa export Excel/CSV — filter column disesuaikan |
| 📈 Dashboard KPI Per Role | Dashboard berbeda per role: Headcount Trend vs Target, Overtime per Dept, Employee Performance Distribution, Open Requisition per Dept, Cuti Belum Diambil |

---

### 📅 MODULE 20 — Work Calendar & National Holidays
| Fitur | Deskripsi |
|---|---|
| 🇮🇩 Pre-Seed Libur Nasional | Tahun 2024 + 2025 sesuai Kepmenaker & SKB 3 Menteri (libur nasional + cuti bersama) |
| 🏭 Custom Holiday Per Branch | Hari libur lokal (HUT Kota, Natal daerah, Isra Miraj cuti bersama company) |
| 🔄 Attendance Auto-Resolve | Tanggal merah di kalender = auto tandai tidak perlu clock-in, tidak late |

---

### 👥 MODULE 21 — User Management
| Fitur | Deskripsi |
|---|---|
| 🧑‍💼 User vs Employee Satu Data | 1 Employee = 1 User (same table `users` join ke `employees` via userId) — SSO data source |
| 🔑 Secure Auth | BCrypt 12 rounds + JWT access 15 menit + refresh token 7 hari rotasi |
| 🔐 Lockout Protection | Max 5x salah password → lockout 15 menit (anti brute force) |
| 🛡 Audit Login Logs | Semua login ke platform tercatat: IP, device, location, berhasil/gagal |

---

### 🔐 MODULE 22 — Authentication & Security (Enterprise-Grade)
| Fitur | Deskripsi |
|---|---|
| ✅ Secure Login Flow | Login page + forgot password (tokenized email link 1 jam expiry) |
| 🔑 CSRF Protection | Double submit cookie pattern untuk API mutation POST/PUT/DELETE |
| ⚠️ Rate Limiting | Global 100 req / 15 menit per IP, Auth endpoint 10 req / 15 menit (anti credential stuffing) |
| 🔒 PII Encryption | NIK, NPWP, no rekening, gaji = AES-256-GCM encrypted at rest di database (gap analysis: Phase 1 fix) |
| 🏥 Health Check Endpoint | `/api/v1/health` — monitoring status uptime, DB, Redis, RabbitMQ |

---

### ⚙️ MODULE 23 — Admin Settings & System Configuration
| Fitur | Deskripsi |
|---|---|
| 🏢 Company Settings | Nama perusahaan, logo, alamat, signature untuk dokumen |
| ⚙️ Global System Settings | Parameter global: batas maximal lembur per bulan, minimal masa kerja untuk loan, default cuti tahunan, dll |
| 🔑 Group Policies | Group level policy yang enforce ke semua child companies |

---

### 🔎 MODULE 24 — Search & Cross-Module Indexing
| Fitur | Deskripsi |
|---|---|
| 🔎 Global Search | Cari nama karyawan, NIK, ID permohonan cuti, nomor payslip, nomor kontrak — ketik di searchbar navbar |
| 📋 Pagination & Filter Semua List Page | Semua halaman list: sort column, search, filter by tanggal, filter by dept/cabang, export CSV |

---

## 🏗 Arsitektur Teknis (Engineering)
> High-level overview, detail ada di blueprint.md dan gap-analysis.md

### Stack Teknologi
| Layer | Teknologi |
|---|---|
| 🖥 Frontend Web | React 19 + TypeScript, Vite 5, React Router 7 (lazy load + suspense) |
| 🎨 UI Design System | Custom design token (inspired Linear/Vercel), reusable components (Button, Input, Select, DataTable) |
| 🗺 i18n Support | Indonesia (default) + English (toggleable) |
| 🚀 Backend API | Node.js 22 + Express.js 4 + TypeScript 5.6, tsx watch dev server |
| 💾 Database | MySQL 8.0 — **110+ tables**, 29 Prisma migrations, 25+ composite unique constraints |
| ⚡ ORM | Prisma 5.22 — type-safe query builder, connection pooling 15-50 |
| 📦 Cache Layer | Redis 7 (standalone) — TTL caching, rate limiter storage, BullMQ queue storage |
| 📨 Message Broker | RabbitMQ 3.13 Management — Event Bus domain events (async decouple modules) |
| 📋 Background Jobs | BullMQ — Payroll Run Async, CSV imports, long-running report exports, notification fan-out |
| 🔐 Auth | JWT (access 15m + refresh 7d), bcrypt password 12 rounds, CSRF double cookie submit |
| 🛡 Validator | Zod DTO validation, built-in Indonesian identity validator (NIK, NPWP, BPJS, phone) |
| 📝 Logger | Winston structured JSON log, correlation ID per request |
| 🧪 Testing | Jest unit test, Playwright E2E (planned — gap analysis phase 4) |
| 🚢 Deployment | Docker multi-stage, backend image distroless non-root, docker-compose + healthcheck |
| 📊 Observability | Sentry APM integration (tracing + error capture + session replay on error) — gap analysis phase 5 |

### Diagram Request Pipeline (12 Steps)
```
Client Request
  → 1. CORS Preflight
  → 2. Rate Limit (Redis sliding window: 100req/15m IP)
  → 3. Auth Middleware (JWT verify, not blacklisted)
  → 4. CSRF Double Submit Cookie Check (for mutating requests)
  → 5. Zod Request DTO Validation (payload shape + business rule validator)
  → 6. Role/Scope Authorization Middleware (7-tier RBAC + custom roles)
  → 7. Company Scope Middleware (Row-level filter: user cuma lihat company sendiri)
  → 8. Prisma Connection Pool Acquire
  → 9. Controller → Service (domain logic) → Repository (DB query, explicit SELECT)
  → 10. Domain Event Publish to RabbitMQ → trigger notification / cache invalidation / async side effects
  → 11. Audit Log Middleware (before/after diff JSON → audit_logs table)
  → 12. Error Handler Middleware (AppError → HTTP status terstandarisasi + trace ID)
Response
```

---

## 🎨 UI/UX Design Language
> Mengikuti prinsip "Impeccable" — Hierarki, Densitas, Spacing Sistematis.

### Design Tokens
| Token | Nilai |
|---|---|
| **Spacing System** | 4 / 8 / 12 / 16 / 24 / 32 px rigid — TIDAK ADA nilai random seperti 13 / 17 / 22 px |
| **Typography Scale** | 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 px — consistent line-height 1.4 / 1.5 |
| **Color Palette** | Neutral grayscale ketat + 1 brand accent primary (tidak ada gradient berlebih, tidak ada glow effect, tidak ada glassmorphism) |
| **Radius** | 4px buttons, 8px cards, 12px dialogs — consistent across semua komponen |
| **Shadow** | Subtle elevation 1/2/3 level, no 8-layer shadow stacking |

### Layout Halaman Standard
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Search      🏢 Company Switcher  🔔 Notif 👤 Avatar User   │ ← Top Nav 56px
├──────────┬──────────────────────────────────────────────────────┤
│ 📊 Dash  │ 📄 PageHeader (Title, Subtitle, Action Buttons)     │
│ 👥 Emp   │                                                      │
│ ⏰ Absen │ ┌──────────────────────────────────────────────┐    │ ← Content
│ 📝 Cuti  │ │  DataTable / Form / Card content area        │    │   8px gutter
│ 💰 Payrl │ │  100% width container, 24px padding          │    │   max 1440px
│ 🎖 Perf  │ │                                              │    │
│ ...Menu  │ └──────────────────────────────────────────────┘    │
│ (Collapsible Sidebar 240px)                                     │
└──────────┴──────────────────────────────────────────────────────┘
```

### 3 Tingkat Dashboard (Role-Based UI)
| Role | Dashboard Utama |
|---|---|
| **Super / Group Admin** | Headcount semua company, Attrition rate, Payroll cost aggregate, Total users, Quick stats per company |
| **HR Manager / Company Admin** | Cuti pending approval count, absensi hari ini (late/alpha/hadir %), hiring pipeline count, payroll status periode ini |
| **Manager** | Tim saya (jumlah FTE, yang cuti hari ini, OKR progress tim rata-rata, approval pending inbox ku) |
| **Employee** | Saya pribadi: Cuti tersisa, gaji bulan ini (tanggal payment), notif ku, performance cycle progress, tugas training saya |

---

## 📊 Quick Stats (Data Sudah Ter-Seed Default Development)

| Metrik | Value |
|---|---|
| Total Database Tables | 110+ entities |
| Backend Modules | 24 modules lengkap |
| Frontend Pages | 78+ halaman (Admin + Employee + Manager + HR portals) |
| Prisma Migrations | 29 migration files (idempotent production) |
| System RBAC Roles | 7 built-in immutable roles |
| Granular Permissions Points | 74 permission endpoints |
| Seed Test Companies | 1 company demo |
| Seed Test Employees | 50 employees + 51 users test |
| Seed Performance Phase Data | Full 8 phase cycle + 74 assignments OKR sample |
| API Prefix | `/api/v1/*` |
| Default Backend Port | `3000` |
| Default MySQL Docker Port | `3307` (bentrok dengan MySQL lokal di port 3306) |
| Default Redis Port | `6379` |
| Default RabbitMQ Management UI | `15672` (guest / guest) |
| Default phpMyAdmin Docker UI | `8081` (auto login ke db hris_enterprise) |

---

## 🎯 Roadmap Pengembangan Selanjutnya
> Priority P1 = production blocker, P2 = next quarter, P3 = nice-to-have

| Priority | Fitur | Keterangan |
|---|---|---|
| 🔴 P1 | **MFA TOTP untuk SUPER/HR_ADMIN** | 2FA authentication (gap security CRITICAL) |
| 🔴 P1 | **Forgot Password Email Flow** | Send email tokenized link (feature CRITICAL) |
| 🔴 P1 | **PII Encryption AES-256-GCM** | NIK, NPWP, Rekening, Gaji encrypt at rest |
| 🟡 P2 | **WhatsApp Bot Notifications** | Approval pending, Payslip published, Interview reminders via WhatsApp Bisnis API |
| 🟡 P2 | **SSO Integration** | Google SSO / Microsoft Entra ID / Okta for enterprise clients |
| 🟡 P2 | **Mobile Android/iOS App** | Capacitor wrapper untuk Selfie GPS attendance, leave request, payslip mobile |
| 🟡 P2 | **Payroll Pajak API Connect** | Integrasi langsung ke DJP e-Filing (auto kirim SPT Masa 1721) |
| 🟢 P3 | **AI Resume Screening** | Parse CV kandidat dengan OCR, match dengan job requirement |
| 🟢 P3 | **Biometric Face Recognition** | Face API attendance vs foto selfie untuk anti fake GPS |
| 🟢 P3 | **Employee Pulse Survey** | Polling kepuasan karyawan anonymous, report engagement score triwulan |

---

## 👨‍💼 Siapa yang Cocok Pakai Portalku?
Portalku HRIS Enterprise ideal untuk:
- 🏢 **Perusahaan Group / Holding** dengan 3+ anak perusahaan & 300+ karyawan
- 🏭 **Perusahaan Manufaktur** yang butuh absen shift + kalkulasi lembur sesuai UU
- 💼 **Jasa Keuangan / Asuransi** yang butuh audit trail ketat + multi level approval
- 🏬 **Retail / Ritel** dengan banyak cabang & struktur organisasi kompleks
- 🏥 **Rumah Sakit / Klinik** dengan shift kerja 24/7 & hierarki jabatan spesifik

> **Minimum spec perusahaan untuk Portalku:** 100+ karyawan, 2+ cabang / departemen, ada minimal 1 orang full-time staff HR.

---

## ✅ Portalku — Bukan Sekedar HRIS Biasa

Portalku bukan cuma aplikasi catet gaji & absen. Portalku adalah **sistem operasional SDM** yang menyatukan:

> 🎯 Akuisisi Bakat → 🛳 Onboarding → 👨‍💼 Pengembangan Karir → 📊 Penilaian Kinerja → 💰 Kompensasi & Benefit → 🚪 Exit & Succession Planning

**Semua dalam satu platform — satu source of truth.**
