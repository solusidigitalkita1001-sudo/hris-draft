# Product Requirements Document (PRD)
## Human Resource Management System (HRMS)

---

**Versi Dokumen:** 2.0.0 (Consolidated)
**Tanggal:** Juni 2026
**Status:** Draft
**Prepared by:** Product Team
**Changelog v1.1.0:** Penambahan Module Work Calendar (6.5) beserta integrasi ke Shift, Attendance, Leave Management, Self Service Request, Payroll, Dashboard, dan Notifikasi.
**Changelog v2.0.0:** Konsolidasi PRD Core (v1.1.0, Module 6.1–6.13) dengan PRD Enterprise Extension (Module 6.14–6.28: Recruitment & ATS, Onboarding & Offboarding, Asset Management, LMS, Compensation & Benefit, Employee Loan, Travel & Expense Claim, Talent & Succession Planning, Employee Engagement, Workflow Engine, Document Management System, Integration Hub, Policy & Compliance, Disciplinary Action, dan Workforce Planning & Budgeting). Setiap modul ekstensi dilengkapi Business Rules, Database Schema, dan API Endpoints agar setara kedalaman detailnya dengan modul inti. Lihat §6.0 untuk peta modul lengkap dan rekomendasi fasing implementasi.

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Tujuan Produk](#2-tujuan-produk)
3. [Target Pengguna](#3-target-pengguna)
4. [Tech Stack & Arsitektur](#4-tech-stack--arsitektur)
5. [Struktur Role & Akses](#5-struktur-role--akses)
6. [Module Requirements](#6-module-requirements)
   - **Core Modules (v1.1.0)**
   - 6.1 [Authentication & Authorization](#61-module-authentication--authorization)
   - 6.2 [Master Employee](#62-module-master-employee)
   - 6.3 [Organization Structure](#63-module-organization-structure)
   - 6.4 [Shift Management](#64-module-shift-management)
   - 6.5 [Work Calendar](#65-module-work-calendar)
   - 6.6 [Attendance](#66-module-attendance)
   - 6.7 [Leave Management](#67-module-leave-management)
   - 6.8 [Self Service Request](#68-module-self-service-request)
   - 6.9 [Payroll](#69-module-payroll)
   - 6.10 [Performance Management](#610-module-performance-management)
   - 6.11 [Dashboard & Reporting](#611-module-dashboard--reporting)
   - 6.12 [Notification & Alert](#612-module-notification--alert)
   - 6.13 [Audit Log](#613-module-audit-log)
   - **Enterprise Extension Modules (v2.0.0)** *(baru)*
   - 6.14 [Recruitment & Applicant Tracking System (ATS)](#614-module-recruitment--applicant-tracking-system-ats)
   - 6.15 [Onboarding & Offboarding](#615-module-onboarding--offboarding)
   - 6.16 [Asset Management](#616-module-asset-management)
   - 6.17 [Learning Management System (LMS)](#617-module-learning-management-system-lms)
   - 6.18 [Compensation & Benefit](#618-module-compensation--benefit)
   - 6.19 [Employee Loan Management](#619-module-employee-loan-management)
   - 6.20 [Travel & Expense Claim](#620-module-travel--expense-claim)
   - 6.21 [Talent & Succession Planning](#621-module-talent--succession-planning)
   - 6.22 [Employee Engagement](#622-module-employee-engagement)
   - 6.23 [Workflow Engine](#623-module-workflow-engine)
   - 6.24 [Document Management System (DMS)](#624-module-document-management-system-dms)
   - 6.25 [Integration Hub](#625-module-integration-hub)
   - 6.26 [Policy & Compliance Management](#626-module-policy--compliance-management)
   - 6.27 [Disciplinary Action Management](#627-module-disciplinary-action-management)
   - 6.28 [Workforce Planning & Budgeting](#628-module-workforce-planning--budgeting)
7. [Mobile App Requirements (Flutter)](#7-mobile-app-requirements-flutter)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Database Schema Overview](#9-database-schema-overview)
10. [API Design Guidelines](#10-api-design-guidelines)
11. [Security Requirements](#11-security-requirements)
12. [Milestone & Timeline](#12-milestone--timeline)
13. [Risks & Mitigasi](#13-risks--mitigasi)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

Sistem **Human Resource Management (HRM)** ini dirancang sebagai platform terpadu untuk mengelola seluruh siklus hidup karyawan dalam suatu organisasi — mulai dari rekrutmen, onboarding, pengelolaan kehadiran, penggajian, evaluasi kinerja, hingga offboarding. Sistem dibangun berbasis web (Node.js + EJS) dan didukung aplikasi mobile (Flutter) untuk aksesibilitas di lapangan.

Dokumen versi **2.0.0** ini mengonsolidasikan **28 modul** ke dalam dua kelompok besar:

- **Core Modules (6.1–6.13)** — kebutuhan dasar HR operasional: Authentication, Master Employee, Organization Structure, Shift, Work Calendar, Attendance, Leave Management, Self Service Request, Payroll, Performance Management, Dashboard, Notification, dan Audit Log.
- **Enterprise Extension Modules (6.14–6.28)** — kapabilitas tambahan yang membedakan HRMS skala enterprise: Recruitment & ATS, Onboarding & Offboarding, Asset Management, Learning Management System, Compensation & Benefit, Employee Loan, Travel & Expense Claim, Talent & Succession Planning, Employee Engagement, Workflow Engine, Document Management System, Integration Hub, Policy & Compliance, Disciplinary Action, dan Workforce Planning & Budgeting.

Kombinasi seluruh modul ini ditargetkan setara dengan 90–95% fitur yang umum ditemukan pada produk HRMS enterprise di pasar Indonesia (lihat §6.0 untuk peta modul dan rekomendasi fasing implementasi).

---

## 2. Tujuan Produk

- Mengotomatisasi proses HR yang sebelumnya manual (absensi, lembur, cuti, payroll).
- Memberikan visibilitas real-time terhadap data karyawan dan kinerja organisasi.
- Memastikan kepatuhan regulasi (BPJS, PPh 21, UU Ketenagakerjaan Indonesia).
- Memberdayakan karyawan melalui fitur self-service berbasis mobile.
- Menghasilkan laporan HR yang akurat untuk pengambilan keputusan manajemen.

---

## 3. Target Pengguna

| Peran | Deskripsi |
|-------|-----------|
| **Super Admin** | Pengelola sistem secara keseluruhan, konfigurasi global |
| **HR Manager** | Mengelola data karyawan, proses HR, persetujuan |
| **HR Staff** | Input dan operasional data HR harian |
| **Finance / Payroll Admin** | Proses penggajian, potongan, tunjangan |
| **Manager / Supervisor** | Persetujuan cuti, absensi tim, evaluasi KPI |
| **Karyawan (Employee)** | Self-service: cuti, izin, lihat slip gaji, absensi |

---

## 4. Tech Stack & Arsitektur

### 4.1 Backend
- **Runtime:** Node.js (v20+ LTS)
- **Framework:** Express.js
- **Template Engine:** EJS (https://ejs.co/) untuk SSR (Server-Side Rendering)
- **ORM:** Sequelize atau Prisma (MySQL adapter)
- **Authentication:** JWT (JSON Web Token) + Refresh Token
- **File Storage:** Local storage / AWS S3 / MinIO (untuk dokumen & foto karyawan)
- **Job Scheduler:** node-cron (untuk proses otomatis: rekap absensi, payroll run)
- **Mailer:** Nodemailer (notifikasi email)
- **Validation:** Joi / express-validator
- **Logging:** Winston + Morgan

### 4.2 Database
- **DBMS:** MySQL 8.x
- **Strategi:** Soft delete (kolom `deleted_at`) untuk integritas data historis
- **Encoding:** UTF8MB4 untuk dukungan karakter penuh
- **Backup:** Jadwal backup harian otomatis

### 4.3 Mobile App
- **Framework:** Flutter (Dart)
- **State Management:** Riverpod / BLoC
- **HTTP Client:** Dio
- **Local Storage:** Hive / SharedPreferences
- **Push Notification:** Firebase Cloud Messaging (FCM)
- **Offline Support:** Data absensi tersimpan lokal jika tidak ada koneksi, sync saat online
- **Platform Target:** Android (minimum SDK 21) & iOS (minimum iOS 12)

### 4.4 Infrastruktur
- **Web Server:** Nginx (reverse proxy)
- **Process Manager:** PM2
- **Containerisasi:** Docker + Docker Compose (opsional)
- **CI/CD:** GitHub Actions / GitLab CI
- **Environment:** Development, Staging, Production

### 4.5 Arsitektur Sistem (Overview)

```
[Flutter App] ────────────────────────────────┐
                                               │ REST API (JSON)
[Web Browser] ──── [Nginx] ──── [Express.js] ─┤
                                               │
                                        [MySQL DB]
                                               │
                                        [File Storage]
                                               │
                                        [node-cron Jobs]
```

---

## 5. Struktur Role & Akses

Sistem menggunakan **Role-Based Access Control (RBAC)**.

| Module | Super Admin | HR Manager | HR Staff | Finance | Manager | Employee |
|--------|:-----------:|:----------:|:--------:|:-------:|:-------:|:--------:|
| Master Employee | ✅ CRUD | ✅ CRUD | ✅ CR | ❌ | 👁 View tim | 👁 Self |
| Org Structure | ✅ CRUD | ✅ CRUD | 👁 View | ❌ | 👁 View | 👁 View |
| Shift | ✅ CRUD | ✅ CRUD | ✅ CR | ❌ | 👁 View | 👁 View |
| Work Calendar | ✅ CRUD | ✅ CRUD | ✅ CR | ❌ | 👁 View | 👁 View |
| Attendance | ✅ All | ✅ All | ✅ Input | ❌ | 👁 Tim | 👁 Self |
| Leave Mgmt | ✅ All | ✅ Approve | ✅ Input | ❌ | ✅ Approve Tim | 📝 Request |
| Self Service | ✅ All | ✅ All | 👁 View | ❌ | ✅ Approve | 📝 Self |
| Payroll | ✅ All | 👁 View | ❌ | ✅ CRUD | ❌ | 👁 Slip |
| Performance | ✅ All | ✅ All | 👁 View | ❌ | ✅ Appraise | 👁 Self |
| Dashboard | ✅ Full | ✅ HR View | 📊 Limited | 📊 Finance | 📊 Tim | 📊 Self |
| Audit Log | ✅ Full | 👁 View | ❌ | ❌ | ❌ | ❌ |
| Recruitment (ATS) | ✅ All | ✅ CRUD | ✅ CR *(Recruiter)* | ❌ | 👁 Interview & Feedback | ❌ |
| Onboarding/Offboarding | ✅ All | ✅ CRUD | ✅ CR | ❌ | ✅ Approve Resign | 📝 Resign/Preboarding |
| Asset Management | ✅ All | ✅ CRUD | ✅ CR *(GA)* | ❌ | 👁 Tim | 👁 Self |
| LMS | ✅ All | ✅ CRUD | ✅ CR | ❌ | 👁 Tim | 📝 Enroll/Self |
| Compensation & Benefit | ✅ All | ✅ CRUD | 👁 View | ✅ CRUD | ❌ | 👁 Self |
| Employee Loan | ✅ All | ✅ Approve | ✅ Input | ✅ Disburse | ✅ Approve Tim | 📝 Request |
| Travel & Expense | ✅ All | 👁 View | ✅ Input | ✅ Approve/Reimburse | ✅ Approve Tim | 📝 Request |
| Talent & Succession | ✅ All | ✅ CRUD | 👁 View | ❌ | 👁 Tim | ❌ |
| Employee Engagement | ✅ All | ✅ CRUD | ✅ CR | ❌ | 📊 Tim | 📝 Survey/Feedback |
| Workflow Engine | ✅ Full Config | ✅ Config Modul | ❌ | ❌ | *(bertindak sbg approver)* | ❌ |
| DMS | ✅ Full | ✅ CRUD | ✅ CR | ❌ | 👁 Tim | 👁 Self |
| Integration Hub | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Policy & Compliance | ✅ All | ✅ CRUD | ✅ CR | ❌ | 👁 Tim | 📝 Acknowledge |
| Disciplinary Action | ✅ All | ✅ CRUD | 👁 View | ❌ | 📝 Report | ❌ |
| Workforce Planning | ✅ All | ✅ CRUD | 👁 View | ✅ CRUD | 👁 View | ❌ |

> ✅ = Full Access | 👁 = View Only | 📝 = Create Request | 📊 = Dashboard Terbatas | ❌ = No Access
> Role tambahan yang relevan untuk modul ekstensi (Recruiter/Talent Acquisition, GA/IT, Director, Investigator) mengikuti pola akses pada baris terkait di atas; HR Staff dengan tugas khusus dapat di-assign sub-role tersebut melalui konfigurasi RBAC tanpa peran baru di level sistem.

---

## 6. Module Requirements

---

### 6.0 Module Map & Rekomendasi Fasing

Total **28 modul** dalam dokumen konsolidasi ini terbagi menjadi Core Modules (wajib untuk semua skala bisnis) dan Enterprise Extension Modules (modular, diaktifkan sesuai kebutuhan/ukuran organisasi).

| Tier | Modul | Karakteristik |
|------|-------|----------------|
| **Tier 0 — Foundation** | 6.1 Auth, 6.2 Master Employee, 6.3 Org Structure | Wajib ada sebelum modul lain berjalan |
| **Tier 1 — Core HR Operasional** | 6.4 Shift, 6.5 Work Calendar, 6.6 Attendance, 6.7 Leave, 6.8 Self Service, 6.9 Payroll, 6.10 Performance, 6.11 Dashboard, 6.12 Notification, 6.13 Audit Log | Kebutuhan dasar hampir seluruh perusahaan (≥20 karyawan) |
| **Tier 2 — Enterprise Operational Extension** | 6.14 ATS, 6.15 Onboarding/Offboarding, 6.16 Asset, 6.17 LMS, 6.18 Comp & Benefit, 6.19 Loan, 6.20 Travel & Expense | Umum dibutuhkan perusahaan menengah (100–500 karyawan) atau dengan proses HR yang lebih matang |
| **Tier 3 — Strategic & Cross-Cutting** | 6.21 Talent & Succession, 6.22 Engagement, 6.23 Workflow Engine, 6.24 DMS, 6.25 Integration Hub | Mendukung skalabilitas dan otomasi lintas modul |
| **Tier 4 — Enterprise/Compliance (>500 karyawan)** | 6.26 Policy & Compliance, 6.27 Disciplinary Action, 6.28 Workforce Planning | Sering disyaratkan perusahaan besar dengan struktur kepatuhan formal |

> Kombinasi Tier 0–4 (modul 6.1–6.28) setara dengan **90–95% fitur** yang umum ditemukan pada produk HRMS enterprise di pasar Indonesia. Urutan implementasi yang disarankan mengikuti Tier di atas — lihat §12 Milestone & Timeline untuk pemetaan ke fase pengembangan.

---

### 6.1 Module Authentication & Authorization

> **Modul tambahan yang direkomendasikan** — fondasi seluruh sistem.

#### 6.1.1 Fitur

- Login dengan email + password (bcrypt hash)
- Multi-tenant support (opsional: satu instance untuk banyak perusahaan)
- JWT Access Token (expire: 1 jam) + Refresh Token (expire: 7 hari)
- Forgot password via email (OTP / reset link, expire 15 menit)
- Ganti password & manajemen sesi aktif
- Pembatasan IP / device (opsional)
- 2FA (Two-Factor Authentication) via email/authenticator app (opsional)
- Session timeout otomatis

#### 6.1.2 Business Rules

- Password minimal 8 karakter, kombinasi huruf besar/kecil, angka, simbol.
- Maksimal 5 kali percobaan login gagal → akun terkunci sementara (15 menit).
- Setiap login/logout tercatat di Audit Log.

#### 6.1.3 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout & invalidate token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request reset password |
| POST | `/api/auth/reset-password` | Set password baru |
| PUT | `/api/auth/change-password` | Ganti password |

---

### 6.2 Module Master Employee

#### 6.2.1 Fitur

- CRUD data karyawan lengkap
- Upload foto profil dan dokumen (KTP, NPWP, BPJS, ijazah, kontrak)
- Status karyawan: Aktif, Probasi, Kontrak, Tetap, Non-Aktif, Resign, PHK
- Manajemen jabatan, level, dan grade karyawan
- Riwayat pekerjaan internal (mutasi, promosi, demosi)
- Nomor Induk Karyawan (NIK) auto-generate (format konfigurabel)
- Data keluarga / emergency contact
- Data rekening bank (untuk payroll)
- Import data karyawan via Excel/CSV
- Export data ke Excel/PDF

#### 6.2.2 Atribut Data Karyawan

**Data Pribadi:**
- NIK (auto), Nama Lengkap, Nama Panggilan
- Tempat & Tanggal Lahir, Jenis Kelamin, Status Pernikahan
- Agama, Kewarganegaraan, No. KTP, NPWP
- Alamat KTP, Alamat Domisili
- No. HP, Email Pribadi, Email Perusahaan

**Data Kepegawaian:**
- Departemen, Sub-Departemen, Jabatan, Level/Grade
- Status Karyawan, Tipe Kontrak
- Tanggal Mulai Kerja, Tanggal Kontrak Berakhir (jika kontrak)
- Atasan Langsung (Reporting Manager)
- Lokasi Kerja / Branch
- Shift Default

**Data Penggajian:**
- Gaji Pokok, Komponen Tunjangan
- No. Rekening Bank, Nama Bank, Nama Pemilik Rekening
- BPJS Ketenagakerjaan No., BPJS Kesehatan No.
- Status PTKP (TK/0, K/1, K/2, dst.)

#### 6.2.3 Business Rules

- NIK bersifat unik dan tidak dapat diubah setelah dikonfirmasi.
- Karyawan resign/PHK dinonaktifkan (soft delete), data historis tetap tersimpan.
- Perubahan data sensitif (gaji, rekening) wajib melalui approval HR Manager.
- Riwayat setiap perubahan data tercatat otomatis.

#### 6.2.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/employees` | List karyawan (filter, search, pagination) |
| POST | `/api/employees` | Tambah karyawan baru |
| GET | `/api/employees/:id` | Detail karyawan |
| PUT | `/api/employees/:id` | Update data karyawan |
| DELETE | `/api/employees/:id` | Nonaktifkan karyawan (soft delete) |
| POST | `/api/employees/import` | Import bulk via CSV/Excel |
| GET | `/api/employees/:id/history` | Riwayat perubahan karyawan |
| POST | `/api/employees/:id/documents` | Upload dokumen karyawan |

---

### 6.3 Module Organization Structure

#### 6.3.1 Fitur

- Manajemen perusahaan/holding (multi-company support)
- Manajemen divisi, departemen, sub-departemen
- Manajemen jabatan (position) dan level
- Manajemen lokasi kerja / cabang (branch)
- Visualisasi struktur organisasi (org chart) interaktif
- Assign kepala departemen / PIC tiap unit
- Riwayat perubahan struktur organisasi

#### 6.3.2 Hierarki Entitas

```
Perusahaan (Company)
  └── Divisi (Division)
        └── Departemen (Department)
              └── Sub-Departemen (Sub-Department)
                    └── Jabatan (Position) + Level/Grade
```

#### 6.3.3 Atribut

- **Company:** Nama, Logo, NPWP Perusahaan, Alamat, No. Telp, Bidang Usaha
- **Division/Department:** Kode, Nama, Deskripsi, Kepala Unit, Status
- **Position:** Kode Jabatan, Nama Jabatan, Level (Junior/Senior/Lead/Manager), Grade, Job Description

#### 6.3.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/companies` | List perusahaan |
| GET/POST/PUT/DELETE | `/api/departments` | CRUD departemen |
| GET/POST/PUT/DELETE | `/api/positions` | CRUD jabatan |
| GET/POST/PUT/DELETE | `/api/branches` | CRUD cabang/lokasi |
| GET | `/api/org-chart` | Data untuk visualisasi org chart |

---

### 6.4 Module Shift Management

#### 6.4.1 Fitur

- Konfigurasi shift kerja (nama, jam masuk, jam keluar, toleransi keterlambatan)
- Pengaturan hari kerja per shift (Senin–Jumat, Senin–Sabtu, dll.)
- Penjadwalan shift karyawan (mingguan/bulanan)
- Shift reguler, fleksibel (flexi time), dan shift rotasi
- Pengaturan lembur (overtime): batas jam, rate perhitungan
- Jadwal hari libur nasional & cuti bersama (holiday calendar)
- Copy jadwal shift (minggu/bulan sebelumnya)
- Bulk assignment shift ke grup/departemen
- Export jadwal shift ke Excel/PDF

#### 6.4.2 Tipe Shift

| Tipe | Deskripsi |
|------|-----------|
| **Fixed Shift** | Jam masuk-keluar tetap (misal: 08:00–17:00) |
| **Flexi Shift** | Jam masuk fleksibel, total jam kerja ditentukan (misal: 8 jam/hari) |
| **Rotating Shift** | Jadwal bergantian (Pagi/Siang/Malam) |
| **Split Shift** | Dua sesi dalam satu hari (misal: 07:00–12:00 & 17:00–22:00) |

#### 6.4.3 Business Rules

- Setiap karyawan harus memiliki shift aktif.
- Perubahan shift yang sudah berjalan harus disetujui oleh Manager.
- Sistem otomatis mendeteksi lembur jika jam kerja melebihi batas shift.
- Toleransi keterlambatan terkonfigurasi per shift (misal: 15 menit grace period).

#### 6.4.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST/PUT/DELETE | `/api/shifts` | CRUD konfigurasi shift |
| GET | `/api/schedules` | Lihat jadwal shift |
| POST | `/api/schedules/assign` | Assign shift ke karyawan |
| GET | `/api/holidays` | List hari libur nasional |
| POST | `/api/holidays` | Tambah libur/cuti bersama |

---

### 6.5 Module Work Calendar

> **Modul baru** — menjadi pusat acuan tunggal (single source of truth) untuk hari kerja, hari libur, cuti bersama, dan jadwal shift; digunakan oleh Attendance, Leave Management, Payroll, dan Dashboard.

#### 6.5.1 Latar Belakang & Tujuan

Tanpa Work Calendar yang terpusat, setiap modul mendefinisikan hari kerja secara terpisah sehingga rentan inkonsistensi (misal: Attendance menghitung hari kerja berbeda dengan Payroll). Work Calendar menjadi **referensi resmi** sehingga:

- Attendance tahu hari mana yang harus ada clock-in dan mana yang libur.
- Leave Management menghitung hari kerja secara akurat saat validasi saldo cuti.
- Payroll menghitung pro-rata gaji dan tunjangan kehadiran berbasis hari kerja nyata.
- Dashboard dapat menampilkan progres kehadiran vs target hari kerja bulan berjalan.

#### 6.5.2 Fitur

**Manajemen Kalender:**
- Buat dan kelola kalender per perusahaan/branch/departemen (multi-level calendar)
- Tetapkan hari kerja default per minggu (misal: Senin–Jumat atau Senin–Sabtu)
- Atur jam operasional harian (dapat berbeda per hari, misal Sabtu jam kerja lebih pendek)
- Salin kalender tahun lalu sebagai template tahun baru (copy & adjust)
- Konfigurasi kalender khusus per departemen (misal: divisi produksi beda hari libur)

**Manajemen Hari Libur:**
- Import hari libur nasional Indonesia otomatis (via API publik atau upload CSV)
- Tambah/edit/hapus hari libur nasional secara manual
- Tandai cuti bersama yang ditetapkan pemerintah
- Hari libur khusus perusahaan (ulang tahun perusahaan, acara internal, dll.)
- Hari libur per lokasi/branch (libur daerah yang berbeda antar kota)

**Visualisasi Kalender:**
- Tampilan kalender bulanan interaktif (monthly calendar view)
- Tampilan mingguan (weekly view) untuk monitoring shift + kehadiran
- Tampilan harian (daily view) lengkap dengan daftar hadir karyawan
- Color coding: hari kerja, libur nasional, cuti bersama, weekend, hari dengan event khusus
- Filter by: perusahaan, branch, departemen, karyawan

**Integrasi & Sinkronisasi:**
- Sync otomatis ke module Attendance (penentuan hari wajib hadir)
- Sync otomatis ke module Leave Management (kalkulasi hari kerja saat pengajuan cuti)
- Sync otomatis ke module Payroll (jumlah hari kerja efektif per bulan untuk pro-rata)
- Sync jadwal shift dari module Shift Management ke tampilan kalender
- Tampilkan status kehadiran karyawan langsung di kalender (overlay)
- Tampilkan pengajuan cuti/izin yang approved langsung di kalender tim

**Fitur Monitoring:**
- Kalender tim: HR/Manager melihat jadwal + status seluruh anggota tim dalam satu view
- Highlight konflik: hari yang banyak karyawan cuti bersamaan (risiko kekurangan SDM)
- Notifikasi otomatis: kalender belum dikonfigurasi untuk bulan/tahun mendatang
- Export kalender ke PDF / Excel / format iCal (.ics)

#### 6.5.3 Tipe Hari dalam Work Calendar

| Tipe Hari | Kode | Deskripsi | Wajib Hadir? |
|-----------|------|-----------|:------------:|
| Hari Kerja Normal | WD | Senin–Jumat / sesuai konfigurasi | ✅ |
| Hari Kerja Sabtu | WS | Sabtu (jika 6 hari kerja) | ✅ |
| Weekend / Hari Istirahat | WE | Minggu / hari libur rutin | ❌ |
| Libur Nasional | NH | Libur ditetapkan pemerintah | ❌ |
| Cuti Bersama | JL | Cuti bersama pemerintah | ❌ |
| Libur Perusahaan | CH | Hari libur khusus perusahaan | ❌ |
| Libur Daerah | RH | Libur regional/provinsi | ❌ |
| Hari Kerja Lembur | OT | Hari libur yang dijadikan hari kerja (dengan approval) | ✅ (OT) |

#### 6.5.4 Hierarki & Prioritas Kalender

Sistem menggunakan kalender berbasis hierarki — kalender level lebih rendah akan **override** level di atasnya untuk entitas yang bersangkutan:

```
Level 1: Company Calendar (default untuk semua)
    ↓ override jika ada
Level 2: Branch Calendar (lokasi/cabang spesifik)
    ↓ override jika ada
Level 3: Department Calendar (departemen spesifik)
    ↓ override jika ada
Level 4: Employee Calendar (jadwal individu, mis. WFH schedule)
```

**Contoh:** Hari Senin adalah hari libur daerah di Bali (Branch Calendar), maka karyawan di cabang Bali otomatis libur, sementara karyawan Jakarta (mengacu Company Calendar) tetap masuk.

#### 6.5.5 Integrasi Detail dengan Modul Lain

**→ Shift Management (6.4)**
- Work Calendar membaca jam kerja dari konfigurasi shift yang diassign ke karyawan.
- Jika suatu hari dikategorikan `NH` atau `CH` di kalender, sistem **tidak akan membuat jadwal shift** pada hari tersebut, kecuali ada pengajuan kerja di hari libur (overtime).
- Jadwal shift muncul sebagai overlay di tampilan kalender.

**→ Attendance (6.6)**
- Setiap hari, sistem mencek Work Calendar untuk menentukan apakah karyawan **wajib hadir** atau tidak.
- Karyawan tidak akan ditandai "Absen" pada hari yang dikategorikan libur di Work Calendar.
- Tampilan kalender kehadiran: setiap hari memiliki indikator status kehadiran (hadir/terlambat/absen/cuti/izin).
- Rekap hari kerja efektif otomatis dihitung dari Work Calendar × Shift karyawan.

**→ Leave Management (6.7)**
- Saat karyawan mengajukan cuti, sistem menghitung **total hari kerja** (bukan hari kalender) berdasarkan Work Calendar.
  - Contoh: cuti Jumat–Senin hanya terhitung **2 hari kerja** (Sabtu–Minggu tidak dihitung).
- Hari libur nasional yang jatuh dalam periode cuti tidak mengurangi saldo cuti.
- Validasi: pengajuan cuti di hari libur nasional akan ditolak otomatis.

**→ Self Service Request (6.8)**
- Pengajuan izin dan koreksi absensi mempertimbangkan Work Calendar untuk validasi.
- Pengajuan kerja di hari libur (request overtime on holiday) mengacu ke tipe hari `OT` di Work Calendar.
- Kalender tim tersedia di self-service agar karyawan tahu jadwal rekan sebelum mengajukan cuti.

**→ Payroll (6.9)**
- Jumlah **hari kerja efektif** per bulan diambil langsung dari Work Calendar (bukan dihitung manual).
- Pro-rata gaji karyawan baru/resign menggunakan hari kerja Work Calendar, bukan hari kalender.
- Tunjangan kehadiran dihitung berdasarkan rasio: `(hadir / hari kerja efektif) × nominal tunjangan`.
- Lembur di hari libur (`OT` / `NH`) mendapat rate multiplier berbeda (1.5× / 2× sesuai UU).

**→ Dashboard & Reporting (6.11)**
- Widget "Progres Kehadiran Bulan Ini": `(hari hadir / hari kerja efektif s.d. hari ini) × 100%`.
- Grafik kalender heatmap kehadiran team per bulan.
- Alert: hari-hari mendatang dimana banyak karyawan mengambil cuti (potensi understaffing).
- Laporan hari kerja efektif per bulan sebagai lampiran laporan payroll.

**→ Notification & Alert (6.12)**
- Notifikasi ke HR jika kalender bulan berikutnya belum dikonfigurasi (H-7).
- Notifikasi ke Manager jika > N% tim mengambil cuti pada hari yang sama (threshold konfigurabel).
- Notifikasi ke karyawan: reminder hari libur panjang akan datang.
- Alert: jika ada pengajuan lembur di hari libur nasional yang belum di-approve.

#### 6.5.6 Views & UI Specification

**Monthly Calendar View (Web):**
```
┌─────────────────────────────────────────────────────────┐
│  ◄  Juli 2026                              [Filter ▼]   │
│  Branch: Jakarta HQ   Dept: Engineering   [Export]      │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────┤
│  Sen │  Sel │  Rab │  Kam │  Jum │  Sab │  Min         │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────┤
│  1   │  2   │  3   │  4   │  5   │  6   │  7           │
│ [WD] │ [WD] │ [WD] │ [WD] │ [WD] │ [WE] │ [WE]        │
│ 45/50│ 48/50│ 47/50│ 50/50│ 42/50│      │              │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────┤
│  8   │  9   │  10  │  11  │ 12   │  13  │  14          │
│ [WD] │ [NH] │ [WD] │ [WD] │ [WD] │ [WE] │ [WE]        │
│      │ Libur│      │      │      │      │              │
│      │ Muharram    │      │      │      │              │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────────┘
Legend: [WD]=Kerja  [NH]=Libur Nasional  [WE]=Weekend
        Angka = jumlah hadir / total karyawan
```

**Employee Calendar View (Mobile):**
- Tampilan personal karyawan: status kehadiran harian, jadwal shift, cuti approved, pengajuan pending.
- Swipe kiri-kanan untuk navigasi bulan.
- Tap tanggal → detail hari (jam clock in/out, status, shift, dll.).

#### 6.5.7 Business Rules

- Kalender wajib dikonfigurasi sebelum periode berjalan (minimal konfigurasi libur nasional untuk setahun penuh).
- Satu perusahaan dapat memiliki lebih dari satu kalender (per branch/departemen).
- Jika tidak ada kalender khusus di level bawah, sistem menggunakan kalender company sebagai default.
- Hari kerja lembur (`OT`) di hari libur wajib melalui pengajuan dan approval terlebih dahulu.
- Kalender yang sudah digunakan dalam periode payroll yang ter-finalisasi tidak dapat diubah.
- Import hari libur nasional otomatis dilakukan setiap awal tahun (via cron job), dapat di-override HR.
- Perubahan kalender yang berdampak pada data absensi yang sudah ada memerlukan konfirmasi dan tercatat di Audit Log.

#### 6.5.8 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/work-calendars` | List kalender yang tersedia |
| POST | `/api/work-calendars` | Buat kalender baru |
| GET | `/api/work-calendars/:id` | Detail kalender |
| PUT | `/api/work-calendars/:id` | Update kalender |
| DELETE | `/api/work-calendars/:id` | Hapus kalender (jika belum digunakan) |
| GET | `/api/work-calendars/:id/days` | Daftar hari dalam kalender (filter by month/year) |
| PUT | `/api/work-calendars/:id/days` | Bulk update tipe hari (batch) |
| POST | `/api/work-calendars/:id/copy` | Salin kalender ke tahun baru |
| GET | `/api/work-calendars/holidays` | List hari libur nasional (semua/per tahun) |
| POST | `/api/work-calendars/holidays/import` | Import hari libur nasional (CSV / API) |
| POST | `/api/work-calendars/holidays` | Tambah hari libur manual |
| PUT | `/api/work-calendars/holidays/:id` | Edit hari libur |
| DELETE | `/api/work-calendars/holidays/:id` | Hapus hari libur |
| GET | `/api/work-calendars/employee/:employeeId` | Kalender berlaku untuk karyawan tertentu |
| GET | `/api/work-calendars/team/:managerId` | Kalender + status tim untuk manager |
| GET | `/api/work-calendars/working-days` | Hitung hari kerja efektif (query: start, end, calendarId) |
| GET | `/api/work-calendars/export` | Export kalender ke PDF/Excel/iCal |

#### 6.5.9 Database Schema — Work Calendar

```sql
-- Definisi kalender (bisa per company, branch, atau department)
work_calendars (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  company_id      INT NOT NULL,
  branch_id       INT NULL,           -- NULL = berlaku untuk semua branch
  department_id   INT NULL,           -- NULL = berlaku untuk semua dept
  name            VARCHAR(100) NOT NULL,
  year            INT NOT NULL,
  work_days       JSON NOT NULL,      -- {"mon":true,"tue":true,...,"sat":false,"sun":false}
  default_shift_id INT NULL,          -- Shift default kalender ini
  is_active       BOOLEAN DEFAULT TRUE,
  description     TEXT NULL,
  created_by      INT NOT NULL,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uq_calendar (company_id, branch_id, department_id, year)
)

-- Detail per hari (hanya hari yang berbeda dari default)
work_calendar_days (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  calendar_id     INT NOT NULL,
  date            DATE NOT NULL,
  day_type        ENUM('WD','WS','WE','NH','JL','CH','RH','OT') NOT NULL,
  name            VARCHAR(150) NULL,  -- Nama hari libur / event
  notes           TEXT NULL,
  work_start      TIME NULL,          -- Override jam kerja (jika berbeda dari shift)
  work_end        TIME NULL,
  is_mandatory    BOOLEAN DEFAULT FALSE, -- Wajib masuk walaupun libur (OT)
  created_by      INT NOT NULL,
  created_at      DATETIME NOT NULL,
  UNIQUE KEY uq_calendar_date (calendar_id, date)
)

-- Master hari libur nasional (referensi, bisa digunakan lintas kalender)
national_holidays (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  country_code    CHAR(2) DEFAULT 'ID',
  date            DATE NOT NULL,
  name            VARCHAR(150) NOT NULL,
  type            ENUM('NH','JL') NOT NULL,
  year            INT NOT NULL,
  source          VARCHAR(100) NULL,  -- 'government', 'manual', 'api_import'
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  UNIQUE KEY uq_holiday (country_code, date)
)

-- Index
-- INDEX idx_wcd_calendar_date (calendar_id, date)
-- INDEX idx_wcd_day_type (day_type)
-- INDEX idx_nh_year (year, country_code)
```

---

### 6.6 Module Attendance

#### 6.6.1 Fitur

- Pencatatan kehadiran: Clock In / Clock Out
- Multi-metode absensi:
  - **Mobile App** (GPS-based dengan geofencing)
  - **QR Code** (scan via mobile app)
  - **Face Recognition** (integrasi opsional)
  - **Manual Entry** oleh HR (untuk koreksi)
- Validasi lokasi kerja (geofencing radius konfigurabel per branch)
- Foto selfie wajib saat clock in/out (opsional, konfigurabel)
- Deteksi anomali: absensi ganda, lokasi di luar radius, lembur otomatis
- Rekap kehadiran harian, mingguan, bulanan per karyawan
- Laporan absensi: hadir, terlambat, pulang cepat, tidak hadir, izin, sakit
- Koreksi absensi oleh HR dengan alasan & bukti pendukung
- Sinkronisasi data absensi offline (mobile)
- **Referensi Work Calendar:** status kehadiran dan hari wajib hadir mengacu ke Work Calendar

#### 6.6.2 Status Kehadiran

| Kode | Status | Deskripsi |
|------|--------|-----------|
| H | Hadir | Clock in & out normal sesuai shift |
| T | Terlambat | Clock in melewati toleransi |
| PL | Pulang Lebih Cepat | Clock out sebelum jam selesai |
| A | Absen | Tidak ada catatan absensi |
| I | Izin | Disetujui via self-service |
| S | Sakit | Disetujui dengan/tanpa surat dokter |
| C | Cuti | Disetujui via leave management |
| L | Lembur | Clock out melewati jam shift |
| D | Dinas Luar | On duty / perjalanan dinas |
| LN | Libur Nasional | Hari libur nasional |

#### 6.6.3 Business Rules

- Sistem otomatis menandai karyawan "Absen" jika tidak ada clock in hingga batas waktu tertentu.
- **Sistem tidak membuat record "Absen" pada hari yang dikategorikan libur di Work Calendar.**
- Koreksi absensi memerlukan alasan tertulis dan approval atasan.
- Lembur dihitung otomatis jika clock out > batas shift + toleransi.
- Rekap bulanan dikunci setelah tanggal cutoff payroll.

#### 6.6.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/attendance/clock-in` | Catat clock in |
| POST | `/api/attendance/clock-out` | Catat clock out |
| GET | `/api/attendance` | List kehadiran (filter by employee, date) |
| GET | `/api/attendance/:id` | Detail kehadiran |
| PUT | `/api/attendance/:id/correction` | Koreksi absensi |
| GET | `/api/attendance/summary` | Rekap kehadiran bulanan |
| GET | `/api/attendance/report` | Laporan kehadiran (export) |

---

### 6.7 Module Leave Management

#### 6.7.1 Fitur

- Konfigurasi jenis cuti: cuti tahunan, cuti sakit, cuti melahirkan, cuti besar, dll.
- Penghitungan saldo cuti otomatis berdasarkan masa kerja
- Pengajuan cuti oleh karyawan (self-service)
- Approval cuti bertingkat (Manager → HR Manager, konfigurabel)
- Penolakan cuti dengan alasan wajib
- Transfer/carry-over saldo cuti antar tahun (konfigurabel)
- Monitoring saldo cuti real-time
- Kalkulasi cuti proporsional untuk karyawan baru
- Laporan penggunaan cuti per departemen/individu
- Notifikasi pengajuan, approval, penolakan

#### 6.7.2 Jenis Cuti (Konfigurabel)

| Jenis Cuti | Ket | Saldo Default |
|------------|-----|---------------|
| Cuti Tahunan | Hak dasar sesuai UU | 12 hari/tahun |
| Cuti Sakit | Dengan surat dokter | Tidak terbatas (limit konfigurabel) |
| Cuti Bersalin | Karyawan perempuan | 3 bulan |
| Cuti Suami/Istri Melahirkan | Karyawan laki-laki | 2 hari |
| Cuti Haid | Karyawan perempuan | 2 hari/bulan |
| Cuti Pernikahan | Karyawan menikah | 3 hari |
| Cuti Duka | Keluarga inti meninggal | 2 hari |
| Cuti Besar | Masa kerja tertentu | Konfigurabel |
| Cuti Tanpa Gaji (CLTN) | Persetujuan khusus | - |

#### 6.7.3 Business Rules

- Pengajuan cuti minimal H-3 (konfigurabel per jenis cuti).
- Cuti tidak dapat diajukan jika saldo tidak cukup, kecuali jenis cuti tertentu (sakit).
- **Kalkulasi hari cuti mengacu ke Work Calendar** — hari libur nasional & weekend dalam periode cuti tidak terhitung sebagai hari cuti.
- Cuti tahunan yang tidak diambil dapat di-carry-over maksimal N hari (konfigurabel).
- Sistem otomatis mengurangi saldo saat cuti disetujui.
- Cuti dibatalkan (oleh karyawan atau HR) mengembalikan saldo.
- Pengajuan cuti di hari libur nasional (sesuai Work Calendar) ditolak otomatis dengan notifikasi.

#### 6.7.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/leave-types` | List jenis cuti |
| GET | `/api/leave-balance/:employeeId` | Saldo cuti karyawan |
| GET | `/api/leave-requests` | List pengajuan cuti |
| POST | `/api/leave-requests` | Ajukan cuti |
| PUT | `/api/leave-requests/:id/approve` | Setujui cuti |
| PUT | `/api/leave-requests/:id/reject` | Tolak cuti |
| PUT | `/api/leave-requests/:id/cancel` | Batalkan cuti |
| GET | `/api/leave-requests/report` | Laporan cuti |

---

### 6.8 Module Self Service Request

#### 6.8.1 Fitur

Karyawan dapat mengajukan berbagai permintaan secara mandiri melalui web maupun mobile app:

**Tipe Request:**
- Pengajuan Cuti (terintegrasi dengan Leave Management)
- Pengajuan Izin (tidak masuk/terlambat/pulang cepat)
- Pengajuan Sakit (dengan upload surat dokter)
- Pengajuan On Duty / Perjalanan Dinas
- Koreksi Absensi (clock in/out yang terlewat/salah)
- Lembur (pengajuan lembur sebelum atau sesudah pelaksanaan)
- Penggantian Shift
- Permohonan Data (slip gaji, surat keterangan kerja, dll.)

#### 6.8.2 Alur Proses

```
Karyawan Submit Request
       ↓
Notifikasi ke Approver (Atasan Langsung)
       ↓
Review oleh Approver
       ↓ (jika perlu HR review)
Review oleh HR Staff/Manager
       ↓
Approved / Rejected
       ↓
Notifikasi ke Karyawan
       ↓
Data terupdate di modul terkait (Absensi, Leave, dll.)
```

#### 6.8.3 Atribut Request

- Tipe request, Tanggal/waktu yang dimaksud
- Alasan/Keterangan
- Dokumen pendukung (upload file, maks. 5MB per file)
- Status: Draft, Pending, Approved, Rejected, Cancelled
- Riwayat approval dengan timestamp dan komentar

#### 6.8.4 Business Rules

- Request yang sudah diproses (approved/rejected) tidak dapat diedit karyawan.
- Approver dapat mendelegasikan approval saat tidak aktif (delegation feature).
- Notifikasi otomatis jika request tidak diproses > X hari (konfigurabel, misal: 3 hari).
- Request lembur harus diajukan minimal 1 hari sebelumnya (atau sesuai kebijakan).
- **Pengajuan izin/koreksi divalidasi terhadap Work Calendar** — izin di hari libur tidak perlu diajukan.
- Karyawan dapat melihat **kalender tim** sebelum mengajukan cuti untuk menghindari konflik.

#### 6.8.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/requests` | List request karyawan |
| POST | `/api/requests` | Buat request baru |
| GET | `/api/requests/:id` | Detail request |
| PUT | `/api/requests/:id/cancel` | Batalkan request |
| PUT | `/api/requests/:id/approve` | Setujui request (approver) |
| PUT | `/api/requests/:id/reject` | Tolak request (approver) |
| GET | `/api/requests/pending` | List pending approval untuk approver |

---

### 6.9 Module Payroll

#### 6.9.1 Fitur

- Konfigurasi komponen gaji: tunjangan tetap & tidak tetap, potongan
- Proses penggajian bulanan (payroll run)
- Kalkulasi otomatis:
  - Gaji pokok (pro-rata untuk karyawan baru/resign)
  - Tunjangan berdasarkan kehadiran (transport, makan)
  - Potongan ketidakhadiran, keterlambatan
  - Lembur (mengacu ke rekap absensi)
  - Potongan BPJS Ketenagakerjaan & BPJS Kesehatan
  - Pemotongan PPh 21 (PTKP, metode nett/gross/gross up)
  - Potongan pinjaman karyawan (jika ada modul pinjaman)
- Slip gaji digital (PDF, dapat diunduh karyawan)
- Export data payroll ke format bank (CSV transfer gaji)
- Revisi payroll sebelum finalisasi
- Riwayat payroll per karyawan
- Laporan payroll: summary, detail, rekap PPh 21, rekap BPJS

#### 6.9.2 Komponen Gaji (Konfigurabel)

**Penghasilan (Earnings):**
- Gaji Pokok
- Tunjangan Jabatan
- Tunjangan Transport
- Tunjangan Makan
- Tunjangan Kehadiran
- Uang Lembur
- Bonus / THR

**Potongan (Deductions):**
- BPJS Ketenagakerjaan (JHT: 2%, JP: 1%)
- BPJS Kesehatan (1%)
- PPh 21
- Potongan Ketidakhadiran
- Potongan Keterlambatan (jika diterapkan)
- Cicilan Pinjaman

#### 6.9.3 Alur Payroll Run

```
1. HR/Finance membuka periode payroll
2. System mengambil data:
   - Jumlah hari kerja efektif dari Work Calendar
   - Rekap absensi bulan berjalan
   - Saldo izin/cuti yang diambil
   - Data lembur yang disetujui
3. Kalkulasi otomatis semua komponen
   (pro-rata & tunjangan berbasis hari kerja Work Calendar)
4. Preview & review oleh Finance
5. Revisi jika ada ketidaksesuaian
6. Finalisasi payroll
7. Generate slip gaji (PDF)
8. Export file transfer bank
9. Distribusi slip gaji ke karyawan
10. Lock periode payroll (tidak bisa diubah)
```

#### 6.9.4 Business Rules

- Payroll hanya bisa difinalisasi oleh Finance Admin + disetujui HR Manager.
- Setelah finalisasi, data payroll terkunci (tidak bisa diedit).
- PPh 21 dihitung sesuai regulasi perpajakan Indonesia yang berlaku.
- BPJS dihitung berdasarkan batas upah yang ditetapkan pemerintah.
- **Pro-rata gaji dihitung berdasarkan hari kerja efektif dari Work Calendar**, bukan jumlah hari kalender.
- Lembur di hari libur nasional (Work Calendar tipe `NH`) dihitung 2× upah; hari libur perusahaan 1.5×.

#### 6.9.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/payroll/periods` | List periode payroll |
| POST | `/api/payroll/run` | Jalankan proses payroll |
| GET | `/api/payroll/:periodId` | Detail payroll periode |
| PUT | `/api/payroll/:periodId/finalize` | Finalisasi payroll |
| GET | `/api/payroll/slip/:employeeId/:periodId` | Slip gaji karyawan |
| GET | `/api/payroll/report` | Laporan payroll |
| GET | `/api/payroll/export-bank` | Export file transfer bank |
| GET | `/api/salary-components` | List komponen gaji |
| POST/PUT | `/api/salary-components` | Konfigurasi komponen gaji |

---

### 6.10 Module Performance Management

#### 6.10.1 Fitur

**KPI (Key Performance Indicator):**
- Konfigurasi KPI template per jabatan/departemen
- Assignment KPI ke individu karyawan
- Target & bobot per indikator KPI
- Input realisasi KPI (oleh karyawan / atasan)
- Kalkulasi skor KPI otomatis berdasarkan formula (achievement vs target)
- Tracking pencapaian KPI bulanan/kuartalan/tahunan

**Appraisal (Penilaian Kinerja):**
- Konfigurasi siklus appraisal (semesteran / tahunan)
- Multi-rater: self-assessment, atasan, peer review (360°)
- Formulir penilaian kompetens (soft skill & hard skill)
- Kalibrasi nilai antar departemen oleh HR
- Rating akhir: Outstanding / Exceed / Meet / Below / Poor
- Rencana pengembangan individu (Individual Development Plan / IDP)
- Histori appraisal karyawan

#### 6.10.2 Struktur KPI

```
KPI Template (per Jabatan)
  └── Perspektif (Finansial, Pelanggan, Proses, Pertumbuhan)
        └── Indikator KPI
              ├── Deskripsi & Unit Ukur
              ├── Target
              ├── Bobot (%)
              └── Formula Kalkulasi (% Achievement)
```

#### 6.10.3 Alur Appraisal

```
1. HR membuka siklus appraisal
2. Karyawan mengisi self-assessment (+ input realisasi KPI)
3. Atasan mengisi penilaian (kompetensi + validasi KPI)
4. Peer review (jika 360°)
5. Kalibrasi oleh HR (opsional)
6. Finalisasi rating oleh Atasan
7. Diskusi & konfirmasi dengan karyawan (acknowledgement)
8. Lock hasil appraisal
9. Generate laporan appraisal
```

#### 6.10.4 Business Rules

- Self-assessment harus diisi sebelum batas waktu (deadline dikonfigurasi HR).
- Nilai akhir tidak dapat diubah setelah karyawan memberikan acknowledgement.
- Rating "Poor" otomatis memicu notifikasi ke HR untuk tindak lanjut.
- Hasil appraisal dapat terintegrasi dengan kenaikan gaji (salary increment) di modul Payroll.

#### 6.10.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST/PUT | `/api/kpi-templates` | CRUD template KPI |
| POST | `/api/kpi-assignments` | Assign KPI ke karyawan |
| PUT | `/api/kpi-assignments/:id/realization` | Input realisasi KPI |
| GET | `/api/kpi-assignments/:id/score` | Kalkulasi skor KPI |
| GET/POST | `/api/appraisal-cycles` | Manajemen siklus appraisal |
| POST | `/api/appraisals` | Buat formulir appraisal |
| PUT | `/api/appraisals/:id/self-assessment` | Isi self-assessment |
| PUT | `/api/appraisals/:id/manager-review` | Isi penilaian atasan |
| PUT | `/api/appraisals/:id/finalize` | Finalisasi appraisal |
| GET | `/api/appraisals/report` | Laporan appraisal |

---

### 6.11 Module Dashboard & Reporting

#### 6.11.1 Dashboard per Role

**Super Admin & HR Manager Dashboard:**
- Total karyawan aktif, baru, resign (bulan ini)
- Grafik kehadiran hari ini (hadir, absen, izin, cuti)
- Karyawan terlambat hari ini
- Pengajuan pending (cuti, izin, koreksi) yang perlu approval
- Distribusi karyawan per departemen (pie chart)
- Tren kehadiran bulanan (line chart)
- Biaya payroll bulan berjalan vs bulan lalu
- Top 5 pengambil cuti terbanyak
- **Widget kalender bulanan: heatmap kehadiran tim & highlight hari libur (dari Work Calendar)**
- **Hari kerja efektif bulan ini vs bulan lalu (dari Work Calendar)**
- Notifikasi: kontrak akan berakhir, ulang tahun karyawan, masa percobaan berakhir

**Manager Dashboard:**
- Kehadiran tim hari ini
- Pengajuan pending dari tim
- KPI tracking tim
- Jadwal shift tim minggu ini
- **Kalender tim: siapa saja yang cuti/izin minggu ini (dari Work Calendar + Leave)**

**Employee Dashboard (Self-Service):**
- Status kehadiran hari ini
- Saldo cuti tersisa
- Pengajuan yang sedang diproses
- Slip gaji terbaru
- Jadwal shift minggu ini
- **Mini kalender: jadwal pribadi (shift, cuti approved, hari libur)**
- Notifikasi personal

#### 6.11.2 Laporan (Reports)

| Laporan | Format | Frekuensi |
|---------|--------|-----------|
| Rekap Kehadiran Bulanan | Excel, PDF | Bulanan |
| Laporan Keterlambatan | Excel, PDF | Bulanan |
| Laporan Lembur | Excel, PDF | Bulanan |
| Rekap Cuti per Karyawan | Excel, PDF | On-demand |
| **Laporan Hari Kerja Efektif (Work Calendar)** | Excel, PDF | Bulanan |
| Summary Payroll | Excel, PDF | Bulanan |
| Rekap PPh 21 (SPT Masa) | Excel | Bulanan |
| Rekap Iuran BPJS | Excel | Bulanan |
| Laporan KPI | Excel, PDF | Kuartalan |
| Laporan Appraisal | Excel, PDF | Semesteran/Tahunan |
| Laporan Turnover Karyawan | Excel, PDF | Bulanan |

#### 6.11.3 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/dashboard/summary` | Data summary dashboard |
| GET | `/api/dashboard/attendance-today` | Kehadiran hari ini |
| GET | `/api/dashboard/pending-approvals` | List pending approval |
| GET | `/api/dashboard/calendar-overview` | Overview kalender tim (bulan ini) |
| GET | `/api/reports/attendance` | Export laporan kehadiran |
| GET | `/api/reports/payroll` | Export laporan payroll |
| GET | `/api/reports/leave` | Export laporan cuti |
| GET | `/api/reports/performance` | Export laporan kinerja |
| GET | `/api/reports/work-calendar` | Export laporan hari kerja efektif |

---

### 6.12 Module Notification & Alert

> **Modul tambahan yang direkomendasikan** — mendukung operasional seluruh modul.

#### 6.12.1 Fitur

- Notifikasi in-app (web & mobile)
- Notifikasi push notification (mobile via FCM)
- Notifikasi email (Nodemailer)
- Konfigurasi jenis notifikasi yang diaktifkan per role
- Riwayat notifikasi (read/unread)

#### 6.12.2 Trigger Notifikasi

| Event | Penerima |
|-------|----------|
| Pengajuan cuti/izin baru | Approver |
| Cuti/izin disetujui/ditolak | Karyawan |
| Koreksi absensi pending | HR Staff |
| Payroll telah diproses | Karyawan |
| Kontrak karyawan akan berakhir (H-30, H-7) | HR Manager |
| Masa percobaan akan selesai (H-14) | HR Manager & Manager |
| Jadwal shift berubah | Karyawan terdampak |
| Appraisal dibuka / deadline | Karyawan & Manager |
| Request tidak diproses > N hari | Approver |
| Clock in belum dilakukan setelah batas waktu | Karyawan |
| **Kalender bulan berikutnya belum dikonfigurasi (H-7)** | HR Manager |
| **> N% tim mengambil cuti pada hari yang sama** | Manager |
| **Hari libur panjang akan datang (H-3)** | Seluruh karyawan |
| **Pengajuan lembur di hari libur nasional menunggu approval** | Manager & HR |
| **Perubahan Work Calendar berdampak pada data absensi aktif** | HR Manager |

#### 6.12.3 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/notifications` | List notifikasi user |
| PUT | `/api/notifications/:id/read` | Tandai sudah dibaca |
| PUT | `/api/notifications/read-all` | Tandai semua dibaca |
| GET | `/api/notifications/unread-count` | Jumlah notifikasi belum dibaca |

---

### 6.13 Module Audit Log

#### 6.13.1 Fitur

- Pencatatan otomatis seluruh aktivitas kritis dalam sistem
- Tidak bisa diedit atau dihapus (append-only)
- Filter log: by user, by module, by action, by date range
- Search full-text pada detail log
- Export audit log ke Excel/CSV
- Retention policy (log disimpan minimum 2 tahun)

#### 6.13.2 Data yang Dicatat

Setiap entri audit log mencakup:
- **Timestamp:** Waktu kejadian (UTC)
- **User:** ID, Nama, Role user yang melakukan aksi
- **IP Address:** Alamat IP dan device info
- **Module:** Modul yang terdampak
- **Action:** CREATE / READ / UPDATE / DELETE / LOGIN / LOGOUT / APPROVE / REJECT / EXPORT
- **Entity:** Nama entitas dan ID record
- **Before Value:** Data sebelum perubahan (JSON, untuk UPDATE)
- **After Value:** Data setelah perubahan (JSON, untuk UPDATE)
- **Status:** Success / Failed
- **Additional Info:** Keterangan tambahan jika ada

#### 6.13.3 Aksi yang Wajib Di-log

- Semua CRUD pada data karyawan
- Login / Logout / Failed Login
- Perubahan password & reset password
- Semua approval / rejection
- Proses payroll (run, revisi, finalisasi)
- Export data apapun
- Perubahan konfigurasi sistem
- Akses ke data sensitif (gaji, rekening bank)
- **Semua perubahan Work Calendar (terutama yang berdampak pada periode aktif)**
- **Import hari libur nasional**

#### 6.13.4 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/audit-logs` | List audit log (filter, search, pagination) |
| GET | `/api/audit-logs/:id` | Detail audit log |
| GET | `/api/audit-logs/export` | Export audit log |

---

---

> ### BAGIAN II — ENTERPRISE EXTENSION MODULE
>
> Modul 6.14–6.28 merupakan hasil konsolidasi dari **PRD HRM System v2.0.0** ke dalam struktur dokumen v1.1.0, dengan setiap modul dilengkapi Business Rules, Database Schema, dan API Endpoints agar setara kedalaman detailnya dengan modul inti (6.1–6.13). Modul-modul ini bersifat **opsional/modular** dan dapat diaktifkan secara bertahap sesuai kebutuhan dan ukuran organisasi (lihat juga §12 Milestone & Timeline — Fase Ekstensi).

---

### 6.14 Module Recruitment & Applicant Tracking System (ATS)

#### 6.14.1 Tujuan

Mengelola seluruh proses rekrutmen mulai dari permintaan kebutuhan karyawan (manpower request) hingga kandidat diterima dan dikonversi menjadi employee aktif di Master Employee.

#### 6.14.2 Fitur

**Manpower Request**
- Pengajuan kebutuhan tenaga kerja lengkap dengan justifikasi posisi, jumlah headcount, dan target tanggal onboard
- Approval kebutuhan SDM berjenjang (Dept Head → HR Manager → Finance)
- Validasi budget recruitment terhadap Workforce Planning (§6.28) sebelum disetujui
- Tracking status: Draft, Pending Approval, Approved, Rejected, Closed

**Vacancy Management**
- Pembuatan lowongan (job title, job description, requirement, salary range internal — tidak dipublikasikan ke kandidat)
- Publish ke career portal milik perusahaan (microsite)
- Publish ke job board eksternal (Jobstreet, LinkedIn, Glints) melalui Integration Hub (§6.25), opsional
- Vacancy expiry management — lowongan otomatis disembunyikan dari portal publik setelah expiry date namun dapat dibuka kembali manual

**Candidate Management**
- Database kandidat terpusat dengan deteksi duplikasi (cek email/no. HP)
- Upload CV (PDF/DOCX)
- Parsing CV otomatis — ekstraksi nama, kontak, riwayat pendidikan & pengalaman kerja (opsional, via layanan NLP/OCR pihak ketiga)
- Talent Pool — kandidat potensial untuk lowongan mendatang, termasuk kandidat yang sebelumnya ditolak

**Recruitment Pipeline**

```
Applied → Screening → HR Interview → User Interview → Psychotest → Offering → Hired
```

- Setiap perpindahan stage tercatat dengan timestamp dan PIC
- Kandidat dapat ditolak (Rejected) di stage manapun dengan alasan wajib

**Interview Management**
- Penjadwalan interview yang disinkronkan dengan Work Calendar (§6.5) agar tidak terjadwal di hari libur
- Interview panel — multi-interviewer per sesi
- Feedback form per interviewer (skala rating + komentar kualitatif)
- Scoring agregat dari seluruh interviewer sebagai decision support

**Offering**
- Generate Offer Letter otomatis dari template, terhubung ke DMS (§6.24) untuk e-sign
- Salary proposal mengacu pada Salary Structure (§6.18)
- Approval offer berjenjang berdasarkan nominal
- Acceptance tracking: Sent, Viewed, Accepted, Negotiating, Declined, Expired

#### 6.14.3 Business Rules

- Satu kandidat dapat melamar beberapa posisi sekaligus; sistem mendeteksi duplikasi data kandidat melalui email/no. HP agar tidak terjadi record ganda.
- Kandidat yang ditolak otomatis masuk Talent Pool dengan tag alasan penolakan untuk pencarian kembali di masa depan.
- Kandidat dengan status "Hired" dapat dikonversi menjadi Employee dalam satu klik — data kandidat (nama, kontak, dokumen) otomatis mengisi Master Employee (§6.2) untuk menghindari duplikasi input.
- Manpower request wajib disetujui sebelum vacancy terkait dapat dipublikasikan.
- Setiap perubahan stage pada pipeline tercatat di Audit Log (§6.13) beserta user yang melakukan perubahan.
- Offer yang melebihi salary range pada §6.18 membutuhkan approval tambahan dari Compensation Committee/Director.
- Vacancy yang sudah ditutup (Closed) tidak dapat menerima aplikasi baru, namun riwayat aplikasi tetap tersimpan.

#### 6.14.4 Database Schema

```sql
job_requisitions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL, department_id INT NOT NULL, position_id INT NOT NULL,
  requested_by INT NOT NULL, headcount INT NOT NULL, justification TEXT,
  budget_estimate DECIMAL(15,2), priority ENUM('Low','Medium','High','Urgent'),
  status ENUM('Draft','Pending Approval','Approved','Rejected','Closed') DEFAULT 'Draft',
  target_onboard_date DATE, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME NULL
)

job_vacancies (
  id INT PRIMARY KEY AUTO_INCREMENT, requisition_id INT NOT NULL,
  title VARCHAR(150), description TEXT, requirement TEXT,
  employment_type ENUM('Full Time','Contract','Internship'),
  branch_id INT, salary_range_min DECIMAL(15,2), salary_range_max DECIMAL(15,2),
  publish_career_portal BOOLEAN DEFAULT TRUE, publish_external JSON, -- ["jobstreet","linkedin","glints"]
  status ENUM('Draft','Published','Expired','Closed') DEFAULT 'Draft',
  expiry_date DATE, created_by INT, created_at DATETIME, updated_at DATETIME
)

candidates (
  id INT PRIMARY KEY AUTO_INCREMENT, full_name VARCHAR(150), email VARCHAR(150) UNIQUE,
  phone VARCHAR(20), cv_file_path VARCHAR(255), parsed_data JSON,
  source VARCHAR(50), -- referral / jobstreet / career_portal / linkedin
  is_talent_pool BOOLEAN DEFAULT FALSE, tags JSON,
  created_at DATETIME, updated_at DATETIME
)

candidate_applications (
  id INT PRIMARY KEY AUTO_INCREMENT, candidate_id INT NOT NULL, vacancy_id INT NOT NULL,
  current_stage ENUM('Applied','Screening','HR Interview','User Interview','Psychotest',
                      'Offering','Hired','Rejected') DEFAULT 'Applied',
  applied_at DATETIME, rejected_reason VARCHAR(255), rejected_at DATETIME, updated_at DATETIME,
  UNIQUE KEY uq_candidate_vacancy (candidate_id, vacancy_id)
)

interviews (
  id INT PRIMARY KEY AUTO_INCREMENT, application_id INT NOT NULL, round_name VARCHAR(100),
  scheduled_at DATETIME, location VARCHAR(150), is_online BOOLEAN, meeting_link VARCHAR(255),
  status ENUM('Scheduled','Completed','Cancelled','No Show') DEFAULT 'Scheduled',
  created_by INT, created_at DATETIME
)

interview_panels (id INT PRIMARY KEY AUTO_INCREMENT, interview_id INT NOT NULL, interviewer_id INT NOT NULL)

interview_feedbacks (
  id INT PRIMARY KEY AUTO_INCREMENT, interview_id INT NOT NULL, interviewer_id INT NOT NULL,
  score DECIMAL(3,1), recommendation ENUM('Strong Hire','Hire','No Hire','Strong No Hire'),
  comments TEXT, submitted_at DATETIME
)

job_offers (
  id INT PRIMARY KEY AUTO_INCREMENT, application_id INT NOT NULL,
  offered_salary DECIMAL(15,2), offered_position_id INT, offer_letter_doc_id INT,
  status ENUM('Draft','Pending Approval','Sent','Accepted','Negotiating','Declined','Expired') DEFAULT 'Draft',
  approved_by INT, sent_at DATETIME, responded_at DATETIME, created_at DATETIME
)
```

#### 6.14.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/requisitions` | List & buat manpower request |
| PUT | `/api/requisitions/:id/approve` | Approve/reject requisition |
| GET/POST | `/api/vacancies` | List & buat lowongan |
| PUT | `/api/vacancies/:id/publish` | Publish ke career portal / job board |
| GET/POST | `/api/candidates` | List & tambah kandidat |
| POST | `/api/candidates/:id/parse-cv` | Trigger parsing CV otomatis |
| POST | `/api/applications` | Kandidat melamar vacancy |
| PUT | `/api/applications/:id/stage` | Update stage pipeline |
| POST | `/api/applications/:id/convert-to-employee` | Konversi kandidat hired → employee |
| POST | `/api/interviews` | Jadwalkan interview |
| POST | `/api/interviews/:id/feedback` | Submit feedback interviewer |
| POST/PUT | `/api/offers` | Buat & update offer letter |
| PUT | `/api/offers/:id/response` | Catat respon kandidat (accept/decline) |

---

### 6.15 Module Onboarding & Offboarding

#### 6.15.1 Tujuan

Memastikan proses masuk (onboarding) dan keluar (offboarding) karyawan berjalan terstruktur, terjadwal, dan dapat diaudit — menghindari aset/akses yang tidak tertelusur saat karyawan keluar.

#### 6.15.2 Fitur — Onboarding

**Pre-Boarding**
- Pengisian data mandiri oleh kandidat/calon karyawan sebelum hari pertama kerja
- Upload dokumen wajib (KTP, NPWP, ijazah, rekening bank)
- Tanda tangan kontrak kerja secara digital (terhubung ke DMS §6.24)

**Onboarding Checklist**
- Checklist multi-departemen dengan PIC dan due date per item: Email perusahaan & akses sistem (IT), Laptop/perangkat kerja (IT/GA), ID Card (GA), Pendaftaran BPJS (HR), Payroll setup (Finance)
- Reminder otomatis ke PIC apabila item checklist melewati due date

**Orientation**
- Company introduction (sejarah, visi-misi, struktur organisasi)
- SOP acknowledgement (terhubung ke Policy & Compliance §6.26)
- Training assignment otomatis (terhubung ke LMS §6.17) berdasarkan jabatan

#### 6.15.3 Fitur — Offboarding

**Resignation Process**
- Pengajuan resign oleh karyawan (self-service) dengan tanggal efektif dan alasan
- Approval resign berjenjang (Manager → HR)
- Exit clearance lintas departemen

**Exit Checklist**
- Pengembalian aset (terhubung ke Asset Management §6.16)
- Penutupan akses sistem & email (IT)
- Final payroll/settlement (Finance)
- Penerbitan surat pengalaman kerja

**Exit Interview**
- Kuesioner alasan resign (kategori: kompensasi, karir, lingkungan kerja, dll.)
- Survey kepuasan kerja
- Analisis turnover agregat per departemen/periode

#### 6.15.4 Business Rules

- Employee tidak dapat dinonaktifkan (status berubah menjadi Resign/PHK) sebelum exit clearance dari seluruh departemen berstatus "Cleared".
- Semua aset yang dipinjamkan harus dikembalikan dan diverifikasi sebelum final settlement diproses.
- Pre-boarding form wajib diisi kandidat minimal H-3 sebelum hari pertama kerja; kredensial akun otomatis terkirim setelah kontrak ditandatangani.
- Resign harus mematuhi notice period sesuai kontrak/peraturan perusahaan (default 30 hari, konfigurabel per status karyawan).
- Surat pengalaman kerja hanya dapat diterbitkan setelah seluruh proses exit clearance selesai.
- Item checklist onboarding yang overdue tereskalasi otomatis ke atasan PIC.

#### 6.15.5 Database Schema

```sql
onboarding_checklists (
  id INT PRIMARY KEY AUTO_INCREMENT, employee_id INT NOT NULL, item_name VARCHAR(150),
  category ENUM('Pre-boarding','Equipment','Access','Document','Orientation'),
  pic_id INT, due_date DATE, status ENUM('Pending','In Progress','Done','Overdue') DEFAULT 'Pending',
  completed_at DATETIME, created_at DATETIME
)
preboarding_documents (
  id INT PRIMARY KEY AUTO_INCREMENT, employee_id INT NOT NULL, document_type VARCHAR(100),
  file_path VARCHAR(255), signed BOOLEAN DEFAULT FALSE, signed_at DATETIME, created_at DATETIME
)
resignations (
  id INT PRIMARY KEY AUTO_INCREMENT, employee_id INT NOT NULL, resign_date DATE,
  last_working_date DATE, reason TEXT, notice_period_days INT,
  status ENUM('Submitted','Approved','Rejected','Processing','Completed') DEFAULT 'Submitted',
  approved_by INT, created_at DATETIME
)
exit_clearances (
  id INT PRIMARY KEY AUTO_INCREMENT, resignation_id INT NOT NULL, department VARCHAR(50),
  checklist_item VARCHAR(150), pic_id INT, status ENUM('Pending','Cleared','Rejected') DEFAULT 'Pending',
  notes TEXT, cleared_at DATETIME
)
exit_interviews (
  id INT PRIMARY KEY AUTO_INCREMENT, resignation_id INT NOT NULL, conducted_by INT,
  reason_category VARCHAR(100), satisfaction_score DECIMAL(3,1), notes TEXT, created_at DATETIME
)
```

#### 6.15.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/onboarding/:employeeId/checklist` | List/buat item checklist onboarding |
| PUT | `/api/onboarding/checklist/:id/complete` | Tandai item checklist selesai |
| POST | `/api/resignations` | Ajukan resign |
| PUT | `/api/resignations/:id/approve` | Approve/reject resign |
| GET/PUT | `/api/resignations/:id/clearance` | Lihat/update exit clearance per departemen |
| POST | `/api/resignations/:id/exit-interview` | Submit exit interview |
| GET | `/api/resignations/:id/work-certificate` | Generate surat pengalaman kerja |

---

### 6.16 Module Asset Management

#### 6.16.1 Tujuan

Mengelola siklus hidup aset perusahaan yang dipinjamkan kepada karyawan — dari serah terima hingga pengembalian — agar aset tertelusur dan terhindar dari kehilangan/kerusakan tanpa pertanggungjawaban.

#### 6.16.2 Fitur

**Asset Master**
- Kategori aset: Laptop, Monitor, Smartphone, Kendaraan, Access Card, dan kategori kustom lainnya
- Pencatatan no. seri, tanggal pembelian, nilai perolehan, dan nilai buku (depresiasi)

**Asset Assignment**
- Serah terima aset dengan Berita Acara Serah Terima (BAST) digital
- Riwayat penggunaan aset per karyawan (append-only history)
- Kondisi aset dicatat pada saat assignment (New/Good/Fair/Poor)

**Asset Return**
- Pengembalian aset saat mutasi/resign
- Verifikasi kondisi oleh GA pada saat pengembalian
- Potensi potongan payroll jika aset hilang/rusak di luar wajar (terintegrasi dengan §6.9 Payroll atau §6.19 Employee Loan untuk skema cicilan ganti rugi)

#### 6.16.3 Business Rules

- Setiap aset memiliki status tunggal pada satu waktu: Available, Assigned, Maintenance, Lost, atau Disposed.
- Satu aset hanya dapat di-assign ke satu karyawan aktif dalam satu waktu.
- Pengembalian aset wajib direview kondisinya oleh GA sebelum exit clearance (§6.15) dapat ditandai "Cleared".
- Kerusakan/kehilangan di luar wajar dapat menghasilkan potongan payroll otomatis sesuai nilai buku aset pada saat insiden.
- Riwayat assignment tidak dapat dihapus; perubahan kepemilikan selalu berupa record baru.

#### 6.16.4 Database Schema

```sql
asset_categories (
  id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100),
  depreciation_method ENUM('Straight Line','None') DEFAULT 'Straight Line',
  useful_life_months INT, created_at DATETIME
)
assets (
  id INT PRIMARY KEY AUTO_INCREMENT, category_id INT NOT NULL, asset_code VARCHAR(50) UNIQUE,
  name VARCHAR(150), serial_number VARCHAR(100), purchase_date DATE,
  purchase_value DECIMAL(15,2), current_value DECIMAL(15,2),
  status ENUM('Available','Assigned','Maintenance','Lost','Disposed') DEFAULT 'Available',
  branch_id INT, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME NULL
)
asset_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT, asset_id INT NOT NULL, employee_id INT NOT NULL,
  assigned_at DATETIME, condition_at_assign ENUM('New','Good','Fair','Poor'),
  bast_doc_id INT, returned_at DATETIME NULL, created_by INT
)
asset_returns (
  id INT PRIMARY KEY AUTO_INCREMENT, assignment_id INT NOT NULL, returned_at DATETIME,
  condition_at_return ENUM('Good','Fair','Damaged','Lost'), verified_by INT,
  deduction_amount DECIMAL(15,2) DEFAULT 0, notes TEXT, created_at DATETIME
)
```

#### 6.16.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/assets` | List & tambah master aset |
| PUT | `/api/assets/:id/status` | Update status aset |
| POST | `/api/asset-assignments` | Serah terima aset ke karyawan |
| GET | `/api/asset-assignments/employee/:id` | Riwayat aset per karyawan |
| POST | `/api/asset-assignments/:id/return` | Proses pengembalian aset |

---

### 6.17 Module Learning Management System (LMS)

#### 6.17.1 Tujuan

Mengelola pelatihan dan pengembangan kompetensi karyawan secara terstruktur, serta menjadi sumber data kompetensi untuk Performance Management dan Talent & Succession Planning.

#### 6.17.2 Fitur

**Course Management**
- Training catalog (internal & eksternal) dengan kategori, durasi, dan provider
- Materi pembelajaran: video, PDF, atau paket SCORM (opsional)

**Learning Path**
- Disusun berdasarkan jabatan atau kompetensi yang dibutuhkan
- Rekomendasi otomatis ke karyawan baru saat onboarding (§6.15)

**Certification**
- Pencatatan sertifikasi karyawan beserta masa berlaku
- Expiry reminder otomatis (H-30) ke karyawan & manager
- Renewal tracking dan riwayat sertifikasi

**Assessment**
- Quiz, Exam, dan Assignment dengan passing score konfigurabel
- Batas jumlah attempt per assessment

**Reporting**
- Completion rate per karyawan/departemen
- Learning hours agregat
- Status sertifikasi (Active/Expired/Renewed) lintas organisasi

#### 6.17.3 Integrasi

Terhubung ke: Employee Master (§6.2), Performance Management (§6.10), Talent & Succession Planning (§6.21), Document Management System (§6.24) untuk penyimpanan sertifikat.

#### 6.17.4 Business Rules

- Training wajib (mandatory) untuk jabatan tertentu otomatis di-assign ke karyawan baru pada saat onboarding.
- Sertifikasi dengan tanggal expiry memicu reminder otomatis H-30 sebelum kadaluarsa.
- Kegagalan assessment dapat diulang sesuai batas attempt yang dikonfigurasi; melebihi batas memerlukan persetujuan manager untuk attempt tambahan.
- Completion rate dan skor assessment menjadi salah satu input untuk siklus appraisal dan penentuan kandidat HIPO.

#### 6.17.5 Database Schema

```sql
training_catalogs (id INT PK AUTO_INCREMENT, title VARCHAR(150), category ENUM('Internal','External'),
  description TEXT, duration_hours DECIMAL(5,1), provider VARCHAR(100), created_at DATETIME)
learning_paths (id INT PK AUTO_INCREMENT, name VARCHAR(150), position_id INT, competency_id INT, created_at DATETIME)
learning_path_courses (id INT PK AUTO_INCREMENT, learning_path_id INT, course_id INT, sequence INT)
training_enrollments (id INT PK AUTO_INCREMENT, employee_id INT, course_id INT,
  status ENUM('Assigned','In Progress','Completed','Failed') DEFAULT 'Assigned',
  assigned_at DATETIME, completed_at DATETIME, score DECIMAL(5,2))
certifications (id INT PK AUTO_INCREMENT, employee_id INT, name VARCHAR(150), issued_by VARCHAR(150),
  issued_date DATE, expiry_date DATE NULL, document_id INT, status ENUM('Active','Expired','Renewed') DEFAULT 'Active',
  created_at DATETIME)
assessments (id INT PK AUTO_INCREMENT, course_id INT, type ENUM('Quiz','Exam','Assignment'),
  passing_score DECIMAL(5,2), max_attempts INT DEFAULT 3)
assessment_results (id INT PK AUTO_INCREMENT, assessment_id INT, employee_id INT, attempt_no INT,
  score DECIMAL(5,2), passed BOOLEAN, submitted_at DATETIME)
```

#### 6.17.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/training-catalogs` | List & buat training catalog |
| POST | `/api/training-enrollments` | Assign training ke karyawan |
| PUT | `/api/training-enrollments/:id/complete` | Tandai training selesai |
| GET/POST | `/api/certifications` | List & tambah sertifikasi karyawan |
| GET | `/api/certifications/expiring` | List sertifikasi yang akan expired |
| POST | `/api/assessments/:id/submit` | Submit hasil assessment |
| GET | `/api/lms/report` | Laporan completion rate & learning hours |

---

### 6.18 Module Compensation & Benefit

#### 6.18.1 Tujuan

Mengelola struktur kompensasi dan benefit perusahaan agar konsisten, adil (internal equity), dan kompetitif (external competitiveness).

#### 6.18.2 Fitur

**Salary Structure**
- Grade, Salary Range, dan Salary Band per posisi/level
- Simulasi posisi karyawan dalam range (compa-ratio)

**Salary Review**
- Merit Increase, Annual Review, Promotion Adjustment
- Simulasi dampak budget sebelum review difinalisasi

**Benefit Management**
- Medical Benefit, Insurance, Vehicle Allowance, Communication Allowance
- Eligibility benefit berdasarkan grade dan status karyawan

**THR Management**
- Perhitungan THR sesuai masa kerja
- Pro-rata THR untuk karyawan dengan masa kerja < 12 bulan
- THR Slip terpisah dari payslip reguler

#### 6.18.3 Business Rules

- Salary di luar range grade membutuhkan approval khusus dari Compensation Committee/Director.
- Salary review wajib memiliki justification tertulis dan tersimpan untuk keperluan audit.
- THR dihitung pro-rata untuk karyawan dengan masa kerja kurang dari 12 bulan (1 bulan gaji × masa kerja/12), sesuai regulasi ketenagakerjaan.
- Perubahan salary structure tidak berlaku retroaktif kecuali ada approval khusus, dan setiap perubahan tercatat di Audit Log.
- Eligibility benefit otomatis menyesuaikan saat status karyawan berubah (misal dari Kontrak ke Tetap).

#### 6.18.4 Database Schema

```sql
salary_grades (id INT PK AUTO_INCREMENT, company_id INT, grade_code VARCHAR(20), grade_name VARCHAR(100), created_at DATETIME)
salary_ranges (id INT PK AUTO_INCREMENT, grade_id INT, position_id INT,
  min_salary DECIMAL(15,2), mid_salary DECIMAL(15,2), max_salary DECIMAL(15,2), effective_date DATE)
salary_reviews (id INT PK AUTO_INCREMENT, employee_id INT, review_type ENUM('Merit','Annual','Promotion'),
  old_salary DECIMAL(15,2), new_salary DECIMAL(15,2), justification TEXT,
  approved_by INT, effective_date DATE, created_at DATETIME)
benefit_plans (id INT PK AUTO_INCREMENT, name VARCHAR(150),
  type ENUM('Medical','Insurance','Vehicle Allowance','Communication Allowance'),
  eligible_grades JSON, amount DECIMAL(15,2), created_at DATETIME)
employee_benefits (id INT PK AUTO_INCREMENT, employee_id INT, benefit_plan_id INT,
  start_date DATE, end_date DATE NULL, status ENUM('Active','Inactive') DEFAULT 'Active')
thr_calculations (id INT PK AUTO_INCREMENT, employee_id INT, year INT, masa_kerja_months INT,
  base_salary DECIMAL(15,2), thr_amount DECIMAL(15,2), pro_rata BOOLEAN,
  paid_at DATETIME, slip_doc_id INT, created_at DATETIME)
```

#### 6.18.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/salary-grades` | Kelola grade & salary range |
| POST | `/api/salary-reviews` | Ajukan salary review |
| PUT | `/api/salary-reviews/:id/approve` | Approve salary review |
| GET/POST | `/api/benefit-plans` | Kelola benefit plan |
| GET | `/api/employee-benefits/:employeeId` | List benefit aktif karyawan |
| POST | `/api/thr/calculate` | Hitung THR seluruh karyawan untuk periode tertentu |
| GET | `/api/thr/:employeeId/slip` | Generate slip THR |

---

### 6.19 Module Employee Loan Management

#### 6.19.1 Tujuan

Mengelola pengajuan, pencairan, dan pelunasan pinjaman/kasbon karyawan secara terkontrol agar tidak membebani take-home pay secara berlebihan.

#### 6.19.2 Fitur

**Loan Request**
- Jenis pinjaman: Kasbon, Pinjaman Umum, Pinjaman Darurat — masing-masing dengan limit berbeda
- Approval workflow berjenjang sesuai nominal

**Loan Schedule**
- Simulasi cicilan & tenor sebelum pengajuan disetujui
- Monitoring outstanding balance per karyawan

**Payroll Integration**
- Auto deduction dari payroll setiap periode
- Prioritas urutan deduction bila karyawan memiliki lebih dari satu pinjaman aktif

#### 6.19.3 Business Rules

- Total cicilan aktif tidak boleh melebihi persentase tertentu dari take-home pay (default 30%, konfigurabel) untuk mencegah over-indebtedness.
- Pinjaman baru tidak dapat diajukan apabila pinjaman sebelumnya masih outstanding dan melebihi limit yang ditetapkan, kecuali dengan approval khusus.
- Cicilan otomatis dipotong dari payroll hingga lunas; jika karyawan resign, sisa outstanding ditagihkan pada final settlement.
- Perubahan tenor atau jumlah cicilan setelah disetujui memerlukan approval ulang.

#### 6.19.4 Database Schema

```sql
employee_loans (id INT PK AUTO_INCREMENT, employee_id INT, loan_type ENUM('Kasbon','Pinjaman Umum','Pinjaman Darurat'),
  amount DECIMAL(15,2), tenor_months INT, interest_rate DECIMAL(5,2),
  status ENUM('Pending','Approved','Rejected','Active','Settled') DEFAULT 'Pending',
  approved_by INT, requested_at DATETIME, approved_at DATETIME)
loan_installments (id INT PK AUTO_INCREMENT, loan_id INT, installment_no INT, due_period DATE,
  amount DECIMAL(15,2), status ENUM('Pending','Paid','Skipped') DEFAULT 'Pending', paid_at DATETIME)
loan_payments (id INT PK AUTO_INCREMENT, installment_id INT, payroll_detail_id INT,
  amount_paid DECIMAL(15,2), paid_at DATETIME, method ENUM('Payroll Deduction','Manual'))
```

#### 6.19.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/loans` | Ajukan pinjaman |
| PUT | `/api/loans/:id/approve` | Approve/reject pinjaman |
| GET | `/api/loans/:employeeId/schedule` | Simulasi/lihat jadwal cicilan |
| GET | `/api/loans/:employeeId/outstanding` | Outstanding balance karyawan |

---

### 6.20 Module Travel & Expense Claim

#### 6.20.1 Tujuan

Mengelola perjalanan dinas dan klaim reimbursement karyawan secara terstruktur dan transparan.

#### 6.20.2 Fitur

**Business Trip**
- Travel Request dengan tujuan, durasi, dan estimasi biaya
- Approval berjenjang
- Travel Advance (uang muka perjalanan)

**Expense Claim**
- Upload receipt/bukti pengeluaran
- OCR receipt (opsional) untuk ekstraksi nominal otomatis
- Multi-level approval sesuai nominal klaim

**Reimbursement**
- Transfer langsung ke rekening karyawan, atau
- Digabungkan ke payroll run periode berikutnya

#### 6.20.3 Jenis Expense

Transportasi, Hotel, Makan, Entertainment, Operasional.

#### 6.20.4 Business Rules

- Expense claim wajib disertai bukti (receipt), kecuali untuk jenis expense dengan limit lump-sum (misal uang makan harian flat).
- Travel advance yang belum direkonsiliasi dengan expense claim aktual akan memblokir pengajuan travel request baru berikutnya.
- Approval expense claim berjenjang berdasarkan nominal (mengacu Workflow Engine §6.23): di bawah limit tertentu cukup Manager, di atasnya melibatkan Finance, dan di atas limit lebih tinggi melibatkan Director.
- Reimbursement yang sudah diproses dalam payroll tidak dapat dibatalkan; koreksi hanya dapat dilakukan pada periode berikutnya.

#### 6.20.5 Database Schema

```sql
business_trips (id INT PK AUTO_INCREMENT, employee_id INT, destination VARCHAR(150), purpose TEXT,
  start_date DATE, end_date DATE, estimated_cost DECIMAL(15,2),
  status ENUM('Requested','Approved','Rejected','Completed') DEFAULT 'Requested',
  approved_by INT, created_at DATETIME)
travel_advances (id INT PK AUTO_INCREMENT, trip_id INT, amount DECIMAL(15,2),
  disbursed_at DATETIME, reconciled BOOLEAN DEFAULT FALSE, created_at DATETIME)
expense_claims (id INT PK AUTO_INCREMENT, employee_id INT, trip_id INT NULL,
  category ENUM('Transportasi','Hotel','Makan','Entertainment','Operasional'),
  amount DECIMAL(15,2), receipt_file_path VARCHAR(255), ocr_extracted_amount DECIMAL(15,2),
  status ENUM('Submitted','Approved','Rejected','Reimbursed') DEFAULT 'Submitted', created_at DATETIME)
expense_approvals (id INT PK AUTO_INCREMENT, claim_id INT, approver_id INT, level INT,
  status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending', approved_at DATETIME)
reimbursements (id INT PK AUTO_INCREMENT, claim_id INT, method ENUM('Transfer','Payroll'),
  amount DECIMAL(15,2), processed_at DATETIME, payroll_detail_id INT NULL)
```

#### 6.20.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/business-trips` | Ajukan perjalanan dinas |
| POST | `/api/business-trips/:id/advance` | Ajukan uang muka |
| POST | `/api/expense-claims` | Submit klaim reimbursement |
| PUT | `/api/expense-claims/:id/approve` | Approve/reject klaim |
| POST | `/api/expense-claims/:id/reimburse` | Proses reimbursement |

---

### 6.21 Module Talent & Succession Planning

#### 6.21.1 Tujuan

Menyiapkan kaderisasi (succession) untuk posisi-posisi kritikal agar organisasi tidak bergantung pada individu tertentu (key person risk).

#### 6.21.2 Fitur

**Talent Pool**
- High Potential Employee (HIPO) — ditandai berdasarkan hasil appraisal & assessment
- Critical Talent — posisi/individu yang krusial bagi kelangsungan bisnis

**9 Box Matrix**

```
Performance
   ↑
 High │ Enigma     │ Growth Player │  Star
      │ (3)        │ (6)           │ (9)
 Med  │ Inconsistent│ Core Player  │ High Impact
      │ Player (2)  │ (5)          │ Performer (8)
 Low  │ Underperformer│ Effective  │ Trusted
      │ (1)          │ Performer(4)│ Professional(7)
      └──────────────┴─────────────┴──────────────→ Potential
        Low            Medium         High
```

**Succession Planning**
- Successor Candidate per posisi kritikal
- Readiness Level: Ready Now / 1–2 Tahun / 3–5 Tahun
- Development Plan (IDP) per successor, terhubung ke LMS (§6.17)

#### 6.21.3 Output

Succession Chart, Talent Heatmap, Leadership Pipeline.

#### 6.21.4 Business Rules

- Penentuan HIPO mempertimbangkan minimal 2 siklus appraisal terakhir (§6.10) dan hasil assessment LMS (§6.17).
- Setiap posisi kritikal wajib memiliki minimal satu successor candidate dengan readiness level terdefinisi.
- Placement pada 9 Box direview minimal setahun sekali dalam talent review committee.
- Development plan successor wajib memiliki target tanggal dan tracking progress yang terhubung ke training relevan di LMS.

#### 6.21.5 Database Schema

```sql
critical_positions (id INT PK AUTO_INCREMENT, position_id INT, criticality_reason TEXT, created_at DATETIME)
talent_pools (id INT PK AUTO_INCREMENT, employee_id INT, category ENUM('HIPO','Critical Talent'),
  identified_date DATE, notes TEXT, created_by INT)
nine_box_assessments (id INT PK AUTO_INCREMENT, employee_id INT, cycle_id INT,
  performance_score DECIMAL(5,2), potential_score DECIMAL(5,2), box_category VARCHAR(50),
  assessed_by INT, assessed_at DATETIME)
succession_plans (id INT PK AUTO_INCREMENT, critical_position_id INT, successor_employee_id INT,
  readiness_level ENUM('Ready Now','1-2 Years','3-5 Years'), development_plan TEXT,
  target_date DATE, status ENUM('Active','Promoted','Withdrawn') DEFAULT 'Active', created_at DATETIME)
```

#### 6.21.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/critical-positions` | Kelola daftar posisi kritikal |
| POST | `/api/talent-pools` | Tandai karyawan sebagai HIPO/Critical Talent |
| POST | `/api/nine-box-assessments` | Submit hasil penilaian 9 box |
| GET | `/api/nine-box-assessments/heatmap` | Data talent heatmap |
| POST/GET | `/api/succession-plans` | Kelola successor per posisi kritikal |

---

### 6.22 Module Employee Engagement

#### 6.22.1 Tujuan

Mengukur dan meningkatkan tingkat keterlibatan (engagement) dan kepuasan karyawan secara berkala, serta mendeteksi dini risiko turnover.

#### 6.22.2 Fitur

**Survey**
- Employee Satisfaction Survey (tahunan)
- Pulse Survey (berkala/bulanan, pertanyaan singkat)
- Engagement Survey (kustom dengan template pertanyaan)

**Recognition**
- Employee Recognition — peer-to-peer atau dari manager ke bawahan
- Appreciation Program berbasis poin/badge

**Feedback**
- Anonymous Feedback
- Suggestion Box dengan kategori dan status follow-up

#### 6.22.3 Dashboard

eNPS Score, Engagement Index, Turnover Risk (indikator dini berbasis kombinasi hasil survey, absensi, dan riwayat appraisal).

#### 6.22.4 Business Rules

- Survey anonim tidak menyimpan identitas responden pada level jawaban individual; hasil hanya ditampilkan agregat per segmen dengan jumlah responden minimum (misal ≥5 orang) untuk menjaga anonimitas.
- eNPS dihitung otomatis dari pertanyaan standar skala 0–10 (Promoter/Passive/Detractor).
- Suggestion box wajib mendapat status follow-up dalam SLA tertentu (misal 14 hari), dengan notifikasi otomatis ke PIC terkait jika SLA terlampaui.
- Poin recognition/appreciation dapat memiliki kebijakan redeem (opsional), terhubung ke program benefit/reward.

#### 6.22.5 Database Schema

```sql
surveys (id INT PK AUTO_INCREMENT, title VARCHAR(150), type ENUM('Satisfaction','Pulse','Engagement'),
  start_date DATE, end_date DATE, is_anonymous BOOLEAN DEFAULT TRUE,
  status ENUM('Draft','Active','Closed') DEFAULT 'Draft', created_at DATETIME)
survey_questions (id INT PK AUTO_INCREMENT, survey_id INT, question_text TEXT,
  question_type ENUM('Scale','MultipleChoice','Text'), sequence INT)
survey_responses (id INT PK AUTO_INCREMENT, survey_id INT, question_id INT,
  employee_id INT NULL, answer_value TEXT, submitted_at DATETIME)
recognitions (id INT PK AUTO_INCREMENT, given_by INT, given_to INT, type ENUM('Peer','Manager'),
  message TEXT, points INT DEFAULT 0, created_at DATETIME)
suggestions (id INT PK AUTO_INCREMENT, employee_id INT NULL, category VARCHAR(100), content TEXT,
  status ENUM('New','In Review','Resolved','Rejected') DEFAULT 'New',
  pic_id INT, resolved_at DATETIME, created_at DATETIME)
```

#### 6.22.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/surveys` | Kelola survey |
| POST | `/api/surveys/:id/responses` | Submit jawaban survey |
| GET | `/api/surveys/:id/results` | Hasil agregat survey (eNPS, dsb.) |
| POST | `/api/recognitions` | Berikan recognition ke karyawan lain |
| GET/POST | `/api/suggestions` | List & buat suggestion box |
| PUT | `/api/suggestions/:id/resolve` | Update status follow-up |

---

### 6.23 Module Workflow Engine

#### 6.23.1 Tujuan

Menyediakan approval engine yang fleksibel dan dapat dikonfigurasi untuk seluruh modul HRMS, menghilangkan hardcode approval pada masing-masing modul.

#### 6.23.2 Fitur

**Dynamic Approval**

```
Leave Request
Employee → Supervisor → Manager → HR
```

**Rule Based Approval**

```
Jika nominal > 10 juta → tambah approval Director
```

**Escalation**
- Reminder otomatis bila approver belum merespon dalam SLA
- Auto reassign approver jika approver sedang cuti/tidak aktif (mengacu Leave Management §6.7)
- SLA monitoring dashboard untuk HR/Admin

#### 6.23.3 Benefit

Menghilangkan hardcode approval pada setiap modul — perubahan alur approval (misal menambah level Director) tidak memerlukan rilis ulang sistem, cukup konfigurasi.

#### 6.23.4 Business Rules

- Setiap modul yang membutuhkan approval (Leave, Self Service, Expense Claim, Loan, Job Offer, Resignation, dll.) wajib didaftarkan sebagai "Approval Type" di Workflow Engine.
- Approval chain dapat berbeda sesuai kondisi (nominal, departemen, jenis request) berdasarkan rule yang dikonfigurasi.
- Jika approver tidak merespon dalam SLA (default 3 hari kerja, konfigurabel), sistem mengirim reminder; bila SLA tambahan terlampaui, request otomatis di-escalate ke approver level berikutnya/backup approver.
- Approver yang terdeteksi cuti otomatis di-reassign ke backup approver yang telah dikonfigurasi sebelumnya.
- Perubahan konfigurasi approval flow tercatat di Audit Log dan tidak berlaku retroaktif terhadap request yang sedang berjalan.

#### 6.23.5 Database Schema

```sql
approval_types (id INT PK AUTO_INCREMENT, module_code VARCHAR(50), name VARCHAR(100), description TEXT, created_at DATETIME)
approval_flows (id INT PK AUTO_INCREMENT, approval_type_id INT, name VARCHAR(100),
  condition_rule JSON, -- {"field":"amount","operator":">","value":10000000}
  is_active BOOLEAN DEFAULT TRUE, created_at DATETIME)
approval_flow_steps (id INT PK AUTO_INCREMENT, flow_id INT, sequence INT, approver_role VARCHAR(50),
  approver_id INT NULL, sla_hours INT DEFAULT 24, backup_approver_id INT NULL)
approval_instances (id INT PK AUTO_INCREMENT, approval_type_id INT, reference_id INT, flow_id INT,
  current_step INT, status ENUM('In Progress','Approved','Rejected','Escalated') DEFAULT 'In Progress',
  created_at DATETIME)
approval_instance_logs (id INT PK AUTO_INCREMENT, instance_id INT, step INT, approver_id INT,
  action ENUM('Approved','Rejected','Escalated','Reassigned'), comment TEXT, acted_at DATETIME)
```

#### 6.23.6 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/approval-types` | Kelola jenis approval per modul |
| GET/POST | `/api/approval-flows` | Kelola alur & rule approval |
| GET | `/api/approval-instances/:id` | Status approval untuk satu request |
| PUT | `/api/approval-instances/:id/act` | Approve/reject/escalate |
| GET | `/api/approval-instances/sla-monitor` | Dashboard SLA approval |

---

### 6.24 Module Document Management System (DMS)

#### 6.24.1 Tujuan

Menjadi repository dokumen terpusat untuk seluruh aktivitas HR — dari dokumen pribadi karyawan hingga dokumen legal perusahaan — dengan kontrol akses dan jejak audit yang jelas.

#### 6.24.2 Fitur

**Employee Documents**
- KTP, NPWP, BPJS, Kontrak Kerja — dengan versioning

**Company Documents**
- SOP, Policy, PKB (Perjanjian Kerja Bersama), Dokumen Organisasi
- Kategori dan akses terbatas (Public/Internal/Restricted)

**Digital Signature**
- E-Sign internal atau integrasi provider e-sign tersertifikasi
- Approval document terintegrasi dengan Workflow Engine (§6.23)

**Expiry Monitoring**
- Kontrak kerja, sertifikasi karyawan (dari LMS §6.17), lisensi perusahaan
- Reminder otomatis sebelum kadaluarsa

#### 6.24.3 Business Rules

- Setiap dokumen memiliki access control berbasis role dan kepemilikan — karyawan hanya dapat mengakses dokumen miliknya sendiri, kecuali HR/Admin.
- Dokumen yang sudah di-e-sign tidak dapat diedit; perubahan harus berupa versi/dokumen baru.
- Dokumen dengan tanggal expiry memicu notifikasi otomatis H-30 dan H-7 ke pemilik dokumen dan HR.
- Riwayat akses dokumen sensitif (KTP, NPWP, kontrak) tercatat di Audit Log (§6.13).

#### 6.24.4 Database Schema

```sql
document_categories (id INT PK AUTO_INCREMENT, name VARCHAR(100),
  access_level ENUM('Public','Internal','Restricted') DEFAULT 'Internal', created_at DATETIME)
documents (id INT PK AUTO_INCREMENT, category_id INT, owner_type ENUM('Employee','Company'),
  owner_id INT NULL, title VARCHAR(150), file_path VARCHAR(255), version INT DEFAULT 1,
  expiry_date DATE NULL, status ENUM('Active','Expired','Superseded') DEFAULT 'Active',
  uploaded_by INT, created_at DATETIME)
document_signatures (id INT PK AUTO_INCREMENT, document_id INT, signer_id INT,
  signature_method ENUM('Internal E-Sign','Third Party'), signed_at DATETIME, signature_file_path VARCHAR(255))
document_access_logs (id INT PK AUTO_INCREMENT, document_id INT, accessed_by INT,
  action ENUM('View','Download','Edit'), accessed_at DATETIME)
```

#### 6.24.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/documents` | List & upload dokumen |
| GET | `/api/documents/:id` | Detail & download dokumen |
| POST | `/api/documents/:id/sign` | E-sign dokumen |
| GET | `/api/documents/expiring` | Dokumen yang akan/sudah expired |

---

### 6.25 Module Integration Hub

#### 6.25.1 Tujuan

Menjadi pusat integrasi seluruh sistem internal dan eksternal agar setiap koneksi dikelola, dimonitor, dan diamankan secara terpusat — bukan tersebar sebagai koneksi point-to-point di tiap modul.

#### 6.25.2 Fitur & Cakupan Integrasi

**Integrasi Internal:** HRMS, LMS, Payroll, Attendance — sinkronisasi data secara real-time antar modul.

**Integrasi Eksternal:**

| Kategori | Provider |
|----------|----------|
| Accounting | Accurate, SAP, Oracle |
| Recruitment | Jobstreet, LinkedIn, Glints |
| Attendance Device | ZKTeco, Fingerspot |
| Communication | Email, WhatsApp API, Microsoft Teams, Slack |
| Identity | Google SSO, Microsoft Azure AD, LDAP |

#### 6.25.3 Business Rules

- Setiap integrasi eksternal menggunakan API key/credential yang disimpan terenkripsi dan dapat di-revoke kapan saja oleh Super Admin.
- Kegagalan sinkronisasi (timeout, error response) tercatat pada log integrasi dengan mekanisme retry (exponential backoff, maksimal N kali percobaan).
- Mapping data antar sistem (misal kode akun Accounting vs salary component HRMS) dikonfigurasi melalui mapping table, bukan hardcode di kode aplikasi.
- Perubahan konfigurasi integrasi memerlukan approval Super Admin dan tercatat di Audit Log.

#### 6.25.4 Database Schema

```sql
integration_configs (id INT PK AUTO_INCREMENT,
  integration_type ENUM('Accounting','Recruitment','Attendance Device','Communication','Identity'),
  provider VARCHAR(50), credentials_encrypted TEXT, is_active BOOLEAN DEFAULT TRUE, created_at DATETIME)
integration_field_mappings (id INT PK AUTO_INCREMENT, integration_config_id INT,
  source_field VARCHAR(100), target_field VARCHAR(100))
integration_logs (id INT PK AUTO_INCREMENT, integration_config_id INT,
  direction ENUM('Inbound','Outbound'), payload_summary TEXT,
  status ENUM('Success','Failed','Retrying') DEFAULT 'Success', retry_count INT DEFAULT 0, executed_at DATETIME)
sso_sessions (id INT PK AUTO_INCREMENT, employee_id INT, provider ENUM('Google','Azure AD','LDAP'),
  provider_user_id VARCHAR(150), last_login DATETIME)
```

#### 6.25.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/integrations` | Kelola konfigurasi integrasi |
| PUT | `/api/integrations/:id/toggle` | Aktif/nonaktifkan integrasi |
| GET | `/api/integrations/:id/logs` | Riwayat sinkronisasi & error |
| POST | `/api/integrations/:id/retry` | Retry manual sinkronisasi yang gagal |
| POST | `/api/auth/sso/:provider` | Login via SSO provider |

---

### 6.26 Module Policy & Compliance Management

> *Modul rekomendasi tambahan — umumnya menjadi pembeda HRMS enterprise yang dijual ke perusahaan dengan struktur kepatuhan formal.*

#### 6.26.1 Tujuan

Memastikan seluruh kebijakan perusahaan tersosialisasikan, dipahami, dan dipatuhi karyawan, serta menyediakan mekanisme audit kepatuhan yang terjadwal dan terdokumentasi.

#### 6.26.2 Fitur

**Company Policy** — publish kebijakan/SOP terbaru (terhubung ke DMS §6.24), kategorisasi per departemen/topik.
**Acknowledgement Tracking** — karyawan wajib membaca & meng-acknowledge policy; status tracking siapa yang sudah/belum.
**Compliance Audit** — checklist audit periodik, pencatatan temuan (finding) dan corrective action.

#### 6.26.3 Business Rules

- Policy baru/revisi wajib di-acknowledge oleh seluruh karyawan target dalam jangka waktu tertentu (misal 14 hari); reminder otomatis dikirim ke yang belum acknowledge.
- Setiap temuan audit (finding) wajib memiliki corrective action plan dengan due date dan PIC, dan ditracking hingga statusnya "Closed".
- Riwayat acknowledgement tersimpan permanen sebagai bukti kepatuhan (legal evidence) dan tidak dapat dihapus.

#### 6.26.4 Database Schema

```sql
policies (id INT PK AUTO_INCREMENT, title VARCHAR(150), category VARCHAR(100), document_id INT,
  target_roles JSON, effective_date DATE, status ENUM('Draft','Active','Superseded') DEFAULT 'Draft', created_at DATETIME)
policy_acknowledgements (id INT PK AUTO_INCREMENT, policy_id INT, employee_id INT, acknowledged_at DATETIME)
compliance_audits (id INT PK AUTO_INCREMENT, title VARCHAR(150), scope TEXT, scheduled_date DATE,
  status ENUM('Planned','In Progress','Completed') DEFAULT 'Planned', created_by INT)
audit_findings (id INT PK AUTO_INCREMENT, audit_id INT, finding TEXT, severity ENUM('Low','Medium','High'),
  corrective_action TEXT, pic_id INT, due_date DATE, status ENUM('Open','In Progress','Closed') DEFAULT 'Open')
```

#### 6.26.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/policies` | Kelola publikasi policy |
| POST | `/api/policies/:id/acknowledge` | Karyawan acknowledge policy |
| GET | `/api/policies/:id/acknowledgement-status` | Status acknowledgement seluruh target |
| GET/POST | `/api/compliance-audits` | Kelola jadwal & checklist audit |
| POST | `/api/audit-findings` | Catat temuan & corrective action |

---

### 6.27 Module Disciplinary Action Management

> *Modul rekomendasi tambahan.*

#### 6.27.1 Tujuan

Mengelola proses pembinaan dan tindakan disiplin karyawan secara konsisten, terdokumentasi, dan sesuai prosedur hukum ketenagakerjaan yang berlaku.

#### 6.27.2 Fitur

**SP1 / SP2 / SP3** — surat peringatan berjenjang dengan template, beserta masa berlaku per level.
**Pelanggaran Karyawan** — pencatatan jenis pelanggaran, kronologi, dan bukti pendukung.
**Investigasi Internal** — case management, status investigasi, hasil dan rekomendasi tindakan.

#### 6.27.3 Business Rules

- SP memiliki masa berlaku (misal 6 bulan). Jika dalam masa berlaku terjadi pelanggaran sejenis, level SP naik (SP1→SP2→SP3); bila tidak ada pelanggaran lagi hingga masa berlaku habis, pelanggaran berikutnya tidak otomatis naik level.
- Penerbitan SP wajib melalui approval HR Manager, dan untuk SP3/kasus berat dapat melibatkan Legal/Direksi.
- Investigasi internal bersifat confidential — akses dokumen dan kasus dibatasi hanya untuk tim yang ditugaskan (mengacu access control DMS §6.24).
- Setiap SP yang terbit tercatat pada profil karyawan dan menjadi salah satu pertimbangan dalam appraisal/promosi.

#### 6.27.4 Database Schema

```sql
violations (id INT PK AUTO_INCREMENT, employee_id INT, violation_type VARCHAR(100), description TEXT,
  occurred_at DATETIME, reported_by INT, status ENUM('Reported','Investigating','Resolved') DEFAULT 'Reported',
  created_at DATETIME)
investigations (id INT PK AUTO_INCREMENT, violation_id INT, investigator_id INT, findings TEXT,
  recommendation TEXT, status ENUM('Open','Closed') DEFAULT 'Open', closed_at DATETIME)
disciplinary_actions (id INT PK AUTO_INCREMENT, employee_id INT, violation_id INT,
  sp_level ENUM('SP1','SP2','SP3'), issued_date DATE, valid_until DATE,
  document_id INT, approved_by INT, created_at DATETIME)
```

#### 6.27.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/violations` | Catat pelanggaran karyawan |
| POST | `/api/investigations` | Buka investigasi internal |
| PUT | `/api/investigations/:id/close` | Tutup investigasi dengan rekomendasi |
| POST | `/api/disciplinary-actions` | Terbitkan SP1/SP2/SP3 |
| GET | `/api/disciplinary-actions/:employeeId` | Riwayat SP karyawan |

---

### 6.28 Module Workforce Planning & Budgeting

> *Modul rekomendasi tambahan.*

#### 6.28.1 Tujuan

Menyediakan perencanaan dan kontrol headcount serta biaya tenaga kerja jangka menengah, sehingga pengajuan rekrutmen baru (§6.14) selalu dapat divalidasi terhadap rencana dan budget yang tersedia.

#### 6.28.2 Fitur

**Manpower Planning** — rencana headcount per departemen per periode, dibandingkan dengan realisasi aktual.
**Headcount Forecast** — proyeksi kebutuhan headcount berdasarkan rencana bisnis/growth rate.
**Payroll Forecast** — proyeksi biaya payroll berdasarkan manpower plan dan struktur gaji (§6.18).
**Recruitment Budget** — alokasi budget rekrutmen per departemen, divalidasi terhadap Manpower Request (§6.14).

#### 6.28.3 Business Rules

- Manpower request baru (§6.14) wajib divalidasi terhadap manpower plan dan budget yang tersedia pada periode terkait; permintaan di luar plan membutuhkan approval khusus (over-budget approval).
- Headcount forecast dan payroll forecast direview dan disesuaikan minimal setiap kuartal.
- Recruitment budget yang teralokasi namun tidak terserap dapat dialihkan (reallocate) ke departemen lain dengan approval Finance.

#### 6.28.4 Database Schema

```sql
manpower_plans (id INT PK AUTO_INCREMENT, company_id INT, department_id INT, period_year INT,
  planned_headcount INT, approved_budget DECIMAL(15,2), created_at DATETIME)
headcount_actuals (id INT PK AUTO_INCREMENT, manpower_plan_id INT, month INT, actual_headcount INT, recorded_at DATETIME)
payroll_forecasts (id INT PK AUTO_INCREMENT, manpower_plan_id INT, month INT,
  forecast_amount DECIMAL(15,2), actual_amount DECIMAL(15,2))
recruitment_budgets (id INT PK AUTO_INCREMENT, manpower_plan_id INT, allocated_amount DECIMAL(15,2),
  used_amount DECIMAL(15,2) DEFAULT 0, remaining_amount DECIMAL(15,2))
```

#### 6.28.5 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/manpower-plans` | Kelola rencana headcount per departemen |
| GET | `/api/manpower-plans/:id/actuals` | Realisasi headcount vs plan |
| GET | `/api/payroll-forecasts` | Proyeksi biaya payroll |
| GET | `/api/recruitment-budgets/:departmentId` | Sisa budget rekrutmen departemen |

---


## 7. Mobile App Requirements (Flutter)

### 7.1 Fitur Mobile App

**Authentication:**
- Login dengan biometrik (fingerprint/face ID) setelah login pertama
- Remember me / auto-login
- Push notification via FCM

**Dashboard Mobile:**
- Status kehadiran hari ini
- Widget jam real-time
- Saldo cuti tersisa
- Pengajuan pending
- **Mini kalender personal (shift, cuti, hari libur dari Work Calendar)**

**Absensi:**
- Clock In / Clock Out dengan GPS validation
- Selfie wajib (konfigurabel)
- Preview lokasi di peta sebelum submit
- Riwayat absensi harian/bulanan
- Mode offline: simpan lokal, sync otomatis saat ada koneksi

**Self Service:**
- Pengajuan cuti, izin, sakit, on duty
- Upload dokumen pendukung (foto/PDF)
- Tracking status pengajuan real-time
- Riwayat semua pengajuan

**Slip Gaji:**
- List slip gaji per bulan
- Tampilan detail slip gaji
- Download slip gaji (PDF)

**Profil Karyawan:**
- Lihat & edit informasi dasar
- Ganti password

**Notifikasi:**
- List notifikasi
- Badge count pada ikon notifikasi
- Tap notifikasi → langsung ke halaman terkait (deep linking)

### 7.2 UI/UX Guidelines Mobile

- Material Design 3 (Flutter default)
- Warna primer sesuai branding perusahaan (konfigurabel)
- Minimum font size: 14sp
- Support Dark Mode
- Loading state & skeleton screen untuk semua halaman
- Pull-to-refresh pada semua list
- Empty state dengan ilustrasi

### 7.3 Offline Mode

| Fitur | Offline Support |
|-------|----------------|
| Clock In/Out | ✅ (sync saat online) |
| Lihat riwayat absensi | ✅ (cache) |
| Pengajuan cuti/izin | ❌ (butuh koneksi) |
| Lihat slip gaji | ✅ (cache setelah diunduh) |
| Notifikasi | ❌ (butuh koneksi) |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metrik | Target |
|--------|--------|
| Response time API (95th percentile) | < 500ms |
| Page load time (web, 3G) | < 3 detik |
| Clock in/out response time | < 2 detik |
| Concurrent users | 500 simultaneous |
| Payroll run (500 karyawan) | < 5 menit |
| Dashboard load time | < 2 detik |

### 8.2 Availability & Reliability

- Uptime target: **99.5%** (maksimal downtime ~44 jam/tahun)
- Scheduled maintenance: Minggu dini hari (02:00–04:00 WIB)
- Database backup: harian otomatis, retensi 30 hari
- Recovery Time Objective (RTO): < 4 jam
- Recovery Point Objective (RPO): < 24 jam

### 8.3 Scalability

- Horizontal scaling siap (stateless Express.js + load balancer)
- Database: MySQL dengan read replica untuk laporan berat
- File storage: abstraksi layer (mudah migrasi dari lokal ke cloud)

### 8.4 Security

- Semua komunikasi via HTTPS (TLS 1.2+)
- JWT dengan expiry singkat + refresh token rotation
- Input validation & sanitasi di setiap endpoint
- SQL injection prevention (parameterized queries / ORM)
- XSS prevention (EJS auto-escape, CSP headers)
- Rate limiting: login (10 req/menit), API (100 req/menit per IP)
- File upload: validasi tipe & ukuran, scan nama file
- Enkripsi data sensitif di database (rekening bank, NPWP)
- HTTPS-only cookies (httpOnly, secure, SameSite)

### 8.5 Compatibility

**Web:**
- Chrome (terbaru & -1 versi)
- Firefox (terbaru & -1 versi)
- Safari (terbaru & -1 versi)
- Edge (terbaru)
- Responsive: Desktop (1280px+), Tablet (768px+)

**Mobile:**
- Android 6.0+ (API level 23+)
- iOS 12+

---

## 9. Database Schema Overview

### 9.1 Tabel Utama

```sql
-- Core Tables
companies (id, name, logo, npwp, address, ...)
branches (id, company_id, name, address, latitude, longitude, radius_meters, ...)
divisions (id, company_id, name, code, head_employee_id, ...)
departments (id, division_id, name, code, head_employee_id, ...)
positions (id, department_id, name, code, level, grade, ...)

-- Employee
employees (id, nik, company_id, branch_id, department_id, position_id,
           first_name, last_name, email, phone, date_of_birth, gender,
           join_date, employee_type, status, manager_id, ...)
employee_documents (id, employee_id, type, file_path, ...)
employee_bank_accounts (id, employee_id, bank_name, account_number, ...)

-- Shift & Schedule
shifts (id, company_id, name, type, clock_in, clock_out, tolerance_late,
        break_duration, overtime_min, ...)
employee_schedules (id, employee_id, shift_id, date, ...)

-- Work Calendar (NEW)
work_calendars (id, company_id, branch_id, department_id, name, year,
                work_days JSON, default_shift_id, is_active, description,
                created_by, created_at, updated_at, deleted_at)
work_calendar_days (id, calendar_id, date, day_type ENUM('WD','WS','WE','NH','JL','CH','RH','OT'),
                    name, notes, work_start, work_end, is_mandatory, created_by, created_at)
national_holidays (id, country_code, date, name, type ENUM('NH','JL'), year, source,
                   created_at, updated_at)

-- Attendance
attendances (id, employee_id, date, shift_id, clock_in, clock_out,
             clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
             status, late_minutes, early_out_minutes, overtime_minutes,
             is_correction, corrected_by, ...)

-- Leave
leave_types (id, company_id, name, code, max_days, carry_over_max, ...)
leave_balances (id, employee_id, leave_type_id, year, total, used, remaining, ...)
leave_requests (id, employee_id, leave_type_id, start_date, end_date,
                total_days, reason, status, approved_by, ...)

-- Requests
requests (id, employee_id, type, request_date, start_date, end_date,
          reason, attachment_path, status, ...)
request_approvals (id, request_id, approver_id, level, status, comment, approved_at, ...)

-- Payroll
salary_components (id, company_id, name, type, is_taxable, is_bpjs_base, ...)
employee_salary (id, employee_id, component_id, amount, effective_date, ...)
payroll_periods (id, company_id, month, year, status, run_at, finalized_at, ...)
payroll_details (id, period_id, employee_id, base_salary, total_earnings,
                 total_deductions, net_salary, tax_amount, ...)
payroll_components (id, payroll_detail_id, component_id, amount, ...)

-- Performance
kpi_templates (id, company_id, position_id, name, period_type, ...)
kpi_indicators (id, template_id, name, unit, target, weight, formula, ...)
kpi_assignments (id, employee_id, template_id, period, status, ...)
kpi_realizations (id, assignment_id, indicator_id, realization, score, ...)
appraisal_cycles (id, company_id, name, start_date, end_date, type, ...)
appraisals (id, cycle_id, employee_id, appraiser_id, type, status, final_rating, ...)

-- System
users (id, employee_id, email, password_hash, role, is_active, last_login, ...)
audit_logs (id, user_id, ip_address, module, action, entity, entity_id,
            before_value, after_value, status, created_at, ...)
notifications (id, user_id, type, title, message, is_read, reference_id, created_at, ...)
```

### 9.1b Tabel Enterprise Extension Module (6.14–6.28)

> Definisi kolom lengkap per tabel tersedia pada masing-masing sub-bagian "Database Schema" di §6.14–§6.28. Daftar berikut adalah ringkasan untuk gambaran skema keseluruhan.

```sql
-- Recruitment & ATS (6.14)
job_requisitions / job_vacancies / candidates / candidate_applications /
interviews / interview_panels / interview_feedbacks / job_offers

-- Onboarding & Offboarding (6.15)
onboarding_checklists / preboarding_documents / resignations /
exit_clearances / exit_interviews

-- Asset Management (6.16)
asset_categories / assets / asset_assignments / asset_returns

-- Learning Management System (6.17)
training_catalogs / learning_paths / learning_path_courses /
training_enrollments / certifications / assessments / assessment_results

-- Compensation & Benefit (6.18)
salary_grades / salary_ranges / salary_reviews / benefit_plans /
employee_benefits / thr_calculations

-- Employee Loan (6.19)
employee_loans / loan_installments / loan_payments

-- Travel & Expense Claim (6.20)
business_trips / travel_advances / expense_claims /
expense_approvals / reimbursements

-- Talent & Succession Planning (6.21)
critical_positions / talent_pools / nine_box_assessments / succession_plans

-- Employee Engagement (6.22)
surveys / survey_questions / survey_responses / recognitions / suggestions

-- Workflow Engine (6.23)
approval_types / approval_flows / approval_flow_steps /
approval_instances / approval_instance_logs

-- Document Management System (6.24)
document_categories / documents / document_signatures / document_access_logs

-- Integration Hub (6.25)
integration_configs / integration_field_mappings / integration_logs / sso_sessions

-- Policy & Compliance (6.26)
policies / policy_acknowledgements / compliance_audits / audit_findings

-- Disciplinary Action (6.27)
violations / investigations / disciplinary_actions

-- Workforce Planning & Budgeting (6.28)
manpower_plans / headcount_actuals / payroll_forecasts / recruitment_budgets
```

### 9.2 Indexing Strategy

- Index pada semua foreign key
- Composite index: `(employee_id, date)` pada tabel `attendances`
- Composite index: `(calendar_id, date)` pada tabel `work_calendar_days`
- Index pada `(year, country_code)` pada tabel `national_holidays`
- Index pada `(company_id, branch_id, department_id, year)` pada `work_calendars` (unique)
- Index pada `day_type` pada `work_calendar_days` (query hari libur)
- Index pada `status` untuk tabel yang sering di-filter (requests, leave_requests)
- Index pada `created_at` untuk audit_logs (query by date range)
- Full-text index pada `audit_logs.detail` (jika diperlukan)

---

## 10. API Design Guidelines

### 10.1 Konvensi

- **Base URL:** `https://api.{domain}/api/v1`
- **Format:** JSON untuk semua request/response
- **Authentication:** `Authorization: Bearer {token}` di header
- **Pagination:** `?page=1&per_page=20`
- **Sorting:** `?sort_by=created_at&sort_order=desc`
- **Filter:** `?department_id=1&status=active`
- **Search:** `?search=keyword`

### 10.2 Response Format

```json
{
  "success": true,
  "message": "Data berhasil diambil",
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 10.3 Error Format

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Email sudah terdaftar" }
  ]
}
```

### 10.4 HTTP Status Codes

| Code | Penggunaan |
|------|-----------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (token tidak valid) |
| 403 | Forbidden (tidak punya akses) |
| 404 | Not Found |
| 409 | Conflict (data duplikat) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## 11. Security Requirements

### 11.1 Authentication

- Password di-hash dengan **bcrypt** (minimum 12 rounds)
- JWT Secret Key minimal 256-bit, disimpan di environment variable
- Refresh token rotation: setiap refresh menghasilkan token baru, token lama diinvalidasi
- Blacklist token pada logout (simpan di Redis atau DB)

### 11.2 Data Protection

- Enkripsi at-rest untuk kolom sensitif: `account_number`, `npwp`, `ktp_number` (AES-256)
- Enkripsi in-transit: TLS 1.2 minimum
- Masking data sensitif di log (no. rekening ditampilkan sebagai `****1234`)

### 11.3 API Security

- Rate limiting dengan express-rate-limit
- Helmet.js untuk security headers
- CORS konfigurasi whitelist domain
- Input sanitasi dengan express-validator
- Upload file: whitelist ekstensi, scan MIME type, simpan di luar webroot

### 11.4 Compliance

- Kepatuhan terhadap UU ITE Indonesia
- Data retention policy: data karyawan disimpan minimum 5 tahun setelah resign
- Hak akses data personal: karyawan dapat melihat data dirinya sendiri

---

## 12. Milestone & Timeline

### 12.1 Release 1 — Core HRMS (Module 6.1–6.13)

| Phase | Milestone | Estimasi Durasi |
|-------|-----------|----------------|
| **Phase 0** | Setup environment, CI/CD, DB schema, Auth module | 2 minggu |
| **Phase 1** | Module: Master Employee, Org Structure | 4 minggu |
| **Phase 2** | Module: Shift, Work Calendar | 3 minggu |
| **Phase 3** | Module: Attendance (web, terintegrasi Work Calendar) | 3 minggu |
| **Phase 4** | Module: Leave Management, Self Service Request | 3 minggu |
| **Phase 5** | Module: Payroll (terintegrasi Work Calendar) | 4 minggu |
| **Phase 6** | Module: Performance Management (KPI + Appraisal) | 4 minggu |
| **Phase 7** | Module: Dashboard (incl. Work Calendar views), Notification, Audit Log | 3 minggu |
| **Phase 8** | Flutter Mobile App (Attendance + Self Service + Work Calendar) | 6 minggu |
| **Phase 9** | Flutter Mobile App (Full Feature) | 4 minggu |
| **Phase 10** | UAT, Bug Fixing, Performance Testing | 3 minggu |
| **Phase 11** | Go-Live & Hypercare | 2 minggu |
| **SUBTOTAL** | | **~41 minggu (~10 bulan)** |

### 12.2 Release 2 — Enterprise Extension (Module 6.14–6.28)

> Disarankan dimulai setelah Release 1 stabil di produksi (atau paralel dengan tim development terpisah). Urutan fase mengikuti dependency: Workflow Engine & DMS dibangun lebih awal karena menjadi fondasi approval/dokumen bagi modul lain.

| Phase | Milestone | Estimasi Durasi |
|-------|-----------|----------------|
| **Phase 12** | Module: Workflow Engine (6.23), Document Management System (6.24) — fondasi approval & dokumen lintas modul | 4 minggu |
| **Phase 13** | Module: Recruitment & ATS (6.14), Onboarding & Offboarding (6.15) | 5 minggu |
| **Phase 14** | Module: Asset Management (6.16), Employee Loan (6.19) | 3 minggu |
| **Phase 15** | Module: Compensation & Benefit (6.18), Travel & Expense Claim (6.20) | 4 minggu |
| **Phase 16** | Module: Learning Management System (6.17) | 4 minggu |
| **Phase 17** | Module: Talent & Succession Planning (6.21), Employee Engagement (6.22) | 4 minggu |
| **Phase 18** | Module: Integration Hub (6.25) — Accounting, Job Board, Attendance Device, Communication, SSO | 4 minggu |
| **Phase 19** | Module: Policy & Compliance (6.26), Disciplinary Action (6.27), Workforce Planning & Budgeting (6.28) | 4 minggu |
| **Phase 20** | UAT Enterprise Extension, Bug Fixing | 3 minggu |
| **Phase 21** | Go-Live Enterprise Extension & Hypercare | 2 minggu |
| **SUBTOTAL** | | **~37 minggu (~9 bulan)** |

### 12.3 Total Keseluruhan

| | Estimasi |
|---|---|
| Release 1 (Core) | ~41 minggu |
| Release 2 (Enterprise Extension) | ~37 minggu |
| **TOTAL (sekuensial)** | **~78 minggu (~18 bulan)** |

> Timeline dapat dipersingkat signifikan jika Release 2 dikerjakan paralel oleh tim development terpisah setelah Phase 7 Release 1 selesai (Core API & data model sudah stabil), atau jika perusahaan memilih hanya mengimplementasikan Tier 2 (6.14–6.20) tanpa Tier 3–4. Timeline final tetap perlu disesuaikan dengan jumlah developer yang tersedia.

---

## 13. Risks & Mitigasi

| Risiko | Kemungkinan | Dampak | Mitigasi |
|--------|:-----------:|:------:|---------|
| Perubahan regulasi PPh 21 / BPJS | Sedang | Tinggi | Modular tax engine, update berkala |
| Performa lambat saat payroll run banyak karyawan | Sedang | Tinggi | Queue / background job (Bull Queue) |
| Akurasi GPS absensi (indoor / urban canyon) | Tinggi | Sedang | Toleransi radius fleksibel, fallback ke QR Code |
| Data karyawan bocor / breach | Rendah | Sangat Tinggi | Enkripsi, audit log, rate limit, penetration test |
| Sinkronisasi offline absensi konflik | Sedang | Sedang | Conflict resolution strategy: server-side wins |
| Scope creep dari stakeholder | Tinggi | Tinggi | Change request process, backlog management |
| Integrasi dengan sistem legacy | Sedang | Sedang | API adapter layer, import/export Excel sebagai fallback |
| **Kalender tidak dikonfigurasi sebelum periode berjalan** | Sedang | Tinggi | Notifikasi otomatis H-7, validasi saat buka periode payroll |
| **Inkonsistensi hari libur antar branch** | Sedang | Sedang | Hierarki kalender multi-level, audit trail perubahan kalender |
| **Data absensi historis terdampak perubahan kalender** | Rendah | Tinggi | Lock kalender periode finalisasi, konfirmasi wajib sebelum update |
| **Akurasi parsing CV otomatis rendah (6.14)** | Tinggi | Sedang | Parsing sebagai bantuan input, tetap ada verifikasi manual oleh recruiter |
| **Ketergantungan pada API job board eksternal (6.14, 6.25)** | Sedang | Sedang | Fallback input manual aplikasi, circuit breaker pada integration layer |
| **Aset tidak terlacak/hilang saat mutasi antar cabang (6.16)** | Sedang | Sedang | Riwayat assignment wajib, verifikasi stok aset berkala (cycle count) |
| **Keabsahan hukum e-signature (6.24)** | Rendah | Tinggi | Gunakan provider e-sign tersertifikasi (PSrE) untuk dokumen legal, bukan e-sign internal |
| **Approval flow yang salah konfigurasi memblokir proses bisnis (6.23)** | Sedang | Tinggi | Staging/testing environment untuk setiap perubahan flow sebelum production, log perubahan konfigurasi |
| **Kebocoran data melalui integrasi pihak ketiga (6.25)** | Rendah | Tinggi | Enkripsi credential, scope API minimal (least privilege), audit log integrasi |
| **Over-budget recruitment akibat manpower request tidak divalidasi (6.14, 6.28)** | Sedang | Sedang | Validasi otomatis requisition terhadap manpower plan & budget sebelum approval |

---

## 14. Glossary

| Istilah | Definisi |
|---------|----------|
| **HRM / HRMS** | Human Resource Management System |
| **NIK** | Nomor Induk Karyawan (internal ID unik) |
| **KPI** | Key Performance Indicator |
| **Appraisal** | Proses penilaian kinerja formal |
| **Payroll** | Proses penggajian karyawan |
| **Clock In/Out** | Pencatatan waktu masuk/keluar kerja |
| **Geofencing** | Batas area geografis untuk validasi lokasi absensi |
| **FCM** | Firebase Cloud Messaging (push notification) |
| **RBAC** | Role-Based Access Control |
| **PTKP** | Penghasilan Tidak Kena Pajak |
| **PPh 21** | Pajak Penghasilan Pasal 21 (pajak gaji) |
| **JHT** | Jaminan Hari Tua (komponen BPJS Ketenagakerjaan) |
| **JP** | Jaminan Pensiun (komponen BPJS Ketenagakerjaan) |
| **Pro-rata** | Perhitungan proporsional berdasarkan hari kerja aktual |
| **Soft Delete** | Penghapusan data secara logis (data tetap ada di DB) |
| **UAT** | User Acceptance Testing |
| **IDP** | Individual Development Plan |
| **JWT** | JSON Web Token |
| **SSR** | Server-Side Rendering (menggunakan EJS) |
| **Work Calendar** | Konfigurasi kalender kerja yang menentukan hari kerja, hari libur, dan tipe hari — menjadi referensi utama untuk Attendance, Leave, dan Payroll |
| **Hari Kerja Efektif** | Jumlah hari kerja nyata dalam suatu periode, dihitung dari Work Calendar (mengecualikan weekend, libur nasional, cuti bersama) |
| **Day Type** | Kategorisasi tipe hari dalam Work Calendar: WD, WS, WE, NH, JL, CH, RH, OT |
| **OT (Overtime on Holiday)** | Hari libur yang dijadikan hari kerja dengan approval khusus, mendapat rate lembur lebih tinggi |
| **iCal (.ics)** | Format standar kalender digital yang dapat diimpor ke Google Calendar, Outlook, dll. |
| **Calendar Hierarchy** | Mekanisme pewarisan kalender dari level Company → Branch → Department → Employee |
| **ATS** | Applicant Tracking System — sistem pelacakan tahapan kandidat dalam proses rekrutmen |
| **Manpower Request / Requisition** | Pengajuan formal kebutuhan tenaga kerja baru oleh suatu unit kerja |
| **Talent Pool** | Kumpulan kandidat/karyawan potensial yang disimpan untuk kebutuhan posisi di masa depan |
| **HIPO** | High Potential Employee — karyawan dengan potensi tinggi untuk berkembang ke posisi lebih senior |
| **9 Box Matrix** | Alat pemetaan talent berdasarkan dua dimensi: performance dan potential, menghasilkan 9 kategori |
| **Successor / Readiness Level** | Kandidat pengganti untuk posisi kritikal beserta tingkat kesiapannya (Ready Now/1–2 Tahun/3–5 Tahun) |
| **LMS** | Learning Management System — sistem pengelolaan pelatihan dan pengembangan karyawan |
| **SCORM** | Standar format paket konten e-learning yang dapat diputar di berbagai LMS |
| **Compa-ratio** | Rasio gaji aktual karyawan terhadap titik tengah (mid-point) salary range jabatannya |
| **THR** | Tunjangan Hari Raya — tunjangan wajib yang dibayarkan menjelang hari raya keagamaan sesuai regulasi |
| **BAST** | Berita Acara Serah Terima — dokumen bukti serah terima aset/barang |
| **OCR** | Optical Character Recognition — teknologi ekstraksi teks dari gambar/dokumen (digunakan pada parsing CV & receipt) |
| **eNPS** | Employee Net Promoter Score — metrik keterlibatan karyawan berbasis skala rekomendasi 0–10 |
| **SLA** | Service Level Agreement — batas waktu yang disepakati untuk suatu proses (misal waktu respon approval) |
| **DMS** | Document Management System — repository dokumen terpusat dengan kontrol akses dan versioning |
| **E-Sign** | Tanda tangan elektronik untuk menyetujui/mengesahkan dokumen secara digital |
| **PSrE** | Penyelenggara Sertifikasi Elektronik — lembaga tersertifikasi yang menerbitkan sertifikat digital untuk tanda tangan elektronik sah secara hukum di Indonesia |
| **SP1/SP2/SP3** | Surat Peringatan tingkat 1, 2, dan 3 — tahapan tindakan disiplin formal terhadap karyawan |
| **Headcount Forecast** | Proyeksi jumlah kebutuhan karyawan di masa depan berdasarkan rencana bisnis |
| **SSO** | Single Sign-On — mekanisme login tunggal yang berlaku ke beberapa sistem (misal Google, Azure AD, LDAP) |

---

*Dokumen ini bersifat living document dan akan diperbarui seiring perkembangan proyek. Setiap perubahan material wajib melalui review dan persetujuan Product Owner.*

---

**Versi:** 2.0.0 (Consolidated — Core v1.1.0 + Enterprise Extension) | **Status:** Draft | **Juni 2026**