# 📘 Buku Manual HRMS Enterprise

> Panduan Lengkap Penggunaan Aplikasi HRMS untuk Semua Pengguna

---

## 📋 Daftar Isi

1. [Pendahuluan](#1-pendahuluan)
2. [Login & Dashboard](#2-login--dashboard)
3. [Organisasi](#3-organisasi)
4. [Karyawan](#4-karyawan)
5. [Absensi](#5-absensi)
6. [Cuti](#6-cuti)
7. [Penggajian (Payroll)](#7-penggajian-payroll)
8. [Tunjangan (Benefit)](#8-tunjangan-benefit)
9. [Kinerja (Performance)](#9-kinerja-performance)
10. [Pelatihan (LMS)](#10-pelatihan-lms)
11. [Rekrutmen (ATS)](#11-rekrutmen-ats)
12. [Administrasi Pengguna](#12-administrasi-pengguna)
13. [FAQ](#13-faq)

---

## 1. Pendahuluan

### 1.1 Tentang HRMS Enterprise

HRMS Enterprise adalah sistem manajemen sumber daya manusia terintegrasi yang dirancang untuk memudahkan pengelolaan data karyawan, absensi, cuti, penggajian, tunjangan, penilaian kinerja, pelatihan, dan rekrutmen dalam satu platform.

### 1.2 Hak Akses Pengguna

| Role | Deskripsi |
|------|-----------|
| **Super Admin** | Akses penuh ke seluruh sistem, semua perusahaan |
| **Group Admin** | Admin untuk grup perusahaan (holding) |
| **Company Admin** | Admin untuk satu perusahaan |
| **HR Manager** | Manager HR — bisa approve cuti, absensi, payroll |
| **HR Staff** | Staff HR — input data karyawan, operasional HR |
| **Manager** | Head departemen — approve cuti & absensi bawahan |
| **Employee** | Karyawan — pengajuan cuti, lihat payslip, absensi sendiri |

---

## 2. Login & Dashboard

### 2.1 Login

1. Buka aplikasi HRMS di browser
2. Masukkan **Email** dan **Password** yang sudah diberikan HR
3. Klik tombol **Sign In**

![Login Page]

> **Default password:** `Employee123!`  
> *Harap ganti password setelah login pertama kali*

### 2.2 Dashboard

Setelah login, Anda akan masuk ke halaman **Dashboard** yang menampilkan:

- Ringkasan data karyawan
- Statistik absensi hari ini
- Notifikasi cuti yang perlu approval (khusus Manager/HR)
- Pengingat tugas HR

### 2.3 Navigasi Sidebar

Sidebar di sebelah kiri berisi menu-menu utama:

```
📊 Dashboard
🏢 Organization
   ├── Company Groups
   ├── Companies
   ├── Departments
   └── Positions
👥 Employees
⏰ Attendance
📅 Leave
💰 Payroll
❤️ Benefits
🎯 Performance
📚 LMS
👥 Recruitment
📋 Reports
🔧 Administration
```

Klik menu untuk membuka halaman terkait. Menu dengan ikon ▸ memiliki sub-menu.

### 2.4 Logout

Klik tombol **Sign Out** di bagian bawah sidebar.

---

## 3. Organisasi

Menu Organisasi digunakan untuk mengelola struktur perusahaan. Modul ini dikelola oleh **Admin**.

### 3.1 Company Groups (Grup Perusahaan)

Digunakan jika perusahaan Anda bagian dari holding group.

**Cara melihat grup:**
1. Sidebar → **Organization** → **Company Groups**
2. Tabel menampilkan daftar grup beserta jumlah perusahaan di dalamnya

**Tambah grup baru** (Admin only):
1. Klik tombol **Add Group**
2. Isi form: Nama Group, Kode, NPWP, Alamat
3. Klik **Save**

### 3.2 Companies (Perusahaan)

**Cara melihat perusahaan:**
1. Sidebar → **Organization** → **Companies**
2. Tabel menampilkan: Nama, Kode, Group, Jumlah Karyawan, Status

### 3.3 Departments (Departemen)

**Cara melihat departemen:**
1. Sidebar → **Organization** → **Departments**
2. Tabel menampilkan: Nama Departemen, Kode, Cost Center, Jumlah Posisi

**Cari departemen:**
- Gunakan kotak **Search** untuk mencari berdasarkan nama atau kode

### 3.4 Positions (Posisi Jabatan)

**Cara melihat posisi:**
1. Sidebar → **Organization** → **Positions**
2. Filter berdasarkan departemen menggunakan dropdown

Setiap posisi memiliki **Grade Level** yang digunakan sebagai referensi range gaji.

---

## 4. Karyawan

Menu **Employees** adalah pusat data master karyawan.

### 4.1 Melihat Daftar Karyawan

1. Sidebar → **Employees**
2. Halaman menampilkan tabel dengan kolom:
   - **Employee** — Nama lengkap & email
   - **Number** — Nomer induk karyawan (NIK)
   - **Department** — Departemen
   - **Position** — Jabatan
   - **Type** — Jenis (Permanent/Kontrak/Intern)
   - **Status** — Status kepegawaian
   - **Join Date** — Tanggal masuk

### 4.2 Mencari & Filter Karyawan

- **Search**: Ketik nama, NIK, atau email
- **Filter Department**: Pilih departemen dari dropdown
- **Filter Status**: Klik tombol status (Active, Probation, Resigned, dll)
- **Pagination**: Navigasi halaman di bagian bawah tabel

### 4.3 Melihat Detail Karyawan

Klik pada baris karyawan untuk membuka halaman detail:

**Informasi Personal:**
- Nama lengkap, NIK
- Email, No. Telepon
- Gender, Agama, Status Pernikahan
- Alamat

**Informasi Organisasi:**
- Departemen, Posisi, Branch
- Tipe Employment, Tanggal Masuk
- Status Kepegawaian

**Informasi Bank & Pajak:**
- Nama Bank, No. Rekening, Pemilik Rekening
- NPWP
- BPJS Ketenagakerjaan
- BPJS Kesehatan

### 4.4 Menambah Karyawan Baru (HR/Admin)

1. Klik tombol **Add Employee**
2. Isi data-data berikut:
   - **Wajib**: Company, Employee Number, First Name, Last Name
   - **Opsional**: Department, Position, Branch, Email, Phone
   - **Bank & Tax**: Bank, Rekening, NPWP, BPJS
3. Klik **Save**
4. Sistem akan otomatis membuat User Account untuk karyawan tersebut

> **Catatan:** Employee Number (NIK) harus unik dan tidak boleh sama dengan karyawan lain

---

## 5. Absensi

Menu **Attendance** digunakan untuk mencatat dan memantau kehadiran karyawan.

### 5.1 Melihat Data Absensi

1. Sidebar → **Attendance**
2. Halaman menampilkan statistik:
   - ✅ **Present** — Jumlah hadir
   - ⚠️ **Late** — Jumlah terlambat
   - ❌ **Absent** — Jumlah tidak hadir

3. Tabel absensi menampilkan:
   - Nama karyawan
   - Tanggal
   - Waktu Check In
   - Waktu Check Out
   - Status (Present/Late/Absent/Excused)

### 5.2 Filter Absensi

- **Search**: Cari berdasarkan nama karyawan
- **Date filter**: Pilih tanggal spesifik dengan input date
- **Status filter**: Klik tombol (All/Present/Absent/Late/Excused)

### 5.3 Mencatat Absensi Manual (HR)

**Check In:**
1. Klik tombol **Add Record**
2. Pilih Employee
3. Set tanggal dan jam check in
4. Klik **Save**

**Check Out:**
1. Cari record absensi karyawan
2. Klik tombol **Check Out**
3. Sistem otomatis mencatat waktu check out

> Sistem akan otomatis mendeteksi **keterlambatan** jika check in setelah jam 09:00

### 5.4 Overtime (Lembur)

**Pengajuan lembur:**
1. Buka halaman Attendance
2. Klik **Overtime** tab
3. Klik **New Overtime Request**
4. Isi: Tanggal, Jam Mulai, Jam Selesai, Alasan
5. Klik **Submit**

**Approval lembur** (Manager/HR):
1. Buka daftar Overtime
2. Cari request dengan status **Pending**
3. Klik **Approve** atau **Reject**

---

## 6. Cuti

Menu **Leave** digunakan untuk mengelola cuti karyawan.

### 6.1 Jenis Cuti yang Tersedia

| Jenis Cuti | Dibayar | Maks Hari | Lampiran |
|------------|---------|-----------|----------|
| Annual Leave ✅ | Ya | 12 hari/tahun | Tidak |
| Sick Leave 🤒 | Ya | 14 hari | Tidak |
| Maternity Leave 👶 | Ya | 90 hari | Ya |
| Paternity Leave 👶 | Ya | 3 hari | Tidak |
| Marriage Leave 💍 | Ya | 3 hari | Ya |
| Bereavement Leave 🕊️ | Ya | 3 hari | Tidak |
| Unpaid Leave | Tidak | 30 hari | Tidak |

### 6.2 Mengajukan Cuti

1. Sidebar → **Leave**
2. Klik tombol **New Request**
3. Isi form:
   - **Leave Type**: Pilih jenis cuti
   - **Start Date & End Date**: Pilih tanggal
   - **Reason**: Alasan cuti
   - **Attachment**: Upload dokumen (jika diperlukan)
4. Klik **Submit**
5. Status akan **Pending** menunggu approval

> **Cek sisa cuti:** Saldo cuti tahunan bisa dilihat di halaman Leave Balances

### 6.3 Approval Cuti (Manager/HR)

1. Buka halaman **Leave**
2. Filter status **Pending**
3. Klik pada request cuti untuk melihat detail
4. Klik **Approve** atau **Reject**
5. Jika Reject, isikan alasan penolakan

### 6.4 Melihat Status Cuti

| Status | Arti |
|--------|------|
| **Pending ⏳** | Menunggu approval |
| **Approved ✅** | Disetujui |
| **Rejected ❌** | Ditolak |
| **Cancelled** | Dibatalkan |
| **Withdrawn** | Ditarik oleh pengaju |

---

## 7. Penggajian (Payroll)

Menu **Payroll** digunakan untuk mengelola penggajian karyawan. Modul ini dikelola oleh **HR & Finance**.

### 7.1 Komponen Gaji

**Melihat komponen gaji:**
1. Sidebar → **Payroll** → **Salary Components**
2. Daftar komponen seperti: Gaji Pokok, Tunjangan Makan, BPJS, PPh 21

**Tambah komponen baru** (Admin):
1. Klik **Add Component**
2. Isi: Nama, Kode, Tipe (Allowance/Deduction), Metode Perhitungan
3. Metode perhitungan:
   - **FIXED**: Jumlah tetap (contoh: Tunjangan Makan = Rp 1.500.000)
   - **PERCENTAGE**: Persentase dari gaji pokok (contoh: BPJS = 1%)

### 7.2 Struktur Gaji Karyawan

1. Sidebar → **Payroll** → **Employee Salaries**
2. Tabel menampilkan: Nama, Gaji Pokok, Tanggal Efektif, Status
3. Klik pada baris untuk melihat detail komponen per karyawan

**Mengatur gaji karyawan:**
1. Klik **Add Salary**
2. Pilih Employee, masukkan Gaji Pokok, tanggal efektif
3. Atur komponen alokasi per karyawan
4. Klik **Save**

### 7.3 Payroll Period & Run

**Periode Penggajian:**
1. Sidebar → **Payroll** → **Periods**
2. Ada periode bulanan, biweekly, atau weekly
3. Klik **Add Period** untuk membuat periode baru

**Run Payroll:**
1. Sidebar → **Payroll** → **Runs**
2. Klik **New Run**
3. Pilih Period, isi Nama Run
4. Klik **Process** → Sistem akan menghitung gaji semua karyawan
5. Status berubah: **Draft → Processing → Completed**

**Approval & Disbursement:**
- **Completed** → Manager/Finance **approve**
- **Approved** → Finance **disburse** (pencairan)
- **Disbursed** → Gaji sudah cair ✅

### 7.4 Melihat Payslip (Slip Gaji)

**Karyawan:**
1. Sidebar → **Payroll** → **My Payslips**
2. Pilih periode payslip
3. Lihat rincian: Gaji Pokok, Tunjangan, Potongan, Total Bersih

**HR/Finance:**
1. Sidebar → **Payroll** → **Runs**
2. Klik pada Payroll Run
3. Lihat semua payslip karyawan dalam run tersebut

Rincian payslip:
- **Earnings**: Gaji Pokok + Tunjangan Makan + Tunjangan Transport + dll
- **Deductions**: BPJS Kesehatan + BPJS TK + PPh 21
- **Net Pay**: Total Earnings - Total Deductions

---

## 8. Tunjangan (Benefit)

Menu **Benefits** mengelola program tunjangan karyawan.

### 8.1 Melihat Benefit Plans

1. Sidebar → **Benefits**
2. Tampilan kartu menampilkan:
   - Nama plan (BPJS, Insurance, THR)
   - Tipe
   - Kontribusi Karyawan / Perusahaan
   - Jumlah peserta

### 8.2 Detail Plan

Klik pada kartu untuk melihat detail:
- Informasi plan
- Daftar peserta/enrollment
- Riwayat perubahan

### 8.3 Enroll Karyawan (HR)

1. Buka detail **Benefit Plan**
2. Klik **Add Enrollment**
3. Pilih Employee
4. Set tanggal efektif
5. Klik **Save**

---

## 9. Kinerja (Performance)

Menu **Performance** digunakan untuk penilaian kinerja dan goal tracking.

### 9.1 Review Cycles

1. Sidebar → **Performance** → **Dashboard**
2. Cycle aktif ditampilkan di halaman utama
3. Klik **View All** untuk melihat semua cycle

**Tipe cycle:**
- **Quarterly** (Q1, Q2, Q3, Q4)
- **Semi-Annual** (H1, H2)
- **Annual**

### 9.2 Performance Review

**Mengisi review** (Manager/HR):
1. Sidebar → **Performance** → **Reviews**
2. Filter berdasarkan cycle atau status
3. Klik review yang statusnya **Draft**
4. Isi penilaian per section:
   - Beri skor (1-5) untuk setiap kriteria
   - Tulis komentar
5. Klik **Submit**

**Approval review:**
- Review submitted → Manager approve
- Status berubah: Draft → Submitted → Approved → Completed

### 9.3 Goals & OKRs

**Melihat goals:**
1. Sidebar → **Performance** → **Goals**
2. Statistik: Total Goals, Completed, Rata-rata Progress

**Menambah goal:**
1. Klik **New Goal**
2. Isi: Title, Description, Type, Priority, Target Date
3. Klik **Save**

**Update progress:**
1. Klik pada goal
2. Masukkan persentase progress terbaru
3. Tambahkan catatan update

Indikator progress:
- 🟢 **0-49%**: Warna kuning (on track)
- 🔵 **50-99%**: Warna biru (hampir selesai)
- 🟢 **100%**: Warna hijau (completed)

---

## 10. Pelatihan (LMS)

Menu **LMS** (Learning Management System) mengelola pelatihan karyawan.

### 10.1 Melihat Kursus

1. Sidebar → **LMS**
2. Tampilan kartu dengan informasi:
   - Judul & kode kursus
   - Kategori
   - Durasi
   - Jumlah peserta
   - Status mandatory/optional

### 10.2 Filter Kursus

- **Search**: Cari berdasarkan judul atau kode
- **Category filter**: Klik kategori untuk filter

### 10.3 Detail Kursus

Klik pada kartu kursus untuk melihat:
- **Deskripsi**: Penjelasan kursus
- **Provider**: Penyedia pelatihan
- **Materials**: Daftar materi (file, link)
- **Sessions**: Jadwal sesi pelatihan
  - Tanggal & waktu
  - Trainer
  - Lokasi / Online
  - Status sesi (Scheduled/In Progress/Completed)
- **Enrollments**: Daftar peserta

### 10.4 Enroll Karyawan (HR)

1. Buka detail kursus
2. Klik **Add Enrollment**
3. Pilih Employee
4. Klik **Save**

### 10.5 Status Enrollment

| Status | Arti |
|--------|------|
| **Enrolled** | Terdaftar |
| **In Progress** | Sedang mengikuti |
| **Completed** ✅ | Selesai |
| **Cancelled** | Dibatalkan |

---

## 11. Rekrutmen (ATS)

Menu **Recruitment** adalah Applicant Tracking System untuk mengelola rekrutmen.

### 11.1 Job Postings

**Melihat lowongan:**
1. Sidebar → **Recruitment** → **Job Postings**
2. Kartu menampilkan: judul, kode, tipe, status, jumlah pelamar

**Membuat lowongan baru:**
1. Klik **New Posting**
2. Isi: Title, Department, Position, Employment Type, Location
3. Deskripsi pekerjaan & requirements
4. Range gaji (opsional)
5. Jumlah vacancies
6. Klik **Save** → status **Draft**

**Mempublikasikan:**
1. Buka detail posting
2. Klik **Publish**
3. Status berubah: **Draft → Published**

**Menutup lowongan:**
1. Klik **Close**
2. Status: **Published → Closed**

### 11.2 Pipeline Kandidat

1. Sidebar → **Recruitment** → **Pipeline**
2. Tampilan **Kanban** dengan kolom:
   - **New** 🆕 — Pelamar baru
   - **Screening** 🔍 — Sedang disaring
   - **Interview** 🎤 — Wawancara
   - **Offer** 📄 — Penawaran
   - **Hired** ✅ — Diterima
   - **Rejected** ❌ — Ditolak

**Memindahkan kandidat:**
- Klik tombol **Screen**, **Interview**, **Offer**, atau **Hire** pada kartu kandidat
- Atau klik **✕** untuk reject

**Filter pipeline:**
- Pilih job posting dari filter di atas untuk melihat pipeline per lowongan

### 11.3 Interview Schedule

1. Sidebar → **Recruitment** → **Interviews**
2. Jadwal dikelompokkan per tanggal
3. Status interview: Scheduled, Confirmed, In Progress, Completed, Cancelled

**Menjadwalkan interview:**
1. Klik **Schedule Interview**
2. Pilih Candidate, Application
3. Tentukan tanggal, jam, durasi
4. Pilih tipe: **Online** (isi link meeting) atau **Offline** (isi lokasi)
5. Klik **Save**

### 11.4 Candidates Database

1. Sidebar → **Recruitment** → **Candidates**
2. Database kandidat berisi semua pelamar
3. Cari berdasarkan nama, email, posisi, atau perusahaan sebelumnya
4. Status kandidat: Active, Hired, Rejected, Blacklisted

---

## 12. Administrasi Pengguna

Menu **Administration** dikelola oleh Admin untuk mengatur pengguna sistem.

### 12.1 Manajemen User

1. Sidebar → **Administration** → **Users**
2. Daftar semua user yang memiliki akses ke sistem

### 12.2 Manajemen Role

1. Sidebar → **Administration** → **Roles**
2. Lihat dan atur role serta permission-nya

### 12.3 Audit Log

1. Sidebar → **Administration** → **Audit Log**
2. Catatan semua aktivitas penting dalam sistem:
   - Siapa yang mengakses apa
   - Perubahan data sensitif
   - Waktu kejadian

### 12.4 Settings

1. Sidebar → **Administration** → **Settings**
2. Konfigurasi:
   - Pengaturan perusahaan
   - Kebijakan cuti
   - Jam kerja
   - Format tanggal & waktu

---

## 13. FAQ

### 13.1 Saya lupa password, bagaimana?
Klik **Forgot Password** di halaman login. Masukkan email terdaftar, link reset password akan dikirim.

### 13.2 Saya tidak bisa login dengan email saya?
Hubungi HR atau Admin untuk memastikan akun Anda aktif.

### 13.3 Data karyawan tidak muncul?
Pastikan Company ID sudah sesuai. Jika masih bermasalah, hubungi Admin.

### 13.4 Sisa cuti saya tidak sesuai?
Hubungi HR untuk pengecekan dan penyesuaian saldo cuti.

### 13.5 Payslip tidak muncul?
Pastikan payroll run untuk periode tersebut sudah selesai diproses dan di-approve.

### 13.6 Browser apa yang didukung?
Chrome (recommended), Firefox, Edge, Safari — versi terbaru.

### 13.7 Aplikasi tidak bisa diakses?
Cek koneksi internet Anda. Jika masih bermasalah, hubungi tim IT.

---

## Lampiran: Status & Warna

| Status | Warna | Arti |
|--------|-------|------|
| ACTIVE | 🟢 Hijau | Aktif |
| INACTIVE | ⚪ Abu | Tidak aktif |
| DRAFT | ⚪ Abu | Draft/belum jadi |
| PUBLISHED | 🟢 Hijau | Dipublikasi |
| PENDING | 🟡 Kuning | Menunggu approval |
| APPROVED | 🟢 Hijau | Disetujui |
| REJECTED | 🔴 Merah | Ditolak |
| COMPLETED | 🔵 Biru | Selesai |
| CANCELLED | ⚪ Abu | Dibatalkan |
| PROCESSING | 🔵 Biru | Sedang diproses |
| DISBURSED | 🟢 Hijau | Sudah dicairkan |

---

> **HRMS Enterprise v1.0**  
> Document version: 1.0 — June 25, 2026  
> *Untuk bantuan lebih lanjut, hubungi tim IT atau HR department*
