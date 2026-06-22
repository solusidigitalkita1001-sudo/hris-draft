# Dokumen Alur Sistem (System Flow Documentation)
## Human Resource Management System (HRMS) — dengan Dukungan Struktur Company Group

**Dokumen pendamping dari:** Product Requirements Document (PRD) HRM System v2.0.0 (Consolidated)
**Versi Dokumen:** 1.0.0
**Tanggal:** Juni 2026
**Status:** Draft
**Cakupan:** Seluruh 28 modul (6.1–6.28) + penambahan fitur **Company Group** (struktur multi-perusahaan/holding)

---

## Daftar Isi

1. Pendahuluan
2. Konsep Baru: Company Group (Struktur Multi-Perusahaan/Holding)
3. Alur Sistem — Core Modules (6.1–6.13)
4. Alur Sistem — Enterprise Extension Modules (6.14–6.28)
5. Lampiran — Matriks Dampak Company Group per Modul

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

PRD v2.0.0 telah mendefinisikan **fitur** (what), **business rules**, **database schema**, dan **API endpoint** untuk 28 modul HRMS. Dokumen ini melengkapinya dengan **alur sistem (system flow)** — yaitu *bagaimana* setiap menu/modul berjalan secara operasional: siapa aktor yang terlibat, apa yang memicu proses, langkah demi langkah apa yang terjadi di sisi pengguna maupun sisi sistem, di titik mana keputusan/validasi terjadi, dan bagaimana data mengalir ke modul lain.

Dokumen ini juga memformalkan **fitur tambahan yang diminta**: dukungan terhadap **Company Group** — yaitu kemampuan sistem untuk mengelola beberapa perusahaan (legal entity) yang bernaung di bawah satu grup/holding, dengan tetap menjaga independensi data per perusahaan sekaligus menyediakan visibilitas dan kontrol terkonsolidasi di level grup.

### 1.2 Ruang Lingkup

Dokumen mencakup seluruh 28 modul sebagaimana terdefinisi di PRD §6:

- **Core Modules (6.1–6.13):** Authentication & Authorization, Master Employee, Organization Structure, Shift Management, Work Calendar, Attendance, Leave Management, Self Service Request, Payroll, Performance Management, Dashboard & Reporting, Notification & Alert, Audit Log.
- **Enterprise Extension Modules (6.14–6.28):** Recruitment & ATS, Onboarding & Offboarding, Asset Management, Learning Management System, Compensation & Benefit, Employee Loan, Travel & Expense Claim, Talent & Succession Planning, Employee Engagement, Workflow Engine, Document Management System, Integration Hub, Policy & Compliance Management, Disciplinary Action Management, Workforce Planning & Budgeting.

Setiap modul dijelaskan dengan format yang konsisten:

| Bagian | Isi |
|---|---|
| **Tujuan** | Ringkasan satu-dua kalimat tentang fungsi modul |
| **Aktor & Trigger** | Siapa yang memulai proses dan apa pemicunya |
| **Alur Utama** | Langkah demi langkah proses dari awal sampai selesai |
| **Alur Alternatif/Pengecualian** | Percabangan proses: ditolak, dibatalkan, eskalasi, dll. |
| **Titik Keputusan & Validasi Kunci** | Business rule yang menentukan proses lanjut/berhenti |
| **Integrasi Modul Lain** | Modul apa yang menerima/mengirim data dari proses ini |
| **Dampak Company Group** | Bagaimana proses ini berubah/diperluas dengan adanya struktur multi-perusahaan |

### 1.3 Hubungan dengan PRD Utama

Dokumen ini **tidak menggantikan** PRD v2.0.0 — business rules, database schema, dan API endpoints yang sudah didefinisikan di PRD tetap berlaku dan menjadi rujukan teknis. Dokumen ini menambahkan lapisan **proses/flow** di atasnya, dan menandai di mana skema data & endpoint perlu **diperluas** (misalnya field baru `group_id`, `company_id` pada tabel yang relevan) untuk mendukung Company Group. Detail perubahan skema disebutkan inline di setiap modul yang terdampak, dan dirangkum di Bagian 2.3.

---

## 2. Konsep Baru: Company Group (Struktur Multi-Perusahaan/Holding)

### 2.1 Latar Belakang & Tujuan

PRD v2.0.0 saat ini mengasumsikan struktur "single company" dengan dukungan multi-*branch* (§6.3 Organization Structure menyebut "multi-company support" secara opsional namun belum dirinci alurnya). Pada praktiknya, banyak grup usaha di Indonesia mengoperasikan **beberapa PT (badan hukum/legal entity) berbeda** di bawah satu holding/grup usaha — misalnya PT induk + beberapa anak usaha di sektor berbeda — yang ingin:

- Mengelola SDM lintas anak usaha dari **satu platform yang sama**, tanpa instalasi/database terpisah per perusahaan.
- Menjaga **independensi data legal/pajak** per perusahaan (NPWP, BPJS, PPh 21, payroll run berbeda per badan hukum — karena setiap PT adalah *wajib pajak* terpisah secara hukum).
- Mendapatkan **visibilitas & pelaporan terkonsolidasi** di level grup (total headcount grup, total biaya payroll grup, dashboard eksekutif lintas anak usaha) tanpa harus membuka data sensitif satu per satu.
- Memfasilitasi **mobilitas karyawan lintas perusahaan** dalam grup (mutasi/transfer/perbantuan) tanpa kehilangan riwayat kerja dan tanpa proses resign-rehire yang tidak perlu.
- Menentukan kebijakan (policy, salary structure, leave type, kalender libur, approval flow) yang **dapat diturunkan dari grup** namun **dapat dikustomisasi per perusahaan**.

### 2.2 Hierarki Entitas

Company Group menambahkan **satu level baru di atas Company**, sehingga hierarki organisasi penuh menjadi:

```
Company Group (Holding)
 └── Company (Legal Entity / Badan Hukum, masing-masing punya NPWP sendiri)
      └── Branch (Lokasi/Cabang)
           └── Division
                └── Department
                     └── Sub-Department
                          └── Position (Jabatan) + Level/Grade
```

**Catatan penting:**
- Satu `Company Group` dapat menaungi **banyak** `Company`.
- Satu `Company` **hanya** dapat berada di **satu** `Company Group` (atau berdiri sendiri tanpa grup — `group_id` nullable, untuk kasus pelanggan yang hanya punya satu PT).
- Karyawan (`employees`) tetap secara primer terikat pada satu `Company` (untuk keperluan kontrak kerja & pajak), namun dapat memiliki **riwayat penugasan lintas company** dalam grup yang sama (lihat §2.5.1).

### 2.3 Perubahan/Penambahan Skema Data

Tabel baru dan kolom tambahan yang diperlukan untuk mendukung Company Group (melengkapi skema di PRD §9):

```
-- Tabel baru
company_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE,
  holding_npwp VARCHAR(30) NULL,
  logo VARCHAR(255) NULL,
  address TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME, updated_at DATETIME, deleted_at DATETIME NULL
)

-- Perubahan tabel existing
companies (
  ...kolom existing...,
  group_id INT NULL REFERENCES company_groups(id)   -- NULL = perusahaan berdiri sendiri (non-grup)
)

-- Riwayat penugasan/mutasi lintas company dalam satu grup
employee_company_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  company_id INT NOT NULL,
  assignment_type ENUM('Primary','Secondment','Transfer') DEFAULT 'Primary',
  -- Primary: penugasan utama saat ini; Secondment: perbantuan sementara (dual-record);
  -- Transfer: mutasi permanen (mengakhiri assignment Primary sebelumnya)
  start_date DATE NOT NULL,
  end_date DATE NULL,
  reason TEXT NULL,
  approved_by INT NULL,
  created_at DATETIME
)

-- Konfigurasi akses lintas company untuk user tertentu (Group Super Admin, Group HR, dst.)
user_company_access (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  company_id INT NOT NULL,        -- baris berulang untuk setiap company yang bisa diakses
  access_scope ENUM('Group-Wide','Single-Company') DEFAULT 'Single-Company',
  role_override VARCHAR(50) NULL,
  created_at DATETIME
)
```

Kolom `company_id` (selain `branch_id`/`department_id` yang sudah ada) ditambahkan secara eksplisit pada tabel-tabel berikut agar query "data milik company mana" tidak perlu join berantai melalui branch → company: `employees`, `job_requisitions`, `job_vacancies`, `payroll_periods`, `manpower_plans`, `assets`, `policies`, `integration_configs`.

### 2.4 Model Akses: Group-Level vs Company-Level RBAC

RBAC pada PRD §5 diperluas dengan **scope akses**, bukan sekadar role:

| Peran | Scope Default | Catatan |
|---|---|---|
| **Group Super Admin** | Seluruh Company dalam grup | Satu-satunya peran yang dapat membuat/menghapus Company baru dalam grup, mengatur kebijakan level grup, dan melihat laporan konsolidasi penuh |
| **Group HR Director** | Seluruh Company (view + approval tertentu) | Approval untuk kasus lintas company: manpower request di atas budget tertentu, mutasi antar company, kebijakan group-wide |
| **HR Manager / Finance Manager** | Default 1 Company (dapat diberi akses tambahan via `user_company_access`) | Sesuai PRD §5, namun dibatasi pada `company_id` miliknya kecuali ditandai *Group-Wide* |
| **Manager/Supervisor & Employee** | Selalu Single-Company | Tidak ada perubahan dari PRD §5 |

Setiap query data (employee list, attendance, payroll, dsb.) di seluruh modul **wajib** menerapkan filter `company_id IN (companies yang diizinkan untuk user ini)` sebagai baseline row-level security, sebelum filter lain (departemen, status, dll.) diterapkan.

### 2.5 Skenario Lintas Perusahaan yang Didukung

#### 2.5.1 Mutasi/Perbantuan Karyawan Antar Company dalam Grup
Karyawan dapat dipindahkan secara **permanen** (Transfer) atau **sementara/perbantuan** (Secondment) ke Company lain dalam grup yang sama, tanpa proses resign-rehire:
- **Transfer permanen** → tercatat di `employee_company_assignments` sebagai baris baru tipe `Transfer`, baris `Primary` lama ditutup (`end_date` terisi). NIK dapat tetap sama (riwayat kerja & masa kerja untuk hitungan cuti/pesangon tetap berlanjut), namun kontrak kerja baru biasanya diterbitkan karena badan hukum berbeda (implikasi pajak/BPJS).
- **Secondment/perbantuan** → baris baru tipe `Secondment` dibuat **tanpa** menutup baris `Primary`; karyawan tercatat aktif di dua company untuk periode tertentu (misal proyek 3 bulan), namun payroll tetap dibayarkan dari satu company (biasanya company asal) dengan opsional *cost allocation/cross-charge* ke company tujuan untuk keperluan akuntansi.
- Disetujui berjenjang: Manager asal → HR Manager asal → HR Manager tujuan → (jika lintas grade/beda budget signifikan) Group HR Director.

#### 2.5.2 Payroll & Pajak per Legal Entity, Laporan Konsolidasi
Setiap `Company` tetap menjalankan **payroll run terpisah** (karena NPWP, PPh 21, dan BPJS terdaftar atas nama badan hukum masing-masing — tidak bisa digabung secara legal). Namun:
- Dashboard Finance di level **Group** dapat menampilkan **agregasi** biaya payroll seluruh company tanpa membongkar slip individual.
- Karyawan dengan status *Secondment* yang gajinya dibayar company asal namun bekerja di company tujuan, dicatat sebagai *cross-charge* pada laporan payroll company tujuan (bukan payroll run terpisah, melainkan baris jurnal pengalokasian biaya).

#### 2.5.3 Rekrutmen & Talent Pool Lintas Company
Lowongan (`job_vacancies`) dapat ditandai **Group-Wide** — kandidat yang melamar dapat dipertimbangkan untuk penempatan di Company manapun dalam grup sesuai hasil interview, bukan hanya company pembuka lowongan. Talent Pool juga bersifat group-wide secara default, sehingga kandidat yang ditolak oleh satu anak usaha dapat ditemukan kembali oleh anak usaha lain dalam grup yang sama.

#### 2.5.4 Approval Lintas Company untuk Item Bernilai Tinggi
Workflow Engine (§6.23) mendukung step approval tambahan **"Group HR Director"** atau **"Group Finance Director"** yang dipicu otomatis ketika kondisi tertentu terpenuhi — misalnya manpower request di atas ambang budget tertentu, mutasi antar company, atau offer salary di luar range yang melibatkan dua company berbeda.

#### 2.5.5 Shared Services: Asset, LMS, Policy di Level Grup vs Company
Beberapa resource dapat berstatus **Group-Shared** (dipakai bersama seluruh company, misal: training catalog kepemimpinan, policy code of conduct grup, pool kendaraan dinas) atau **Company-Specific** (khusus satu company, misal: SOP operasional pabrik anak usaha tertentu). Penandaan ini dilakukan melalui kolom `scope ENUM('Group','Company')` pada modul terkait (LMS course, Policy, Asset category, dsb).

### 2.6 Ringkasan Dampak ke Setiap Modul

Tingkat dampak Company Group terhadap masing-masing modul bervariasi — sebagian berubah signifikan pada alurnya (perlu langkah/validasi baru), sebagian hanya bertambah satu filter scope tanpa mengubah alur inti. Ringkasan ini dijabarkan lebih rinci di setiap modul pada Bagian 3 & 4, dan dirangkum sebagai matriks di Lampiran (Bagian 5).

---

## 3. Alur Sistem — Core Modules (6.1–6.13)

### 3.1 Module Authentication & Authorization

**Tujuan:** Memvalidasi identitas pengguna dan menentukan hak akses (role + scope company) sebelum pengguna dapat berinteraksi dengan modul manapun.

**Aktor & Trigger:** Semua jenis pengguna (Super Admin s.d. Employee); dipicu saat pengguna membuka aplikasi web/mobile dan memasukkan kredensial, atau saat token akses kedaluwarsa dan perlu refresh.

**Alur Utama (Login):**
1. Pengguna membuka halaman login, memasukkan email & password.
2. Sistem memvalidasi format input (email valid, password tidak kosong).
3. Sistem mencari user berdasarkan email; jika tidak ditemukan → tampilkan error generik ("Email atau password salah") tanpa membedakan apakah email tidak ada atau password salah (mencegah *user enumeration*).
4. Sistem mengecek status percobaan login gagal — jika akun sedang terkunci (lihat §3.1 Validasi) → tolak dengan pesan waktu tunggu tersisa.
5. Sistem mem-verifikasi password menggunakan bcrypt compare.
6. **[Jika 2FA aktif]** → sistem mengirim kode OTP via email/authenticator, pengguna memasukkan kode, sistem memvalidasi.
7. Sistem menentukan **scope company** pengguna: mengambil seluruh baris di `user_company_access` (jika ada) atau default `company_id` dari profil employee.
8. Sistem men-generate JWT Access Token (klaim berisi `user_id`, `role`, `company_scope[]`, `group_id`) + Refresh Token.
9. **[Jika user memiliki akses ke >1 Company]** → tampilkan *Company Switcher* agar pengguna memilih konteks company aktif untuk sesi tersebut (dapat diganti kapan saja tanpa logout ulang).
10. Sistem mencatat event LOGIN ke Audit Log (user, IP, device, waktu, status).
11. Pengguna diarahkan ke Dashboard sesuai role & company aktif.

**Alur Alternatif/Pengecualian:**
- Password salah 5x berturut-turut → akun terkunci otomatis 15 menit; setiap percobaan tercatat di Audit Log dengan status Failed.
- Refresh token kedaluwarsa/di-blacklist (setelah logout) → pengguna dipaksa login ulang.
- Lupa password → alur terpisah: request reset → email berisi link/OTP (kedaluwarsa 15 menit) → set password baru → seluruh sesi aktif lain di-invalidate demi keamanan.

**Titik Keputusan & Validasi Kunci:**
- Lockout setelah 5 kali gagal (PRD §6.1.2).
- Password minimal 8 karakter kombinasi huruf besar/kecil, angka, simbol.
- Setiap login/logout wajib tercatat di Audit Log (§6.13).

**Integrasi Modul Lain:** Audit Log (setiap event auth); Notification (alert percobaan login gagal berulang, opsional); seluruh modul lain bergantung pada token yang dihasilkan di sini untuk otorisasi tiap request.

**Dampak Company Group:**
- JWT membawa klaim `company_scope[]` (daftar `company_id` yang boleh diakses) dan `group_id`, bukan hanya satu `company_id` — ini menjadi dasar filter row-level security di seluruh modul lain.
- *Company Switcher* adalah elemen UI baru di top navigation (khusus pengguna dengan akses lintas company seperti Group Super Admin/Group HR Director) — mengganti company aktif tidak memerlukan login ulang, hanya menukar konteks scope pada sesi yang sama.
- SSO (Google/Azure AD/LDAP, lihat §4.12 Integration Hub) dapat dikonfigurasi di level **Group** (satu identity provider untuk seluruh anak usaha) atau di level **Company** (anak usaha tertentu pakai IdP berbeda, misal hasil akuisisi yang belum migrasi sistem).

---

### 3.2 Module Master Employee

**Tujuan:** Menjadi single source of truth data karyawan — identitas, kepegawaian, dan data penggajian dasar.

**Aktor & Trigger:** HR Staff/HR Manager (create/update), Karyawan (self-view), Super Admin (full akses); dipicu saat onboarding karyawan baru, perubahan data, atau permintaan lihat profil.

**Alur Utama (Tambah Karyawan Baru — manual, di luar alur Recruitment):**
1. HR Staff membuka form "Tambah Karyawan", memilih **Company** terlebih dahulu (lihat Dampak Company Group) — pilihan Department/Position selanjutnya hanya menampilkan unit milik company tersebut.
2. HR Staff mengisi Data Pribadi (nama, tanggal lahir, KTP, NPWP, alamat, kontak) dan Data Kepegawaian (departemen, jabatan, status, tanggal mulai, atasan langsung, lokasi kerja, shift default).
3. Sistem men-generate NIK otomatis sesuai format konfigurabel **per Company** (karena setiap company biasanya punya format penomoran NIK berbeda, mis. prefix kode company).
4. HR Staff mengunggah dokumen wajib (KTP, NPWP, ijazah) — tersimpan ke Document Management System (§4.11) dengan kepemilikan (`owner_id`) karyawan tersebut.
5. HR Staff mengisi Data Penggajian dasar (gaji pokok, rekening bank, no. BPJS) — perubahan pada field ini di masa depan **memerlukan approval HR Manager** (lihat Validasi Kunci).
6. Sistem memvalidasi keunikan NIK & email perusahaan.
7. Sistem menyimpan record karyawan dengan status awal (Probasi/Kontrak/Tetap sesuai kebijakan).
8. Sistem otomatis membuat akun `users` terkait (untuk login) dan mengirim kredensial awal via email.
9. Sistem memicu Notification ke IT/GA untuk persiapan akses & perangkat (jika terintegrasi dengan Onboarding Checklist §4.2).
10. Audit Log mencatat aksi CREATE pada entity Employee.

**Alur Alternatif/Pengecualian:**
- Import massal via Excel/CSV → sistem memvalidasi setiap baris (format, duplikasi NIK/email), baris gagal ditampilkan dalam laporan error tanpa membatalkan baris yang valid.
- Karyawan resign/PHK → bukan delete, melainkan soft-delete (status berubah, `deleted_at` terisi secara logis namun riwayat tetap tersimpan) — lihat keterkaitan dengan §4.2 Offboarding yang menjadi prasyarat sebelum status berubah final.
- Perubahan data sensitif (gaji, rekening) → masuk status "Pending Approval", tidak langsung berubah; menunggu approval HR Manager melalui Workflow Engine (§4.10).

**Titik Keputusan & Validasi Kunci:**
- NIK unik dan tidak dapat diubah setelah dikonfirmasi (PRD §6.2.3).
- Perubahan data sensitif wajib approval HR Manager.
- Riwayat setiap perubahan data tercatat otomatis (audit trail per-field, tidak hanya log umum).

**Integrasi Modul Lain:** Organization Structure (referensi Department/Position/Branch), Document Management System (dokumen karyawan), Payroll (data gaji dasar), Attendance & Leave (NIK sebagai kunci), Onboarding (§4.2), Audit Log.

**Dampak Company Group:**
- Field `company_id` menjadi **wajib diisi pertama** sebelum field lain dapat dipilih (Department/Position/Branch difilter berdasarkan company terpilih) — mencegah salah tautan data lintas company secara tidak sengaja.
- Pencarian/list karyawan di level **Group Super Admin/Group HR** menampilkan kolom tambahan "Company" dan filter "Semua Company dalam Grup" vs "Company tertentu".
- Saat karyawan dipindah company (Transfer/Secondment, lihat §2.5.1), Master Employee menampilkan **riwayat penugasan lintas company** sebagai tambahan dari riwayat mutasi internal (jabatan/departemen) yang sudah ada di PRD §6.2.1.
- Format NIK auto-generate mempertimbangkan kode company sebagai prefix agar NIK tetap unik secara global meski penomoran berjalan independen per company.

---

### 3.3 Module Organization Structure (termasuk Company Group)

**Tujuan:** Mendefinisikan struktur formal organisasi — dari level grup hingga jabatan individual — sebagai rujukan seluruh modul lain.

**Aktor & Trigger:** Super Admin/Group Super Admin (struktur level grup & company baru), HR Manager (struktur di bawah company: divisi/departemen/jabatan); dipicu saat pembentukan perusahaan baru, restrukturisasi organisasi, atau ekspansi grup usaha (akuisisi/pendirian anak usaha baru).

**Alur Utama (Onboarding Company Baru ke dalam Group):**
1. Group Super Admin membuka menu "Company Group" → "Tambah Company".
2. Sistem menanyakan: company baru ini berdiri sendiri, atau bagian dari Company Group yang sudah ada/baru?
3. **[Jika bagian dari grup]** → pilih Company Group existing, atau buat Company Group baru (nama, kode, NPWP holding).
4. Group Super Admin mengisi profil Company baru: nama legal, NPWP, alamat, logo, bidang usaha.
5. Sistem membuat struktur dasar kosong (siap diisi Division/Department) dan **menyalin (clone, opsional)** beberapa konfigurasi dari Company lain dalam grup untuk akselerasi setup: template salary component, leave type, kalender libur nasional dasar, policy group-wide.
6. HR Manager Company baru melanjutkan dengan membuat Division → Department → Sub-Department → Position sesuai kebutuhan, mengikuti hierarki standar PRD §6.3.2.
7. HR Manager menentukan **Kepala Unit/PIC** tiap departemen.
8. Sistem memvalidasi tidak ada *circular reporting* (karyawan tidak boleh melapor ke dirinya sendiri secara langsung/tidak langsung).
9. Org Chart interaktif ter-generate otomatis dari struktur yang diinput, dapat ditampilkan dalam mode **Group View** (seluruh company sebagai node teratas) maupun **Company View** (struktur satu company saja).
10. Setiap perubahan struktur tercatat di riwayat (PRD §6.3.1) dan Audit Log.

**Alur Alternatif/Pengecualian:**
- Restrukturisasi (merge/split departemen) → karyawan yang berada di unit yang dihapus wajib dipindahkan terlebih dahulu (validasi: tidak ada unit organisasi yang dapat dihapus selama masih memiliki karyawan aktif).
- Company keluar dari grup (divestasi) → `group_id` pada company tersebut diset NULL; riwayat historis (payroll, attendance, dst. sebelum tanggal divestasi) tetap tersimpan utuh, namun company tersebut berhenti muncul di laporan konsolidasi grup setelah tanggal efektif.

**Titik Keputusan & Validasi Kunci:**
- Hierarki wajib: Company Group → Company → Division → Department → Sub-Department → Position (PRD §6.3.2, diperluas dengan level Company Group).
- Tidak ada unit yang dapat dihapus jika masih memiliki karyawan aktif atau struktur anak di bawahnya.

**Integrasi Modul Lain:** Master Employee (penempatan karyawan), seluruh modul yang menggunakan Department/Position sebagai filter atau referensi (Shift, Payroll, Performance, Recruitment, dsb.), Dashboard (Org Chart widget), Workforce Planning (manpower plan per departemen).

**Dampak Company Group:**
- Ini adalah modul **inti** tempat konsep Company Group secara formal didefinisikan — lihat detail lengkap di Bagian 2.
- Org Chart mendukung dua mode tampilan: **Group View** (menampilkan seluruh Company sebagai cabang dari node Group, masing-masing dapat di-collapse/expand) dan **Company View** (drill-down ke satu company).
- Penugasan Kepala Unit/PIC di level **Company** terpisah dari penugasan **Group HR Director/Group Finance Director** yang beroperasi di level Group dan tidak terikat pada satu struktur Company manapun.

---

### 3.4 Module Shift Management

**Tujuan:** Mendefinisikan pola jam kerja dan menjadwalkan shift karyawan, menjadi rujukan deteksi keterlambatan & lembur pada modul Attendance.

**Aktor & Trigger:** HR Staff/HR Manager (konfigurasi & penjadwalan), Manager (approval perubahan shift), Karyawan (lihat jadwal sendiri); dipicu saat penyusunan jadwal mingguan/bulanan atau perubahan kebijakan jam kerja.

**Alur Utama (Penjadwalan Shift Bulanan):**
1. HR Staff memilih **Company** & Departemen yang akan dijadwalkan (untuk Group Super Admin, dapat memilih lintas company namun proses tetap dieksekusi per company karena tipe shift dapat berbeda per company/lokasi).
2. HR Staff memilih template shift yang sudah dikonfigurasi (Fixed/Flexi/Rotating/Split) — lihat PRD §6.4.2.
3. HR Staff melakukan *bulk assignment* shift ke grup/departemen, atau **copy jadwal** dari bulan sebelumnya sebagai starting point.
4. Sistem mengecek terhadap Work Calendar (§3.5): tidak membuat jadwal shift pada hari yang dikategorikan NH/CH, kecuali ada pengajuan kerja di hari libur (OT) yang sudah disetujui.
5. Sistem memvalidasi setiap karyawan memiliki **tepat satu shift aktif** per hari (tidak boleh tumpang tindih).
6. HR Staff menyimpan & mempublikasikan jadwal; Notification otomatis terkirim ke karyawan terdampak jika ada perubahan dari jadwal sebelumnya.
7. Karyawan dapat melihat jadwalnya di Dashboard/Mobile App.

**Alur Alternatif/Pengecualian:**
- Perubahan shift pada jadwal yang sudah berjalan (live) → wajib melalui approval Manager (PRD §6.4.3), tidak dapat diubah sepihak oleh HR Staff setelah periode dimulai.
- Permintaan tukar shift antar karyawan (Penggantian Shift, lihat §3.8 Self Service) → memicu validasi ulang terhadap batas jam kerja maksimum & hari libur sebelum disetujui.

**Titik Keputusan & Validasi Kunci:**
- Setiap karyawan harus memiliki shift aktif (PRD §6.4.3).
- Toleransi keterlambatan terkonfigurasi per shift (grace period).
- Sistem otomatis mendeteksi lembur jika jam kerja melebihi batas shift.

**Integrasi Modul Lain:** Work Calendar (penentuan hari kerja vs libur), Attendance (rujukan jam masuk/keluar standar), Payroll (basis hitung lembur), Notification (perubahan jadwal).

**Dampak Company Group:**
- Konfigurasi shift (jam masuk/keluar, toleransi, tipe shift) bersifat **per Company** secara default karena kebijakan jam kerja sering berbeda antar anak usaha (mis. anak usaha manufaktur 3-shift vs anak usaha kantor pusat 1-shift).
- HR Group dapat membuat **template shift di level Group** yang kemudian di-*clone* dan disesuaikan oleh masing-masing Company — mempercepat setup company baru tanpa memaksakan keseragaman penuh.
- Bulk assignment lintas company dalam satu aksi **tidak diizinkan** (untuk mencegah kesalahan), proses tetap dijalankan company-per-company meski dimulai dari satu layar yang sama bagi Group Super Admin.

---

### 3.5 Module Work Calendar

**Tujuan:** Menjadi acuan tunggal hari kerja, hari libur, dan tipe hari bagi Attendance, Leave, Payroll, dan Dashboard (PRD §6.5.1).

**Aktor & Trigger:** HR Manager/HR Staff (konfigurasi kalender), sistem (cron job impor libur nasional tahunan); dipicu saat persiapan kalender tahun/bulan baru atau penetapan hari libur khusus.

**Alur Utama (Setup Kalender Tahun Baru):**
1. Setiap awal tahun, cron job otomatis mengimpor hari libur nasional Indonesia ke tabel `national_holidays` (referensi bersama, tidak terikat company manapun — karena hari libur nasional sama untuk seluruh Indonesia).
2. HR Manager **Company** tertentu membuka Work Calendar, memilih untuk **mewarisi** kalender dari Company Group (jika HR Group sudah menyiapkan template) atau membuat dari awal.
3. Sistem menerapkan hierarki kalender sesuai PRD §6.5.4, **diperluas dengan satu level di atas Company**:
   ```
   Level 0: Company Group Calendar (opsional, default tertinggi untuk seluruh grup)
     ↓ override jika ada
   Level 1: Company Calendar
     ↓ override jika ada
   Level 2: Branch Calendar
     ↓ override jika ada
   Level 3: Department Calendar
     ↓ override jika ada
   Level 4: Employee Calendar (individual)
   ```
4. HR Manager menambahkan hari libur khusus perusahaan (ulang tahun perusahaan, dsb.) dan menandai cuti bersama pemerintah.
5. HR Manager mengatur hari kerja default per minggu (5 hari/6 hari) — dapat berbeda per Company dalam grup yang sama (mis. anak usaha ritel 6 hari kerja vs kantor pusat 5 hari kerja).
6. Sistem mem-validasi: kalender wajib dikonfigurasi minimal untuk hari libur nasional setahun penuh sebelum periode payroll pertama tahun tersebut dapat dibuka.
7. HR/Manager dapat melihat **kalender tim** (overlay kehadiran + cuti approved) dan **highlight konflik** (banyak karyawan cuti bersamaan).
8. Notification H-7 otomatis terkirim ke HR jika kalender bulan mendatang belum dikonfigurasi.

**Alur Alternatif/Pengecualian:**
- Perubahan kalender yang berdampak pada data absensi yang sudah ada → memerlukan konfirmasi eksplisit dan tercatat di Audit Log (PRD §6.5.7).
- Kalender yang sudah dipakai dalam periode payroll yang difinalisasi → terkunci, tidak dapat diubah.

**Titik Keputusan & Validasi Kunci:**
- Jika tidak ada kalender khusus di level bawah, sistem menggunakan kalender level di atasnya sebagai default (kini termasuk Company Group sebagai level tertinggi).
- Hari kerja lembur (OT) di hari libur wajib melalui pengajuan & approval.

**Integrasi Modul Lain:** Shift Management, Attendance, Leave Management, Payroll (hari kerja efektif), Dashboard (widget progres kehadiran & heatmap), Notification.

**Dampak Company Group:**
- **Level hierarki baru ditambahkan di atas Company**, sehingga HR Group dapat menetapkan kalender dasar (terutama hari libur nasional & cuti bersama yang memang berlaku nasional) yang otomatis diwariskan ke seluruh Company, sementara setiap Company tetap bebas menambah hari libur spesifiknya sendiri.
- Dashboard tingkat Group dapat menampilkan **kalender konsolidasi** yang menyoroti hari-hari berisiko (misal banyak company dalam grup yang sama-sama mengambil cuti bersama sehingga operasional grup terdampak luas).

---

### 3.6 Module Attendance

**Tujuan:** Mencatat dan memvalidasi kehadiran karyawan harian melalui berbagai metode, menjadi basis perhitungan payroll & evaluasi kedisiplinan.

**Aktor & Trigger:** Karyawan (clock in/out via mobile/QR/face recognition), HR Staff (koreksi manual); dipicu setiap hari kerja sesuai jadwal shift karyawan.

**Alur Utama (Clock In/Out via Mobile):**
1. Karyawan membuka mobile app pada jam kerja, menekan tombol "Clock In".
2. Aplikasi mengambil lokasi GPS perangkat.
3. **[Jika selfie wajib diaktifkan]** → aplikasi meminta foto selfie singkat.
4. Aplikasi mengirim data (waktu, lokasi, foto) ke server.
5. Sistem memvalidasi lokasi terhadap radius geofencing **Branch** tempat karyawan ditugaskan (PRD §6.6.1) — radius dikonfigurasi per branch.
6. Sistem mengecek terhadap Work Calendar: jika hari tersebut bukan hari kerja (libur), sistem menandai sebagai kehadiran di luar jadwal (perlu kategori "Lembur Hari Libur" bila disengaja, bukan dianggap kehadiran normal).
7. Sistem membandingkan waktu clock-in dengan jam mulai shift + toleransi → menentukan status Hadir (H) atau Terlambat (T).
8. Record attendance tersimpan; status tampil real-time di Dashboard karyawan & Manager.
9. Proses serupa terjadi saat Clock Out, dengan tambahan deteksi otomatis Lembur (L) jika clock-out melewati jam shift + toleransi, dan Pulang Lebih Cepat (PL) jika sebelum jam selesai.
10. Jika karyawan tidak melakukan clock-in sampai batas waktu tertentu, sistem otomatis menandai status Absen (A) — kecuali hari tersebut tercatat sebagai libur/cuti/izin yang sudah disetujui di Work Calendar/Leave Management.

**Alur Alternatif/Pengecualian:**
- Mode offline (mobile tidak ada koneksi) → data tersimpan lokal di perangkat, disinkronkan otomatis saat koneksi tersedia; jika terjadi konflik data (misal jam server vs jam lokal berbeda), **server-side wins** (PRD §13 Risk Mitigation).
- Lokasi di luar radius geofencing → clock-in tetap dapat disubmit namun ditandai "Perlu Review", memicu Notification ke HR untuk verifikasi manual (bukan otomatis ditolak, demi mengakomodasi kasus dinas luar/WFH yang sah).
- Koreksi absensi oleh HR (lupa absen, device error) → wajib alasan tertulis + bukti pendukung, melalui Workflow Engine approval atasan.

**Titik Keputusan & Validasi Kunci:**
- Sistem tidak membuat record "Absen" pada hari yang dikategorikan libur di Work Calendar.
- Rekap bulanan dikunci setelah tanggal cutoff payroll.

**Integrasi Modul Lain:** Work Calendar (penentuan hari wajib hadir), Shift Management (jam rujukan), Leave Management (status Cuti/Izin meniadakan status Absen), Payroll (basis tunjangan kehadiran & potongan), Notification (alert clock-in belum dilakukan), Self Service (koreksi absensi).

**Dampak Company Group:**
- Radius geofencing & metode absensi (GPS/QR/Face Recognition) dikonfigurasi **per Branch**, yang otomatis berarti **per Company** — tidak ada perubahan alur inti karena konfigurasi sudah granular di level branch.
- Untuk karyawan dengan status **Secondment** (bekerja sementara di Company lain dalam grup, lihat §2.5.1), sistem mengarahkan validasi geofencing ke Branch **tempat penugasan sementara berlaku**, bukan branch asal — dan rekap kehadirannya tetap terhubung ke profil karyawan tunggal sehingga tidak terpecah datanya.
- Dashboard kehadiran tingkat Group menampilkan agregasi tingkat kehadiran lintas Company tanpa membuka detail individu, berguna untuk benchmarking antar anak usaha.

---

### 3.7 Module Leave Management

**Tujuan:** Mengelola jenis cuti, saldo, pengajuan, dan persetujuan cuti karyawan sesuai aturan internal dan regulasi ketenagakerjaan.

**Aktor & Trigger:** Karyawan (mengajukan), Manager/HR Manager (menyetujui), HR Staff (konfigurasi jenis cuti & saldo awal); dipicu saat karyawan membutuhkan waktu istirahat/izin atau saat awal tahun (alokasi saldo cuti tahunan).

**Alur Utama (Pengajuan Cuti):**
1. Karyawan membuka menu Leave Management, melihat saldo cuti yang tersisa per jenis.
2. Karyawan memilih jenis cuti, tanggal mulai & selesai, mengisi alasan.
3. Sistem menghitung **hari kerja** (bukan hari kalender) dalam rentang tersebut berdasarkan Work Calendar — hari libur nasional & weekend dalam periode cuti tidak dihitung sebagai hari cuti (PRD §6.7.3).
4. Sistem memvalidasi: saldo cuti cukup (kecuali jenis cuti tertentu seperti sakit), pengajuan minimal H-3 (konfigurabel), dan **tanggal yang diajukan tidak jatuh pada hari libur nasional** (jika seluruh rentang adalah hari libur, pengajuan ditolak otomatis).
5. Sistem melihat Kalender Tim agar karyawan dapat mengecek lebih dulu apakah rekan setim sudah banyak yang cuti pada periode tersebut (mencegah konflik, ditampilkan sebagai peringatan non-blocking).
6. Pengajuan masuk ke Workflow Engine: Manager → (jika perlu) HR Manager.
7. Approver menerima Notification, meninjau, menyetujui atau menolak (dengan alasan wajib jika ditolak).
8. **[Jika disetujui]** → saldo cuti otomatis berkurang, status di Work Calendar & Attendance untuk tanggal tersebut otomatis menjadi "Cuti (C)" sehingga tidak tertandai Absen.
9. **[Jika ditolak]** → saldo tidak berubah, karyawan dapat mengajukan ulang dengan tanggal berbeda.
10. Notification status terkirim ke karyawan; kalender tim ter-update.

**Alur Alternatif/Pengecualian:**
- Pembatalan cuti (oleh karyawan sebelum tanggal mulai, atau oleh HR) → saldo dikembalikan otomatis.
- Carry-over saldo cuti tahunan ke tahun berikutnya → dijalankan otomatis di akhir tahun, dibatasi maksimal N hari sesuai konfigurasi.
- Cuti proporsional untuk karyawan baru (<1 tahun masa kerja) → dihitung otomatis berdasarkan bulan berjalan.

**Titik Keputusan & Validasi Kunci:**
- Kalkulasi hari cuti mengacu Work Calendar.
- Pengajuan cuti di hari libur nasional ditolak otomatis.
- Cuti tidak dapat diajukan jika saldo tidak cukup (kecuali jenis tertentu).

**Integrasi Modul Lain:** Work Calendar (kalkulasi hari kerja), Attendance (status hari menjadi Cuti, bukan Absen), Self Service Request (kanal pengajuan), Workflow Engine (approval chain), Payroll (cuti tanpa gaji memotong komponen gaji), Notification, Dashboard (Leave Statistics widget).

**Dampak Company Group:**
- Jenis cuti (`leave_types`) dan kuota default dapat ditetapkan di level **Company Group** sebagai baseline kepatuhan regulasi (cuti tahunan 12 hari, cuti melahirkan 3 bulan, dst. sesuai UU Ketenagakerjaan yang berlaku nasional), namun setiap **Company** dapat menambah jenis cuti spesifik (misal cuti adat/budaya lokal untuk anak usaha di daerah tertentu) tanpa mengubah baseline grup.
- Untuk karyawan **Secondment** lintas company, saldo cuti tetap mengikuti Company **asal** (Primary assignment) — pengajuan cuti tetap melalui satu sumber saldo agar tidak terjadi duplikasi/penyalahgunaan kuota di dua company sekaligus.
- Kalender Tim yang ditampilkan untuk Manager di Company tertentu **tidak otomatis** menampilkan tim di Company lain, kecuali Manager tersebut memang memiliki span-of-control lintas company (jarang, namun didukung melalui `user_company_access`).

---

### 3.8 Module Self Service Request

**Tujuan:** Menjadi kanal terpadu bagi karyawan untuk mengajukan berbagai jenis permintaan (izin, koreksi absensi, lembur, tukar shift, permohonan dokumen) tanpa harus mendatangi HR secara fisik.

**Aktor & Trigger:** Karyawan (mengajukan), Atasan Langsung & HR (menyetujui); dipicu oleh kebutuhan administratif harian karyawan.

**Alur Utama:**
1. Karyawan membuka menu Self Service (web/mobile), memilih tipe request (Izin/Sakit/On Duty/Koreksi Absensi/Lembur/Tukar Shift/Permohonan Dokumen).
2. Karyawan mengisi tanggal/waktu yang dimaksud, alasan, dan dokumen pendukung (maks. 5MB per file) bila diperlukan (mis. surat dokter untuk Sakit).
3. Sistem memvalidasi terhadap Work Calendar — misal pengajuan izin di hari yang sudah libur akan diberi peringatan ("hari ini sudah libur, tidak perlu mengajukan izin").
4. Sistem mengirim request ke Workflow Engine, yang menentukan approval chain sesuai tipe request (default: Atasan Langsung → HR jika diperlukan).
5. Approver menerima Notification, dapat melihat detail lengkap + dokumen pendukung sebelum memutuskan.
6. Approver menyetujui/menolak; jika ditolak, alasan wajib diisi.
7. **[Disetujui]** → sistem otomatis memperbarui modul terkait: Attendance (jika koreksi absensi/izin), Leave Management (jika cuti), Shift Management (jika tukar shift), atau memicu generate dokumen (jika permohonan slip gaji/surat keterangan kerja).
8. Karyawan menerima Notification status, dapat melihat riwayat lengkap seluruh request miliknya dengan status (Draft/Pending/Approved/Rejected/Cancelled).

**Alur Alternatif/Pengecualian:**
- Request tidak diproses melebihi SLA (default 3 hari) → Notification eskalasi otomatis terkirim, dan melalui Workflow Engine dapat di-reassign ke backup approver bila approver utama sedang cuti/tidak aktif.
- Request yang sudah diproses (Approved/Rejected) tidak dapat diedit oleh karyawan — hanya dapat diajukan ulang sebagai request baru.
- Approver dapat mendelegasikan approval-nya secara sementara (misal saat cuti) kepada approver pengganti yang dikonfigurasi sebelumnya.

**Titik Keputusan & Validasi Kunci:**
- Request lembur diajukan minimal 1 hari sebelumnya (atau sesuai kebijakan).
- Pengajuan izin/koreksi divalidasi terhadap Work Calendar.

**Integrasi Modul Lain:** Attendance, Leave Management, Shift Management, Payroll (slip gaji/surat keterangan), Workflow Engine (mesin approval), Notification, Work Calendar (kalender tim sebagai referensi sebelum mengajukan).

**Dampak Company Group:**
- Approval chain default tetap mengikuti struktur **Company** karyawan (Atasan Langsung & HR Manager Company yang sama) — tidak otomatis melibatkan pihak Company lain.
- Untuk karyawan **Secondment**, sistem menampilkan dua kemungkinan approver: Atasan di Company asal (untuk hal terkait status kepegawaian/payroll) dan Atasan di Company tujuan (untuk hal operasional harian seperti izin/lembur selama periode penugasan) — ditentukan saat assignment dibuat di §2.5.1, agar karyawan tidak bingung harus mengajukan ke siapa.
- Permohonan dokumen (surat keterangan kerja, dsb.) otomatis menggunakan kop surat & data legal **Company** tempat karyawan tercatat aktif (Primary assignment), bukan Company Group, karena dokumen resmi bersifat per badan hukum.

---

### 3.9 Module Payroll

**Tujuan:** Menjalankan proses penggajian bulanan secara otomatis dan akurat, termasuk kepatuhan pajak (PPh 21) dan BPJS, hingga distribusi slip gaji.

**Aktor & Trigger:** Finance/Payroll Admin (menjalankan & memproses), HR Manager (approval finalisasi), Karyawan (menerima slip); dipicu setiap periode penggajian (umumnya bulanan).

**Alur Utama (Payroll Run):**
1. Finance Admin membuka periode payroll untuk **satu Company** tertentu beserta bulan/tahun (payroll run **selalu dijalankan per Company**, lihat Dampak Company Group).
2. Sistem mengambil data yang diperlukan: jumlah hari kerja efektif dari Work Calendar, rekap absensi bulan berjalan, saldo cuti yang diambil, data lembur yang disetujui, dan data karyawan baru/resign untuk pro-rata.
3. Sistem menghitung otomatis seluruh komponen: Gaji Pokok (pro-rata jika perlu), Tunjangan (transport, makan, kehadiran berbasis rasio hadir/hari kerja efektif), Uang Lembur (rate 1.5×/2× sesuai jenis hari lembur), Potongan BPJS (JHT 2%, JP 1%, Kesehatan 1%), PPh 21 (metode nett/gross/gross-up sesuai kebijakan Company), dan potongan lain (pinjaman karyawan jika ada, lihat §4.6).
4. Sistem menghasilkan preview payroll per karyawan untuk ditinjau Finance Admin.
5. Finance Admin meninjau, melakukan revisi jika ada ketidaksesuaian (misal data lembur yang belum tercatat), lalu mengirim untuk approval HR Manager.
6. HR Manager meninjau ringkasan (total gross, total deduction, net, perbandingan dengan bulan lalu) dan menyetujui finalisasi.
7. Setelah final, sistem men-generate slip gaji digital (PDF) per karyawan, mengunci periode (tidak dapat diedit lagi), dan men-generate file transfer bank (CSV) sesuai format bank.
8. Slip gaji didistribusikan otomatis ke masing-masing karyawan (notifikasi + dapat diunduh dari Self Service/Mobile App).
9. Laporan turunan (Summary Payroll, Rekap PPh 21/SPT Masa, Rekap BPJS) dapat diekspor oleh Finance.

**Alur Alternatif/Pengecualian:**
- Data tidak lengkap (misal Work Calendar belum dikonfigurasi untuk bulan tersebut) → sistem memblokir pembukaan periode payroll dan menampilkan validasi yang harus dilengkapi dahulu.
- Revisi setelah finalisasi → tidak diperbolehkan pada periode yang sama; koreksi dilakukan sebagai penyesuaian (adjustment) pada periode berikutnya.

**Titik Keputusan & Validasi Kunci:**
- Payroll hanya dapat difinalisasi oleh Finance Admin + disetujui HR Manager.
- Pro-rata gaji & tunjangan kehadiran dihitung dari hari kerja efektif Work Calendar, bukan hari kalender.
- Lembur di hari libur nasional dihitung 2×, hari libur perusahaan 1.5×.

**Integrasi Modul Lain:** Work Calendar (hari kerja efektif), Attendance (rekap kehadiran & lembur), Leave Management (cuti tanpa gaji), Employee Loan (potongan cicilan, §4.6), Compensation & Benefit (struktur gaji & THR, §4.5), Document Management System (slip gaji tersimpan), Audit Log, Dashboard (biaya payroll bulan berjalan).

**Dampak Company Group:**
- **Payroll run selalu dieksekusi terpisah per Company** — ini adalah batasan legal yang tidak dapat dilonggarkan, karena setiap Company adalah wajib pajak (PPh 21) dan pemberi kerja BPJS yang berbeda secara hukum.
- Group Super Admin/Group Finance Director **tidak menjalankan** payroll run lintas company dalam satu aksi; mereka hanya memiliki **dashboard agregasi pasca-finalisasi** yang merangkum total biaya payroll seluruh Company dalam grup (lihat §3.11) — tanpa kemampuan mengubah data payroll Company manapun secara langsung dari level Group.
- Karyawan **Secondment** (bekerja sementara di Company B, gaji dibayar Company A) → payroll tetap diproses di Company A; sistem mencatat baris **cross-charge/cost allocation** pada laporan biaya Company B sebagai estimasi beban yang "dipinjamkan", namun ini bersifat informasi akuntansi manajerial, bukan transaksi payroll resmi.
- Format file transfer bank dan template slip gaji (kop surat, identitas perusahaan) mengikuti identitas **Company**, bukan Company Group.

---

### 3.10 Module Performance Management

**Tujuan:** Mengelola siklus KPI dan appraisal kinerja karyawan, menjadi salah satu input untuk kenaikan gaji, promosi, dan talent management.

**Aktor & Trigger:** HR (membuka siklus), Karyawan (self-assessment & realisasi KPI), Atasan (menilai), HR (kalibrasi); dipicu sesuai siklus appraisal (semesteran/tahunan) atau periode KPI (bulanan/kuartalan).

**Alur Utama (Siklus Appraisal):**
1. HR membuka siklus appraisal baru, menentukan periode (semesteran/tahunan), deadline tiap tahap, dan jenis (self-only / dengan atasan / 360°).
2. Sistem mengirim Notification ke seluruh karyawan target untuk mengisi self-assessment (termasuk input realisasi KPI dari template yang sudah di-assign).
3. Karyawan mengisi self-assessment dan realisasi KPI sebelum deadline; sistem menghitung skor KPI otomatis berdasarkan formula (% achievement terhadap target × bobot).
4. Atasan Langsung mengisi penilaian (validasi KPI + kompetensi soft/hard skill).
5. **[Jika 360°]** → Peer Review tambahan dari rekan kerja yang ditentukan.
6. **[Opsional]** → HR melakukan kalibrasi nilai antar departemen agar distribusi rating wajar (mencegah bias penilai tertentu terlalu longgar/ketat).
7. Atasan memfinalisasi rating akhir (Outstanding/Exceed/Meet/Below/Poor).
8. Karyawan melakukan diskusi & memberikan acknowledgement terhadap hasil — setelah acknowledgement, nilai **tidak dapat diubah lagi**.
9. Hasil appraisal terkunci, laporan ter-generate, dan rating "Poor" otomatis memicu Notification ke HR untuk tindak lanjut (PIP/pembinaan, dapat terhubung ke §4.14 Disciplinary Action bila relevan).
10. Hasil dapat menjadi input ke Compensation & Benefit (§4.5) untuk salary review/merit increase periode berikutnya, dan ke Talent & Succession Planning (§4.8) untuk penentuan HIPO.

**Alur Alternatif/Pengecualian:**
- Karyawan tidak mengisi self-assessment sebelum deadline → sistem dapat mengizinkan Atasan melanjutkan penilaian dengan catatan "self-assessment tidak diisi", atau memblokir sesuai kebijakan HR.

**Titik Keputusan & Validasi Kunci:**
- Nilai akhir tidak dapat diubah setelah acknowledgement karyawan.
- Rating Poor otomatis memicu notifikasi tindak lanjut HR.

**Integrasi Modul Lain:** LMS (skor assessment/completion sebagai salah satu input penilaian), Compensation & Benefit (dasar salary review), Talent & Succession Planning (penentuan HIPO & 9 Box), Notification, Dashboard (KPI tracking widget).

**Dampak Company Group:**
- Template KPI & siklus appraisal dikonfigurasi **per Company** (karena KPI sangat terikat pada posisi/departemen spesifik tiap company), namun HR Group dapat menetapkan **kerangka kompetensi inti grup** (core values/competencies) yang wajib menjadi bagian dari formulir penilaian di seluruh Company — memastikan konsistensi budaya kerja lintas anak usaha sambil tetap fleksibel pada KPI operasional masing-masing.
- Kalibrasi nilai dapat dilakukan di dua level: kalibrasi **antar departemen dalam satu Company** (standar) atau kalibrasi **antar Company dalam satu Group** untuk posisi setara (opsional, biasa dipakai grup usaha besar untuk menjaga keadilan rating Direktur/GM antar anak usaha sebelum proses promosi/talent review tingkat grup).

---

### 3.11 Module Dashboard & Reporting

**Tujuan:** Menyajikan ringkasan data operasional HR secara real-time sesuai peran pengguna, serta menghasilkan laporan terstruktur untuk kebutuhan manajemen & kepatuhan.

**Aktor & Trigger:** Seluruh role (tampilan berbeda sesuai role); dipicu saat pengguna login/membuka halaman utama, atau saat menjadwalkan/mengekspor laporan.

**Alur Utama (Render Dashboard):**
1. Pengguna login dan diarahkan ke Dashboard sesuai role (Super Admin/HR Manager, Manager, atau Employee — lihat PRD §6.11.1).
2. **[Jika pengguna memiliki akses lintas Company]** → sistem menampilkan toggle "Group View" vs "Company View" di bagian atas dashboard (lihat Dampak Company Group); pilihan ini menentukan scope query seluruh widget di bawahnya.
3. Sistem menjalankan agregasi data dari berbagai modul (Master Employee, Attendance, Leave, Payroll, dst.) terbatas pada scope company yang aktif.
4. Widget dirender: Total Karyawan, grafik kehadiran hari ini, distribusi departemen, tren bulanan, pengajuan pending, top pengambil cuti, kalender heatmap, notifikasi kontrak/ulang tahun akan berakhir.
5. Pengguna dapat melakukan drill-down dari satu widget ke modul detail terkait (misal klik "Pengajuan Pending" langsung membuka Approval Queue).
6. Untuk laporan terjadwal/on-demand (Excel/PDF), pengguna memilih jenis laporan & filter periode, sistem men-generate file di background (job queue untuk laporan besar) dan mengirim notifikasi saat selesai.

**Alur Alternatif/Pengecualian:**
- Data terlalu besar untuk real-time render (misal laporan tahunan seluruh grup) → diproses sebagai background job, hasil dikirim via email/notifikasi link unduh, bukan ditampilkan langsung di browser.

**Titik Keputusan & Validasi Kunci:**
- Setiap widget tunduk pada filter row-level security `company_scope` milik pengguna (lihat §2.4) — tidak ada data company lain yang "menyelinap" masuk ke agregasi meski secara teknis berada dalam database yang sama.

**Integrasi Modul Lain:** Seluruh modul lain adalah sumber data bagi Dashboard & Reporting; modul ini tidak memiliki data primernya sendiri selain definisi widget & cache agregasi.

**Dampak Company Group:**
- Ini salah satu modul dengan **dampak paling signifikan**. Ditambahkan dashboard baru: **Group Executive Dashboard**, khusus dapat diakses Group Super Admin/Group HR Director/Group Finance Director, menampilkan:
  - Total headcount, hires, resign **per Company** dan totalnya di seluruh Group (perbandingan antar anak usaha dalam satu tampilan).
  - Biaya payroll bulan berjalan **per Company** dan agregat Group, beserta tren bulanan masing-masing.
  - Heatmap kehadiran **per Company** untuk benchmarking operasional.
  - Daftar kontrak akan berakhir, posisi kritikal tanpa successor, dan temuan compliance — digabung dari seluruh Company dalam satu antrian prioritas Group.
- Toggle **Group View / Company View** menjadi elemen navigasi standar di seluruh dashboard bagi pengguna dengan akses lintas company; default selalu **Company View** (scope tersempit) untuk mencegah kebocoran data tidak sengaja.
- Laporan ekspor (Excel/PDF) menyertakan kolom "Company" tambahan ketika di-generate dalam Group View, agar data tetap dapat ditelusuri asalnya meski ditampilkan konsolidasi.

---

### 3.12 Module Notification & Alert

**Tujuan:** Menyampaikan informasi penting secara tepat waktu ke pengguna yang relevan melalui in-app, push notification, dan email.

**Aktor & Trigger:** Sistem (otomatis berdasarkan event di modul lain); dipicu oleh berbagai event yang didefinisikan PRD §6.12.2 (pengajuan baru, approval, kontrak akan berakhir, dst.).

**Alur Utama:**
1. Event terjadi di modul manapun (misal: karyawan mengajukan cuti).
2. Modul asal memanggil Notification Service dengan payload (tipe event, penerima, referensi data).
3. Notification Service menentukan kanal pengiriman sesuai preferensi/role penerima yang dikonfigurasi: in-app saja, in-app + push, atau in-app + push + email (untuk event kritikal seperti payroll selesai diproses).
4. Notifikasi tersimpan di tabel `notifications` (status unread) dan dikirim real-time ke client yang aktif (web/mobile) via push channel.
5. Penerima melihat badge count bertambah, membuka daftar notifikasi, men-tap salah satu → deep-link langsung ke halaman terkait (misal langsung ke detail pengajuan cuti yang menunggu approval).
6. Notifikasi ditandai "read" otomatis saat dibuka, atau manual ditandai "read all".

**Alur Alternatif/Pengecualian:**
- Push notification gagal terkirim (device token tidak valid) → fallback ke in-app saja, dicatat di log integrasi untuk monitoring tanpa mengganggu pengalaman pengguna.

**Titik Keputusan & Validasi Kunci:**
- Setiap jenis notifikasi dapat diaktifkan/nonaktifkan per role melalui konfigurasi.

**Integrasi Modul Lain:** Seluruh modul HRMS adalah pemicu (trigger source); modul ini bersifat layanan lintas-modul (cross-cutting service), bukan modul dengan alur bisnis sendiri yang berdiri sendiri.

**Dampak Company Group:**
- Beberapa event baru ditambahkan khusus Company Group: *"Manpower request menunggu approval Group HR Director"*, *"Karyawan disetujui untuk mutasi/secondment ke Company lain"*, *"Kalender Group belum dikonfigurasi untuk Company baru"*, *"Temuan compliance di salah satu Company memerlukan perhatian Group"*.
- Penerima notifikasi untuk event-event tersebut secara default adalah peran **Group HR Director/Group Finance Director/Group Super Admin**, terlepas dari Company asal event — memastikan isu lintas company tidak "tersangkut" hanya di level satu anak usaha.

---

### 3.13 Module Audit Log

**Tujuan:** Mencatat seluruh aktivitas kritikal sistem secara permanen (append-only) untuk keperluan keamanan, kepatuhan, dan investigasi.

**Aktor & Trigger:** Sistem (otomatis mencatat setiap aksi kritikal dari modul manapun); Super Admin/Compliance (meninjau log).

**Alur Utama:**
1. Setiap aksi kritikal (CREATE/UPDATE/DELETE/LOGIN/LOGOUT/APPROVE/REJECT/EXPORT) yang terjadi di modul manapun memicu pencatatan otomatis ke Audit Log — termasuk timestamp, user, IP/device, modul, entity & ID, before/after value (untuk UPDATE), dan status.
2. Sistem menyimpan log sebagai **append-only** (tidak ada endpoint UPDATE/DELETE untuk tabel ini sama sekali pada level aplikasi maupun database, dijaga dengan permission DB yang membatasi hanya INSERT).
3. Super Admin/Compliance Officer dapat memfilter log berdasarkan user, modul, aksi, rentang tanggal, dan melakukan full-text search pada detail log.
4. Log dapat diekspor (Excel/CSV) untuk kebutuhan audit eksternal.
5. Retention policy mempertahankan log minimal 2 tahun (PRD §6.13.1); kebijakan retensi lebih lama dapat diterapkan untuk data terkait kepegawaian (5 tahun, sesuai PRD §11.4).

**Alur Alternatif/Pengecualian:**
- Tidak ada — sifat append-only berarti tidak ada "alur koreksi"; kesalahan dicatat sebagai entri baru, bukan mengubah entri lama.

**Titik Keputusan & Validasi Kunci:**
- Semua perubahan Work Calendar, akses data sensitif (gaji, rekening), dan proses payroll wajib di-log (PRD §6.13.3).

**Integrasi Modul Lain:** Menerima event dari seluruh modul; tidak mengirim data ke modul lain selain disajikan kembali melalui menu Audit Log itu sendiri dan referensi investigasi di Disciplinary Action (§4.14).

**Dampak Company Group:**
- Setiap entri log tetap menyertakan `company_id` aksi terjadi, sehingga **Group Super Admin** dapat meninjau log lintas seluruh Company, sementara **HR Manager/Compliance** di level Company hanya dapat melihat log milik company-nya sendiri (kecuali diberi akses lintas company).
- Aksi yang dilakukan oleh Group Super Admin **terhadap data milik Company tertentu** (misal mengubah konfigurasi integrasi suatu anak usaha) tetap tercatat dengan jelas menyebut identitas Group Super Admin tersebut sebagai pelaku — transparansi ini penting karena akses lintas company adalah privilese tinggi yang rawan disalahgunakan jika tidak terlacak.

---

## 4. Alur Sistem — Enterprise Extension Modules (6.14–6.28)

### 4.1 Module Recruitment & Applicant Tracking System (ATS)

**Tujuan:** Mengelola end-to-end proses rekrutmen, dari permintaan kebutuhan tenaga kerja hingga kandidat dikonversi menjadi karyawan aktif.

**Aktor & Trigger:** Dept Head (mengajukan manpower request), Recruiter/HR (mengelola lowongan & pipeline), Interviewer (memberi feedback), Kandidat (melamar & merespons offer); dipicu saat ada kebutuhan tenaga kerja baru.

**Alur Utama:**
1. Dept Head mengajukan Manpower Request: posisi, jumlah headcount, justifikasi, target tanggal onboard, estimasi budget — pada **Company** tempat posisi tersebut dibutuhkan.
2. Sistem memvalidasi requisition terhadap Manpower Plan & Budget yang tersedia di Workforce Planning (§4.15) untuk Company tersebut; jika di luar plan, ditandai perlu **over-budget approval**.
3. Requisition disetujui berjenjang: Dept Head → HR Manager → Finance.
4. Recruiter membuat Job Vacancy dari requisition yang disetujui, menentukan apakah dipublikasikan ke career portal saja, job board eksternal, atau **ditandai Group-Wide** (lihat Dampak Company Group).
5. Kandidat melamar; sistem mendeteksi duplikasi data kandidat (cek email/no. HP) untuk mencegah record ganda.
6. Kandidat berjalan melalui pipeline: **Applied → Screening → HR Interview → User Interview → Psychotest → Offering → Hired** (atau Rejected di stage manapun dengan alasan wajib).
7. Setiap sesi interview dijadwalkan dengan sinkronisasi ke Work Calendar (agar tidak terjadwal di hari libur), melibatkan panel multi-interviewer yang masing-masing memberi feedback (skor + rekomendasi).
8. Jika lolos ke Offering, sistem men-generate Offer Letter dari template, mengacu Salary Structure (§4.5) Company terkait; offer di luar range memerlukan approval tambahan dari Compensation Committee/Director.
9. Kandidat merespons offer (Accept/Negotiate/Decline); jika diterima, status menjadi Hired.
10. Recruiter melakukan konversi satu-klik: data kandidat (nama, kontak, dokumen) otomatis mengisi Master Employee (§3.2) pada **Company** yang sesuai dengan vacancy — menghindari input ulang manual.
11. Kandidat yang ditolak otomatis masuk Talent Pool dengan tag alasan penolakan untuk pencarian di masa depan.

**Alur Alternatif/Pengecualian:**
- Vacancy ditutup (Closed) → tidak menerima aplikasi baru, namun riwayat aplikasi tetap tersimpan untuk referensi.
- Kandidat melamar ke beberapa posisi sekaligus → setiap aplikasi diproses independen dengan pipeline masing-masing, namun tetap merujuk satu profil kandidat yang sama.

**Titik Keputusan & Validasi Kunci:**
- Manpower request wajib disetujui sebelum vacancy dapat dipublikasikan.
- Setiap perpindahan stage tercatat di Audit Log.
- Offer melebihi salary range membutuhkan approval tambahan.

**Integrasi Modul Lain:** Workforce Planning (validasi budget), Work Calendar (penjadwalan interview), Document Management System (offer letter & e-sign), Compensation & Benefit (salary range), Master Employee (konversi hired→employee), Onboarding (§4.2, lanjutan setelah Hired), Integration Hub (publish ke job board eksternal).

**Dampak Company Group:**
- Vacancy dapat ditandai **Group-Wide**: kandidat yang melamar dipertimbangkan untuk penempatan di **Company manapun** dalam grup sesuai hasil interview — keputusan penempatan akhir (Company mana yang akan merekrut kandidat tersebut) ditentukan saat stage Offering, bukan di awal.
- **Talent Pool bersifat group-wide secara default** — kandidat yang ditolak oleh satu Company tetap dapat ditemukan & dipertimbangkan oleh Company lain dalam grup yang sama tanpa perlu melamar ulang dari nol.
- Approval requisition untuk headcount/budget besar dapat memerlukan persetujuan **Group HR Director/Group Finance Director** tambahan, di luar approval Company yang sudah ada, sesuai threshold yang dikonfigurasi di Workflow Engine.
- Konversi Hired→Employee tetap mengikat karyawan baru ke **satu Company spesifik** (Primary assignment) sesuai vacancy yang dilamar, bukan ke Company Group secara abstrak.

---

### 4.2 Module Onboarding & Offboarding

**Tujuan:** Memastikan proses masuk dan keluar karyawan berjalan terstruktur, terjadwal lintas departemen, dan dapat diaudit — termasuk memastikan tidak ada aset/akses yang tidak tertelusur.

**Aktor & Trigger:** Kandidat/Karyawan baru (pre-boarding), PIC multi-departemen (IT/GA/HR/Finance untuk checklist), Karyawan (mengajukan resign), Manager/HR (approval & exit clearance); dipicu setelah status Hired (onboarding) atau pengajuan resign (offboarding).

**Alur Utama — Onboarding:**
1. Setelah kandidat berstatus Hired, sistem mengirim akses Pre-Boarding: kandidat mengisi data mandiri & mengunggah dokumen wajib (KTP, NPWP, ijazah, rekening bank) sebelum hari pertama kerja (minimal H-3).
2. Kandidat menandatangani kontrak kerja secara digital (terhubung ke DMS, §4.11, untuk e-sign).
3. Setelah kontrak ditandatangani, sistem otomatis mengirim kredensial akun & mengaktifkan profil Master Employee.
4. Sistem men-generate Onboarding Checklist multi-departemen otomatis: Email & akses sistem (IT), Laptop/perangkat (IT/GA), ID Card (GA), Pendaftaran BPJS (HR), Payroll setup (Finance) — masing-masing dengan PIC & due date.
5. Setiap PIC menyelesaikan item checklist miliknya; item yang melewati due date tereskalasi otomatis ke atasan PIC.
6. Pada hari pertama, karyawan menjalani Orientation: pengenalan perusahaan, SOP acknowledgement (terhubung Policy & Compliance §4.13), dan Training wajib otomatis di-assign sesuai jabatan (terhubung LMS §4.4).

**Alur Utama — Offboarding:**
1. Karyawan mengajukan resign (self-service): tanggal efektif & alasan.
2. Approval berjenjang: Manager → HR.
3. Sistem membuka Exit Checklist lintas departemen: pengembalian aset (§4.3), penutupan akses sistem & email (IT), final payroll/settlement (Finance), penerbitan surat pengalaman kerja.
4. Setiap departemen menandai status "Cleared" setelah memverifikasi tanggung jawabnya selesai (misal GA memverifikasi seluruh aset sudah dikembalikan dalam kondisi wajar).
5. Karyawan mengisi Exit Interview (kuesioner alasan resign & survey kepuasan kerja).
6. Setelah **seluruh** departemen "Cleared", status karyawan baru dapat diubah final menjadi Resign/PHK (soft-delete) di Master Employee.
7. Surat pengalaman kerja diterbitkan; final settlement payroll diproses (termasuk pelunasan sisa pinjaman jika ada, §4.6).
8. Data exit interview teragregasi untuk analisis turnover per departemen/periode.

**Alur Alternatif/Pengecualian:**
- Resign tidak memenuhi notice period (default 30 hari) → memerlukan approval khusus/kompensasi sesuai kebijakan.
- Item checklist onboarding overdue → eskalasi otomatis ke atasan PIC, dicatat sebagai indikator keterlambatan proses onboarding untuk evaluasi internal.

**Titik Keputusan & Validasi Kunci:**
- Karyawan tidak dapat dinonaktifkan sebelum exit clearance seluruh departemen "Cleared".
- Surat pengalaman kerja hanya terbit setelah seluruh proses exit clearance selesai.

**Integrasi Modul Lain:** Master Employee (aktivasi/nonaktivasi), Document Management System (kontrak & surat), LMS (training wajib onboarding), Asset Management (pengembalian aset), Payroll (final settlement), Policy & Compliance (SOP acknowledgement).

**Dampak Company Group:**
- Untuk kasus **mutasi/transfer permanen antar Company dalam grup** (bukan resign sesungguhnya), sistem menyediakan alur **"Intercompany Transfer"** yang berbeda dari Offboarding biasa: tidak melalui Exit Interview/surat pengalaman kerja, melainkan checklist serah-terima yang lebih ringkas (aset & akses dipindah-tugaskan, bukan ditutup permanen), dan kontrak kerja baru diterbitkan untuk Company tujuan tanpa memutus riwayat masa kerja di Master Employee.
- Onboarding Checklist untuk Company baru dalam grup dapat **disalin (clone)** dari template Company lain yang sudah mapan, mempercepat standardisasi proses onboarding di seluruh anak usaha sambil tetap mengizinkan penyesuaian lokal (misal item checklist khusus pabrik untuk anak usaha manufaktur).

---

### 4.3 Module Asset Management

**Tujuan:** Mengelola siklus hidup aset perusahaan yang dipinjamkan ke karyawan — dari serah terima hingga pengembalian — agar tertelusur dan terhindar dari kehilangan tanpa pertanggungjawaban.

**Aktor & Trigger:** GA/IT (mengelola master aset & serah terima), Karyawan (menerima/mengembalikan aset); dipicu saat onboarding, mutasi, atau resign karyawan.

**Alur Utama (Serah Terima & Pengembalian Aset):**
1. GA mencatat aset baru ke Asset Master: kategori, no. seri, tanggal & nilai pembelian, status awal "Available".
2. Saat karyawan baru onboarding (atau membutuhkan aset), GA melakukan Asset Assignment: memilih aset yang "Available", mencatat kondisi saat assignment (New/Good/Fair/Poor), men-generate BAST (Berita Acara Serah Terima) digital yang ditandatangani karyawan.
3. Status aset berubah menjadi "Assigned"; riwayat penggunaan tercatat sebagai entri baru (append-only, tidak pernah dihapus).
4. Saat karyawan resign/mutasi (terhubung §4.2 Offboarding), proses Asset Return dipicu: karyawan menyerahkan aset, GA memverifikasi kondisi saat pengembalian (Good/Fair/Damaged/Lost).
5. **[Jika kondisi rusak/hilang di luar wajar]** → sistem menghitung potongan berdasarkan nilai buku (current_value) aset saat insiden, terintegrasi dengan Payroll (potongan langsung) atau Employee Loan (skema cicilan ganti rugi, §4.6) jika nominal besar.
6. Status aset kembali "Available" (siap dipinjamkan ke karyawan lain) atau "Maintenance"/"Disposed" sesuai kondisi.
7. Verifikasi pengembalian aset menjadi salah satu syarat Exit Clearance (§4.2) sebelum status resign karyawan dapat difinalisasi.

**Alur Alternatif/Pengecualian:**
- Aset hilang saat masih digunakan (bukan saat resign) → dilaporkan langsung oleh karyawan/atasan, status aset berubah "Lost", proses investigasi & potongan mengikuti kebijakan yang sama seperti pengembalian rusak.

**Titik Keputusan & Validasi Kunci:**
- Satu aset hanya dapat di-assign ke satu karyawan aktif dalam satu waktu.
- Pengembalian wajib direview GA sebelum Exit Clearance dapat ditandai "Cleared".
- Riwayat assignment tidak dapat dihapus.

**Integrasi Modul Lain:** Onboarding/Offboarding (assignment saat masuk, return saat keluar), Payroll/Employee Loan (potongan kerusakan/kehilangan), Document Management System (BAST digital).

**Dampak Company Group:**
- Aset dapat ditandai **Group-Shared** (misal pool kendaraan dinas/proyek yang dipakai bergantian oleh beberapa anak usaha) atau **Company-Specific** (default, mayoritas aset seperti laptop/ID card melekat ke satu Company).
- **Intercompany Asset Transfer**: ketika karyawan pindah Company dalam grup (§2.5.1) dan membawa aset yang masih digunakan (misal laptop kerja), sistem menyediakan alur transfer kepemilikan administratif aset tersebut dari Company asal ke Company tujuan tanpa proses return-reassign penuh — riwayat assignment tetap berkelanjutan, hanya `company_id` pemilik aset yang diperbarui, tercatat sebagai event khusus "Intercompany Transfer" di riwayat aset.
- Laporan Asset Condition Monitoring di level Group merangkum kondisi aset lintas Company untuk perencanaan pengadaan/penggantian terpusat (economies of scale saat negosiasi dengan vendor).

---

### 4.4 Module Learning Management System (LMS)

**Tujuan:** Mengelola pelatihan dan pengembangan kompetensi karyawan secara terstruktur, menjadi sumber data kompetensi untuk Performance Management dan Talent & Succession Planning.

**Aktor & Trigger:** HR/L&D (mengelola katalog & learning path), Karyawan (mengikuti training), Manager (approval attempt tambahan); dipicu oleh onboarding (training wajib), kebutuhan pengembangan, atau kewajiban sertifikasi ulang.

**Alur Utama:**
1. HR/L&D membuat Training Catalog (internal/eksternal) dan menyusun Learning Path berdasarkan jabatan/kompetensi.
2. Saat karyawan baru onboarding ke suatu jabatan, sistem otomatis men-assign training wajib (mandatory) sesuai Learning Path jabatan tersebut (terhubung §4.2 Onboarding).
3. Karyawan mengikuti course (materi video/PDF/SCORM), mengerjakan Assessment (Quiz/Exam/Assignment) dengan passing score & batas attempt yang dikonfigurasi.
4. **[Lulus]** → status enrollment menjadi "Completed", skor tercatat; **[Gagal & melebihi batas attempt]** → memerlukan approval Manager untuk attempt tambahan.
5. Untuk training yang menghasilkan sertifikasi (misal sertifikasi K3), sistem mencatat tanggal terbit & kedaluwarsa; reminder otomatis terkirim H-30 sebelum sertifikasi kedaluwarsa ke karyawan & manager.
6. HR memantau Completion Rate & Learning Hours agregat per karyawan/departemen melalui laporan.
7. Hasil completion rate & skor assessment menjadi salah satu input siklus appraisal (§3.10) dan penentuan kandidat HIPO (§4.8).

**Alur Alternatif/Pengecualian:**
- Sertifikasi kedaluwarsa tanpa diperpanjang → status berubah "Expired", muncul di laporan compliance (relevan untuk sertifikasi yang dipersyaratkan regulasi, misal K3).

**Titik Keputusan & Validasi Kunci:**
- Training wajib otomatis di-assign saat onboarding sesuai jabatan.
- Kegagalan melebihi batas attempt memerlukan approval manager untuk percobaan tambahan.

**Integrasi Modul Lain:** Onboarding (training wajib), Performance Management (input appraisal), Talent & Succession Planning (kompetensi & HIPO), Document Management System (penyimpanan sertifikat).

**Dampak Company Group:**
- Training Catalog dapat ditandai **Group-Shared** (misal kursus kepemimpinan, compliance dasar, leadership foundations yang relevan untuk seluruh anak usaha) sehingga tidak perlu dibuat ulang oleh setiap Company, sekaligus **Company-Specific** untuk training yang sangat teknis/operasional (SOP pabrik tertentu, sistem internal milik satu anak usaha).
- Learning Path dapat disusun di level Group untuk jabatan generik lintas company (misal "New Manager Path") sambil tetap memungkinkan setiap Company menambahkan modul lokal ke dalam path tersebut.
- Laporan Completion Rate dapat dibandingkan **antar Company** dalam Group untuk benchmarking investasi pengembangan SDM, berguna bagi Group HR dalam alokasi budget training tahunan.

---

### 4.5 Module Compensation & Benefit

**Tujuan:** Mengelola struktur kompensasi (grade, salary range) dan benefit agar konsisten secara internal dan kompetitif secara eksternal, termasuk perhitungan THR.

**Aktor & Trigger:** HR Compensation (mengelola struktur), Manager (mengajukan salary review), Compensation Committee/Director (approval di luar range); dipicu saat siklus salary review tahunan, promosi, atau perhitungan THR menjelang hari raya.

**Alur Utama (Salary Review):**
1. HR Compensation menyiapkan Salary Grade & Salary Range per posisi/level untuk **Company** tertentu, dengan opsi mewarisi rentang dasar dari struktur Group (lihat Dampak Company Group).
2. Saat siklus review (umumnya pasca-appraisal, §3.10), Manager mengajukan Salary Review untuk karyawannya: jenis (Merit/Annual/Promotion), gaji baru yang diusulkan, justifikasi tertulis.
3. Sistem menampilkan **compa-ratio** (posisi gaji aktual terhadap titik tengah range) untuk membantu keputusan — gaji baru di luar range memicu validasi tambahan.
4. **[Gaji baru di luar range grade]** → memerlukan approval Compensation Committee/Director.
5. HR melakukan simulasi dampak budget atas seluruh usulan salary review sebelum difinalisasi (agregat kenaikan biaya payroll bulan berikutnya).
6. Setelah disetujui, salary review berlaku efektif pada tanggal yang ditentukan (umumnya tidak retroaktif kecuali approval khusus) dan otomatis memperbarui data gaji di Master Employee/Payroll untuk periode berikutnya.

**Alur Utama (Perhitungan THR):**
1. Menjelang hari raya, Finance/HR menjalankan proses "Hitung THR" untuk seluruh karyawan **Company** tertentu.
2. Sistem menghitung THR penuh (1 bulan gaji) untuk karyawan ≥12 bulan masa kerja, dan pro-rata (gaji × masa kerja/12) untuk yang <12 bulan.
3. Slip THR ter-generate terpisah dari payslip reguler, didistribusikan ke karyawan.

**Alur Alternatif/Pengecualian:**
- Perubahan eligibility benefit (misal status Kontrak → Tetap) → sistem otomatis menyesuaikan benefit plan yang berlaku tanpa perlu input manual ulang.

**Titik Keputusan & Validasi Kunci:**
- Salary di luar range membutuhkan approval khusus.
- THR pro-rata dihitung otomatis untuk masa kerja <12 bulan.
- Perubahan salary structure tidak retroaktif kecuali approval khusus, dan tercatat di Audit Log.

**Integrasi Modul Lain:** Performance Management (dasar justifikasi salary review), Payroll (penerapan gaji baru & THR), Audit Log.

**Dampak Company Group:**
- Salary Grade dapat didefinisikan di level **Group** sebagai kerangka standar (misal Grade 1–10 berlaku universal untuk memudahkan perbandingan level jabatan antar anak usaha saat terjadi mutasi/promosi lintas company), namun **Salary Range nominal** (angka Rupiah min-mid-max) tetap ditentukan **per Company** karena daya saing pasar & kemampuan finansial tiap anak usaha berbeda.
- Approval offer/salary review yang melibatkan **lintas Company** (misal karyawan dipromosikan sekaligus dipindah ke Company lain dalam grup) memerlukan approval gabungan dari kedua HR Manager Company terkait, ditambah Group HR Director jika terjadi perubahan grade signifikan.
- THR tetap dihitung & dibayarkan **per Company** sesuai badan hukum pemberi kerja yang berlaku pada karyawan tersebut saat itu.

---

### 4.6 Module Employee Loan Management

**Tujuan:** Mengelola pengajuan, pencairan, dan pelunasan pinjaman/kasbon karyawan secara terkontrol agar tidak membebani take-home pay berlebihan.

**Aktor & Trigger:** Karyawan (mengajukan), Atasan/HR/Finance (approval berjenjang sesuai nominal); dipicu oleh kebutuhan finansial karyawan.

**Alur Utama:**
1. Karyawan mengajukan pinjaman: jenis (Kasbon/Pinjaman Umum/Pinjaman Darurat), nominal, tenor.
2. Sistem menampilkan simulasi cicilan sebelum pengajuan final disubmit.
3. Sistem memvalidasi: total cicilan aktif (termasuk pinjaman yang sedang berjalan) tidak melebihi persentase take-home pay (default 30%); jika karyawan masih memiliki pinjaman outstanding yang melebihi limit, pengajuan baru ditolak otomatis kecuali ada approval khusus.
4. Pengajuan disetujui berjenjang sesuai nominal (mengacu Workflow Engine, §4.10).
5. Setelah disetujui, jadwal cicilan (`loan_installments`) ter-generate otomatis sesuai tenor.
6. Setiap periode Payroll Run (§3.9), sistem otomatis memotong cicilan sesuai jadwal — jika karyawan memiliki >1 pinjaman aktif, dipotong sesuai prioritas urutan yang dikonfigurasi.
7. Status pinjaman berubah "Settled" setelah seluruh cicilan terbayar lunas.

**Alur Alternatif/Pengecualian:**
- Karyawan resign sebelum pinjaman lunas → sisa outstanding ditagihkan langsung pada proses final settlement payroll (§4.2 Offboarding), bukan dilanjutkan sebagai tagihan terpisah pasca-resign.
- Perubahan tenor/nominal cicilan setelah disetujui → memerlukan approval ulang, tidak dapat diubah sepihak.

**Titik Keputusan & Validasi Kunci:**
- Total cicilan aktif maksimal 30% take-home pay (default, konfigurabel).
- Cicilan otomatis terpotong dari payroll hingga lunas.

**Integrasi Modul Lain:** Payroll (potongan otomatis & pelunasan saat resign), Workflow Engine (approval berjenjang), Asset Management (skema cicilan ganti rugi aset, §4.3).

**Dampak Company Group:**
- Pinjaman tetap diajukan & dipotong dari payroll **Company** tempat karyawan tercatat aktif (Primary assignment) — tidak ada skema pinjaman lintas company.
- Jika karyawan **dimutasi permanen ke Company lain** dalam grup sementara masih memiliki pinjaman outstanding, sisa pinjaman dapat **dipindahkan (novasi internal)** ke payroll Company baru dengan approval Group HR/Finance, alih-alih dipaksa melunasi penuh saat mutasi — mencegah mutasi internal yang sah diperlakukan seperti resign dari sisi kewajiban finansial karyawan.

---

### 4.7 Module Travel & Expense Claim

**Tujuan:** Mengelola perjalanan dinas dan klaim reimbursement karyawan secara terstruktur dan transparan.

**Aktor & Trigger:** Karyawan (mengajukan perjalanan/klaim), Manager/Finance/Director (approval berjenjang sesuai nominal); dipicu oleh kebutuhan perjalanan dinas atau pengeluaran operasional yang perlu di-reimburse.

**Alur Utama:**
1. Karyawan mengajukan Travel Request: tujuan, durasi, estimasi biaya, dan opsional permintaan Travel Advance (uang muka).
2. Disetujui berjenjang sesuai kebijakan; jika disetujui, advance dicairkan dan dicatat sebagai belum direkonsiliasi (`reconciled = false`).
3. Selama/setelah perjalanan, karyawan mengajukan Expense Claim per kategori (Transportasi/Hotel/Makan/Entertainment/Operasional), mengunggah bukti pengeluaran (kecuali kategori lump-sum seperti uang makan harian flat).
4. **[Opsional]** Sistem melakukan OCR pada receipt untuk ekstraksi nominal otomatis sebagai bantuan input (tetap diverifikasi manual).
5. Klaim disetujui berjenjang berdasarkan nominal (di bawah limit: Manager; di atasnya: + Finance; lebih tinggi lagi: + Director), mengacu Workflow Engine.
6. Travel Advance yang sudah dicairkan direkonsiliasi dengan total expense claim aktual dari perjalanan tersebut (selisih dikembalikan/ditambah sesuai kasus).
7. Reimbursement diproses: transfer langsung ke rekening karyawan, atau digabungkan ke payroll run periode berikutnya.

**Alur Alternatif/Pengecualian:**
- Travel advance belum direkonsiliasi → memblokir pengajuan travel request baru berikutnya oleh karyawan yang sama (mencegah akumulasi advance yang tidak pernah dipertanggungjawabkan).
- Reimbursement yang sudah diproses dalam payroll tidak dapat dibatalkan; koreksi hanya pada periode berikutnya.

**Titik Keputusan & Validasi Kunci:**
- Expense claim wajib bukti, kecuali kategori lump-sum.
- Approval berjenjang berdasarkan nominal.

**Integrasi Modul Lain:** Payroll (reimbursement via payroll), Work Calendar (validasi durasi perjalanan terhadap hari kerja), Workflow Engine.

**Dampak Company Group:**
- Perjalanan dinas **lintas Company dalam grup** (misal karyawan Company A dikirim membantu proyek di Company B) memerlukan penentuan eksplisit: biaya dibebankan ke Company asal (default, dengan opsional cross-charge informasi ke Company tujuan) atau langsung diajukan sebagai klaim di Company tujuan jika karyawan berstatus Secondment aktif di sana — aturan ini ditentukan oleh status assignment karyawan saat pengajuan dibuat (§2.5.1).
- Approval Director untuk klaim nominal sangat besar dapat dieskalasi ke **Group Finance Director** jika melebihi ambang batas Company, konsisten dengan pola approval lintas company di Workflow Engine (§4.10).

---

### 4.8 Module Talent & Succession Planning

**Tujuan:** Menyiapkan kaderisasi untuk posisi-posisi kritikal agar organisasi tidak bergantung pada individu tertentu (key person risk).

**Aktor & Trigger:** HR/Leadership (menetapkan posisi kritikal & melakukan talent review), Atasan (input penilaian 9 box); dipicu oleh siklus talent review tahunan atau identifikasi posisi kritikal baru.

**Alur Utama:**
1. HR/Leadership menetapkan daftar Posisi Kritikal beserta alasan kekritisannya (key person risk, kelangkaan keahlian, dst.).
2. Setiap siklus talent review (minimal setahun sekali), Atasan/HR melakukan penilaian 9 Box Matrix untuk karyawan relevan — mengombinasikan skor performance (dari appraisal, §3.10) dan skor potential (assessment & observasi kompetensi).
3. Karyawan yang masuk kuadran tinggi (Star/Growth Player/High Impact Performer) ditandai sebagai HIPO atau Critical Talent, mempertimbangkan minimal 2 siklus appraisal terakhir & hasil assessment LMS (§4.4).
4. Untuk setiap Posisi Kritikal, HR menetapkan minimal satu Successor Candidate dengan Readiness Level (Ready Now/1–2 Tahun/3–5 Tahun) dan Development Plan (IDP) yang terhubung ke training relevan di LMS.
5. Progress IDP successor ditelusuri secara berkala; readiness level diperbarui sesuai kemajuan.
6. Output disajikan sebagai Succession Chart, Talent Heatmap, dan Leadership Pipeline bagi manajemen senior.

**Alur Alternatif/Pengecualian:**
- Posisi kritikal tanpa successor candidate yang terdefinisi → muncul sebagai alert prioritas tinggi di Dashboard Group/Company (risiko organisasi).

**Titik Keputusan & Validasi Kunci:**
- Setiap posisi kritikal wajib memiliki minimal satu successor dengan readiness level terdefinisi.
- Placement 9 Box direview minimal setahun sekali.

**Integrasi Modul Lain:** Performance Management (skor dasar 9 box), LMS (development plan successor), Dashboard (alert posisi kritikal tanpa successor).

**Dampak Company Group:**
- **Talent Pool & Succession Plan dapat bersifat group-wide**: successor untuk posisi kritikal di **Company A** dapat berasal dari karyawan **Company B** dalam grup yang sama — ini adalah salah satu nilai strategis utama Company Group, karena talent pipeline tidak terkurung di satu anak usaha saja.
- 9 Box Matrix dapat ditinjau dalam **Talent Review Committee tingkat Group** (lintas Company) untuk posisi-posisi senior/strategis (GM, Direktur anak usaha), sementara posisi operasional menengah-bawah tetap direview di level Company masing-masing.
- Dashboard Talent Heatmap di level Group memungkinkan identifikasi "kantong talenta" — Company mana dalam grup yang memiliki surplus HIPO yang dapat di-deploy untuk mengisi kebutuhan kritikal di Company lain.

---

### 4.9 Module Employee Engagement

**Tujuan:** Mengukur dan meningkatkan keterlibatan & kepuasan karyawan, serta mendeteksi dini risiko turnover.

**Aktor & Trigger:** HR (membuat & menganalisis survey), Karyawan (mengisi survey, memberi recognition, mengajukan suggestion); dipicu oleh siklus survey berkala atau interaksi sehari-hari (recognition/suggestion bersifat ad-hoc).

**Alur Utama (Survey):**
1. HR membuat Survey (Satisfaction/Pulse/Engagement), menyusun pertanyaan (skala/multiple choice/teks), menentukan periode aktif dan apakah bersifat anonim.
2. Karyawan menerima undangan mengisi survey, submit jawaban.
3. Sistem menghitung metrik agregat (eNPS dari pertanyaan skala 0–10, Engagement Index) **hanya jika jumlah responden per segmen memenuhi minimum** (misal ≥5 orang) untuk menjaga anonimitas — di bawah ambang itu, hasil tidak ditampilkan granular.
4. HR meninjau dashboard hasil survey, mengombinasikan dengan data absensi & appraisal untuk indikator dini Turnover Risk.

**Alur Utama (Recognition & Suggestion):**
1. Karyawan/Manager memberi Recognition (peer-to-peer atau manager-ke-bawahan) dengan pesan & poin opsional.
2. Karyawan mengajukan Suggestion (kategori + isi), dengan opsi anonim.
3. Suggestion mendapat PIC dan wajib status follow-up dalam SLA tertentu (misal 14 hari); melewati SLA memicu Notification eskalasi otomatis.

**Alur Alternatif/Pengecualian:**
- Segmen responden survey di bawah ambang minimum → hasil disembunyikan/digabung dengan segmen lain agar privasi tetap terjaga.

**Titik Keputusan & Validasi Kunci:**
- Survey anonim tidak menyimpan identitas pada level jawaban individual.
- Suggestion box wajib follow-up dalam SLA.

**Integrasi Modul Lain:** Dashboard (eNPS, Engagement Index, Turnover Risk), Notification (eskalasi SLA suggestion).

**Dampak Company Group:**
- Survey Engagement dapat dijalankan **serentak di seluruh Company dalam grup** dengan pertanyaan inti yang sama (memungkinkan perbandingan eNPS antar anak usaha), ditambah beberapa pertanyaan tambahan yang dapat dikustomisasi per Company.
- Program Recognition/Appreciation berbasis poin dapat bersifat **Group-Wide** (karyawan dari Company manapun dapat memberi/menerima recognition lintas anak usaha, relevan untuk kolaborasi proyek lintas company) dengan katalog redeem yang sama di seluruh grup.
- Turnover Risk & eNPS dapat dibandingkan antar Company di Dashboard Group untuk mengidentifikasi anak usaha dengan risiko engagement terendah yang memerlukan intervensi HR Group.

---

### 4.10 Module Workflow Engine

**Tujuan:** Menyediakan approval engine yang fleksibel dan dapat dikonfigurasi untuk seluruh modul HRMS, menghilangkan hardcode approval pada masing-masing modul.

**Aktor & Trigger:** Super Admin (konfigurasi approval type & flow), Sistem (menjalankan instance approval setiap kali modul lain membutuhkan approval); dipicu otomatis setiap kali ada request yang memerlukan persetujuan dari modul manapun (Leave, Self Service, Expense Claim, Loan, Job Offer, Resignation, dst.).

**Alur Utama:**
1. Modul pemilik request (misal Leave Management) mendaftarkan kebutuhan approval ke Workflow Engine sebagai `approval_type` dengan referensi entity terkait.
2. Workflow Engine mengevaluasi `approval_flow` yang aktif untuk tipe tersebut, termasuk *condition rule* (misal: jika nominal > Rp10 juta → tambah approval Director) dan **kondisi company scope** (lihat Dampak Company Group) untuk menentukan urutan approver yang tepat.
3. Sistem membuat `approval_instance` dengan step pertama aktif, mengirim Notification ke approver step tersebut.
4. Approver melakukan aksi: Approve/Reject/Escalate; setiap aksi tercatat di `approval_instance_log` dengan komentar opsional.
5. **[Approved di step terakhir]** → instance berstatus "Approved", modul pemilik request menerima callback untuk melanjutkan proses bisnisnya (misal saldo cuti dikurangi).
6. **[Rejected di step manapun]** → instance berstatus "Rejected", modul pemilik request menghentikan proses.
7. Jika approver tidak merespons dalam SLA (default 3 hari kerja) → sistem mengirim reminder; jika SLA tambahan terlampaui, request otomatis di-escalate ke approver berikutnya/backup approver.
8. Jika approver terdeteksi sedang cuti (terhubung Leave Management, §3.7) → otomatis di-reassign ke backup approver yang telah dikonfigurasi.

**Alur Alternatif/Pengecualian:**
- Perubahan konfigurasi approval flow → tidak berlaku retroaktif terhadap instance yang sedang berjalan; instance lama tetap menyelesaikan alur sesuai konfigurasi saat instance dibuat.

**Titik Keputusan & Validasi Kunci:**
- Setiap modul yang membutuhkan approval wajib didaftarkan sebagai Approval Type.
- Approval chain dapat berbeda sesuai kondisi (nominal, departemen, jenis request).

**Integrasi Modul Lain:** Seluruh modul yang memiliki proses approval (Leave, Self Service, Recruitment, Expense Claim, Loan, dst.) bergantung pada modul ini sebagai mesin approval bersama; Notification (pengiriman alert setiap step).

**Dampak Company Group:**
- `condition_rule` pada approval flow diperluas untuk mendukung kondisi **lintas company**: misalnya step approval otomatis menyisipkan **"Group HR Director"** atau **"Group Finance Director"** ketika request berasal dari kategori tertentu (manpower request di atas budget, mutasi antar company, offer salary lintas company) — tanpa perlu mengubah approval flow dasar tiap Company satu per satu.
- SLA Monitoring Dashboard dapat ditinjau di level **Group** untuk memantau kecepatan approval lintas seluruh Company, membantu mengidentifikasi Company/approver mana yang sering menjadi bottleneck proses bisnis.

---

### 4.11 Module Document Management System (DMS)

**Tujuan:** Menjadi repository dokumen terpusat untuk seluruh aktivitas HR dengan kontrol akses dan jejak audit yang jelas.

**Aktor & Trigger:** HR/Karyawan (upload dokumen pribadi), Admin (upload dokumen perusahaan), Sistem (monitoring expiry & e-sign); dipicu setiap kali dokumen baru perlu disimpan atau ditandatangani.

**Alur Utama:**
1. Pengguna (HR/karyawan) mengunggah dokumen, memilih kategori (Employee Document atau Company Document) dan access level (Public/Internal/Restricted).
2. Sistem menyimpan dokumen dengan versioning (`version` increment jika dokumen serupa diunggah ulang, dokumen lama berstatus "Superseded").
3. **[Dokumen memerlukan tanda tangan]** → alur e-sign dimulai: signer menerima notifikasi, meninjau dokumen, menandatangani secara digital (internal e-sign atau provider tersertifikasi/PSrE untuk dokumen legal seperti kontrak kerja).
4. Setelah ditandatangani, dokumen terkunci (tidak dapat diedit) — revisi berikutnya wajib berupa dokumen/versi baru.
5. Untuk dokumen dengan tanggal expiry (kontrak, sertifikasi, lisensi), sistem mengirim reminder otomatis H-30 dan H-7 ke pemilik dokumen & HR.
6. Setiap akses dokumen (View/Download/Edit) tercatat di `document_access_logs`, khususnya untuk dokumen sensitif (KTP, NPWP, kontrak) yang juga tercatat di Audit Log.

**Alur Alternatif/Pengecualian:**
- Dokumen Restricted yang diakses oleh pihak di luar daftar yang diizinkan → ditolak sistem, percobaan akses tetap tercatat di log untuk investigasi jika dicurigai ada upaya akses tidak sah.

**Titik Keputusan & Validasi Kunci:**
- Karyawan hanya dapat mengakses dokumen miliknya sendiri kecuali HR/Admin.
- Dokumen yang sudah di-e-sign tidak dapat diedit.

**Integrasi Modul Lain:** Master Employee (dokumen karyawan), Onboarding (kontrak), Recruitment (offer letter), LMS (sertifikat), Policy & Compliance (dokumen SOP/policy), Audit Log.

**Dampak Company Group:**
- Dokumen Perusahaan (Company Document) dapat berkategori **Group-Level** (SOP/policy yang berlaku untuk seluruh anak usaha, misal Code of Conduct grup) atau **Company-Level** (dokumen legal spesifik satu badan hukum, misal Perjanjian Kerja Bersama/PKB yang memang berbeda per Company karena negosiasi serikat pekerja terpisah).
- Akses dokumen Restricted lintas company (misal Group Legal perlu meninjau kontrak karyawan di seluruh anak usaha untuk audit kepatuhan) diberikan melalui `user_company_access` yang sama dipakai modul lain, bukan mekanisme akses terpisah — menjaga konsistensi model keamanan di seluruh sistem.

---

### 4.12 Module Integration Hub

**Tujuan:** Menjadi pusat integrasi seluruh sistem internal & eksternal agar setiap koneksi dikelola, dimonitor, dan diamankan secara terpusat.

**Aktor & Trigger:** Super Admin (konfigurasi integrasi), Sistem (sinkronisasi otomatis/terjadwal); dipicu oleh kebutuhan menghubungkan HRMS dengan sistem Accounting, job board, attendance device, komunikasi, atau identity provider.

**Alur Utama:**
1. Super Admin memilih kategori integrasi (Accounting/Recruitment/Attendance Device/Communication/Identity) dan provider spesifik (Accurate/SAP/Oracle, Jobstreet/LinkedIn/Glints, ZKTeco/Fingerprint, WhatsApp/Teams/Slack, Google SSO/Azure AD/LDAP).
2. Super Admin memasukkan kredensial API, disimpan terenkripsi (`credentials_encrypted`).
3. Super Admin mengonfigurasi field mapping (misal kode akun Accounting vs salary component HRMS) melalui mapping table, bukan hardcode.
4. Sistem menjalankan sinkronisasi (real-time untuk beberapa kasus, terjadwal untuk lainnya); setiap transaksi sinkronisasi tercatat di `integration_logs` (status Success/Failed/Retrying).
5. **[Sinkronisasi gagal]** → mekanisme retry otomatis (exponential backoff, maksimal N kali); jika tetap gagal, Notification terkirim ke Super Admin, dan fallback manual (input/export Excel) tersedia agar proses bisnis tidak terhenti total.
6. Untuk integrasi SSO, karyawan dapat login menggunakan identity provider yang terhubung; sesi tercatat di `sso_sessions`.

**Alur Alternatif/Pengecualian:**
- Perubahan konfigurasi integrasi → memerlukan approval Super Admin tambahan dan tercatat di Audit Log (karena berpotensi mengubah alur data sensitif).

**Titik Keputusan & Validasi Kunci:**
- Credential terenkripsi dan dapat di-revoke kapan saja.
- Mapping data dikonfigurasi melalui tabel, bukan hardcode.

**Integrasi Modul Lain:** Recruitment (publish job board eksternal), Attendance (sinkronisasi device fisik ZKTeco/Fingerprint untuk lokasi yang belum sepenuhnya mobile-based), Payroll/Finance (ekspor ke sistem Accounting), Authentication (SSO).

**Dampak Company Group:**
- Integrasi dapat dikonfigurasi di level **Group** (satu Identity Provider/SSO yang sama dipakai seluruh anak usaha — umum terjadi karena email domain & direktori karyawan biasanya terpusat di IT Group) atau di level **Company** (sistem Accounting yang berbeda per anak usaha, karena pembukuan tetap dipisah per badan hukum, atau anak usaha hasil akuisisi yang belum migrasi sistem dan untuk sementara tetap memakai sistem lamanya).
- Mapping field Accounting (kode akun vs salary component) bersifat **per Company**, karena Chart of Account tiap badan hukum lazimnya berbeda meski dalam grup yang sama.

---

### 4.13 Module Policy & Compliance Management

**Tujuan:** Memastikan kebijakan perusahaan tersosialisasi, dipahami, dipatuhi karyawan, serta menyediakan mekanisme audit kepatuhan terjadwal.

**Aktor & Trigger:** HR/Compliance (publish policy & jadwal audit), Karyawan (acknowledge policy), Auditor internal (mencatat temuan); dipicu saat ada kebijakan baru/revisi, atau siklus audit kepatuhan terjadwal.

**Alur Utama:**
1. HR/Compliance mempublikasikan Policy baru/revisi (terhubung ke DMS, §4.11), menentukan kategori, target roles/departemen, dan tanggal efektif.
2. Sistem mengirim Notification ke seluruh karyawan target untuk membaca & memberikan acknowledgement dalam jangka waktu tertentu (misal 14 hari).
3. Karyawan membuka & membaca policy, menekan "Acknowledge" — tercatat permanen sebagai bukti kepatuhan (`policy_acknowledgements`, tidak dapat dihapus).
4. Karyawan yang belum acknowledge menjelang deadline menerima reminder otomatis.
5. HR/Compliance memantau status acknowledgement seluruh target melalui dashboard ringkas (% sudah/belum acknowledge per departemen).
6. Secara terjadwal, Compliance menjalankan Compliance Audit: checklist audit periodik dijalankan, temuan (finding) dicatat dengan tingkat severity (Low/Medium/High).
7. Setiap finding diberi Corrective Action Plan dengan PIC & due date, ditracking hingga status "Closed".

**Alur Alternatif/Pengecualian:**
- Finding dengan severity High yang melewati due date tanpa progress → eskalasi otomatis ke manajemen senior/Group Compliance.

**Titik Keputusan & Validasi Kunci:**
- Policy baru wajib di-acknowledge dalam jangka waktu tertentu.
- Setiap finding wajib memiliki corrective action plan.
- Riwayat acknowledgement tersimpan permanen sebagai bukti hukum.

**Integrasi Modul Lain:** Document Management System (dokumen policy), Onboarding (SOP acknowledgement karyawan baru), Disciplinary Action (temuan dapat berujung ke tindakan disiplin, §4.14).

**Dampak Company Group:**
- Policy dapat ditandai **Group-Wide** (berlaku otomatis untuk seluruh karyawan di seluruh Company, misal Code of Conduct, Anti-Korupsi, Kebijakan Keberagaman) atau **Company-Specific** (SOP operasional yang hanya relevan untuk satu anak usaha).
- Compliance Audit dapat dijadwalkan terpusat oleh **Group Compliance Officer** dengan checklist standar yang diterapkan ke seluruh Company secara konsisten, sambil tetap memungkinkan Company menambahkan item checklist lokal sesuai regulasi industri spesifiknya (misal anak usaha manufaktur dengan kepatuhan K3 yang lebih ketat).
- Dashboard kepatuhan tingkat Group merangkum status acknowledgement & temuan audit terbuka **per Company**, membantu Group Compliance memprioritaskan anak usaha dengan risiko kepatuhan tertinggi.

---

### 4.14 Module Disciplinary Action Management

**Tujuan:** Mengelola proses pembinaan dan tindakan disiplin karyawan secara konsisten, terdokumentasi, dan sesuai prosedur hukum ketenagakerjaan.

**Aktor & Trigger:** Atasan/HR (melaporkan pelanggaran), Investigator (menyelidiki), HR Manager/Legal/Direksi (approval & penerbitan SP); dipicu oleh pelaporan pelanggaran karyawan.

**Alur Utama:**
1. Atasan/HR melaporkan pelanggaran karyawan: jenis pelanggaran, kronologi, bukti pendukung.
2. **[Jika perlu investigasi]** → Investigasi Internal dibuka, ditugaskan ke Investigator tertentu; akses dokumen & kasus dibatasi hanya untuk tim yang ditugaskan (confidential, mengacu access control DMS).
3. Investigator menyelesaikan investigasi, mencatat findings & rekomendasi tindakan, menutup investigasi.
4. Berdasarkan rekomendasi, HR menerbitkan Surat Peringatan (SP1/SP2/SP3) dengan approval HR Manager (untuk SP3/kasus berat, melibatkan Legal/Direksi).
5. SP memiliki masa berlaku (misal 6 bulan); jika dalam masa berlaku terjadi pelanggaran sejenis, level SP naik (SP1→SP2→SP3); jika tidak ada pelanggaran lagi hingga masa berlaku habis, pelanggaran berikutnya (jika ada) tidak otomatis naik level dari SP yang sudah expired.
6. SP yang terbit tercatat pada profil karyawan dan menjadi salah satu pertimbangan dalam appraisal/promosi (§3.10) berikutnya.

**Alur Alternatif/Pengecualian:**
- Pelanggaran tidak terbukti setelah investigasi → status ditutup tanpa penerbitan SP, namun riwayat pelaporan tetap tersimpan untuk referensi (bukan dihapus).

**Titik Keputusan & Validasi Kunci:**
- Penerbitan SP wajib approval HR Manager (SP3/berat: + Legal/Direksi).
- Investigasi bersifat confidential, akses dibatasi tim yang ditugaskan.

**Integrasi Modul Lain:** Performance Management (pertimbangan appraisal), Document Management System (dokumen SP, akses Restricted), Audit Log.

**Dampak Company Group:**
- Kasus disiplin tetap diproses & terdokumentasi **di level Company** tempat karyawan tercatat aktif (sesuai jurisdiksi hukum ketenagakerjaan badan hukum tersebut), namun untuk kasus berat (SP3, dugaan fraud, pelanggaran etika berat) sistem dapat mengeskalasi otomatis ke **Group Legal/Group HR Director** untuk pengawasan, terutama jika berpotensi berdampak pada reputasi grup secara keseluruhan.
- Jika karyawan yang sedang menjalani investigasi diajukan untuk mutasi/secondment ke Company lain (§2.5.1), sistem **memblokir** proses mutasi tersebut hingga investigasi selesai — mencegah kasus bermasalah "berpindah" tanpa penyelesaian.

---

### 4.15 Module Workforce Planning & Budgeting

**Tujuan:** Menyediakan perencanaan dan kontrol headcount serta biaya tenaga kerja jangka menengah, memastikan pengajuan rekrutmen baru selalu tervalidasi terhadap rencana dan budget yang tersedia.

**Aktor & Trigger:** HR/Finance (menyusun manpower plan & forecast), Sistem (validasi otomatis saat ada manpower request baru); dipicu oleh siklus perencanaan tahunan/kuartalan, atau setiap kali ada pengajuan rekrutmen (§4.1).

**Alur Utama:**
1. HR/Finance menyusun Manpower Plan per Departemen per periode (tahun): rencana headcount & approved budget, untuk **Company** tertentu.
2. Sepanjang tahun, sistem mencatat realisasi headcount aktual (`headcount_actuals`) setiap bulan untuk dibandingkan dengan rencana.
3. Payroll Forecast dihitung berdasarkan manpower plan & struktur gaji (§4.5) yang berlaku, dibandingkan dengan actual amount setiap bulan.
4. Recruitment Budget dialokasikan per departemen berdasarkan manpower plan, dengan tracking `used_amount` vs `remaining_amount`.
5. Setiap Manpower Request baru dari Recruitment (§4.1) divalidasi otomatis terhadap manpower plan & budget yang tersedia pada periode terkait — jika di luar plan, request ditandai memerlukan **over-budget approval** sebelum dapat diproses lebih lanjut.
6. Headcount & payroll forecast direview dan disesuaikan minimal setiap kuartal oleh HR/Finance.
7. Recruitment budget yang teralokasi namun tidak terserap dapat dialihkan (reallocate) ke departemen lain dengan approval Finance.

**Alur Alternatif/Pengecualian:**
- Manpower request di luar plan tanpa over-budget approval → diblokir oleh sistem, tidak dapat lanjut ke proses publish vacancy (§4.1).

**Titik Keputusan & Validasi Kunci:**
- Manpower request wajib divalidasi terhadap plan & budget sebelum disetujui.
- Reallocate budget antar departemen memerlukan approval Finance.

**Integrasi Modul Lain:** Recruitment & ATS (validasi requisition), Compensation & Benefit (basis payroll forecast), Dashboard (laporan realisasi vs plan).

**Dampak Company Group:**
- Manpower Plan & Budget disusun **per Company** (karena anggaran tenaga kerja melekat pada P&L masing-masing badan hukum), namun **Group Finance Director** memiliki dashboard konsolidasi yang merangkum total rencana & realisasi headcount/budget **seluruh Company** dalam satu pandangan untuk keperluan perencanaan strategis grup.
- Reallocation budget **lintas Company** (bukan hanya lintas departemen dalam satu company) dapat didukung sebagai kasus khusus — misalnya holding memindahkan sebagian budget rekrutmen dari anak usaha yang sedang efisiensi ke anak usaha yang sedang ekspansi — dengan approval **Group Finance Director**, dicatat sebagai transaksi alokasi antar-company yang transparan di Audit Log.

---

## 5. Lampiran — Matriks Dampak Company Group per Modul

Tabel berikut merangkum tingkat & jenis dampak penambahan Company Group terhadap masing-masing modul, sebagai rujukan cepat bagi tim development saat estimasi effort implementasi.

| # | Modul | Tingkat Dampak | Perubahan Utama |
|---|---|---|---|
| 6.1 | Authentication & Authorization | **Tinggi** | JWT membawa `company_scope[]`; Company Switcher di UI |
| 6.2 | Master Employee | **Tinggi** | `company_id` wajib di awal form; riwayat penugasan lintas company |
| 6.3 | Organization Structure | **Tinggi** | Level hierarki baru (Company Group); Org Chart Group View/Company View |
| 6.4 | Shift Management | Sedang | Konfigurasi per Company; template dapat di-clone dari Group |
| 6.5 | Work Calendar | Sedang | Level hierarki kalender baru di atas Company |
| 6.6 | Attendance | Rendah | Mengikuti scope Branch/Company yang sudah granular; penyesuaian untuk Secondment |
| 6.7 | Leave Management | Rendah–Sedang | Saldo cuti tetap di Company asal; jenis cuti baseline dari Group |
| 6.8 | Self Service Request | Sedang | Approval ganda untuk karyawan Secondment |
| 6.9 | Payroll | **Tinggi** (namun tetap per-Company) | Payroll run tetap terpisah per legal entity; dashboard agregasi di Group |
| 6.10 | Performance Management | Rendah–Sedang | Kerangka kompetensi inti dapat di level Group; kalibrasi lintas company opsional |
| 6.11 | Dashboard & Reporting | **Tinggi** | Group Executive Dashboard baru; toggle Group View/Company View |
| 6.12 | Notification & Alert | Rendah | Beberapa event baru khusus Group |
| 6.13 | Audit Log | Sedang | Akses lintas company untuk Group Super Admin, tetap tercatat siapa pelakunya |
| 6.14 | Recruitment & ATS | **Tinggi** | Vacancy & Talent Pool dapat Group-Wide; approval lintas company |
| 6.15 | Onboarding & Offboarding | Sedang | Alur baru: Intercompany Transfer (berbeda dari Offboarding biasa) |
| 6.16 | Asset Management | Sedang | Asset Group-Shared vs Company-Specific; Intercompany Asset Transfer |
| 6.17 | LMS | Rendah–Sedang | Course/Learning Path dapat Group-Shared |
| 6.18 | Compensation & Benefit | Sedang | Salary Grade standar di Group, nominal range per Company |
| 6.19 | Employee Loan | Rendah | Novasi pinjaman saat mutasi permanen lintas company |
| 6.20 | Travel & Expense | Rendah–Sedang | Pembebanan biaya lintas company untuk perjalanan dinas terkait proyek lintas anak usaha |
| 6.21 | Talent & Succession | **Tinggi** | Succession pool & talent review dapat group-wide untuk posisi senior |
| 6.22 | Employee Engagement | Rendah–Sedang | Survey & recognition dapat dijalankan group-wide |
| 6.23 | Workflow Engine | **Tinggi** | Condition rule baru untuk approver Group-level |
| 6.24 | DMS | Sedang | Dokumen Group-Level vs Company-Level |
| 6.25 | Integration Hub | Sedang | SSO/Identity dapat di level Group; Accounting tetap per Company |
| 6.26 | Policy & Compliance | Sedang | Policy Group-Wide vs Company-Specific; audit terpusat |
| 6.27 | Disciplinary Action | Rendah–Sedang | Eskalasi kasus berat ke Group Legal; blokir mutasi saat investigasi aktif |
| 6.28 | Workforce Planning | Sedang | Dashboard konsolidasi Group; reallocation budget lintas company |

---

## Penutup

Dokumen ini melengkapi PRD HRM System v2.0.0 dengan alur proses operasional (system flow) untuk seluruh 28 modul, sekaligus memformalkan penambahan fitur **Company Group** yang memungkinkan satu platform HRMS melayani beberapa badan hukum/anak usaha dalam satu grup usaha — dengan tetap menjaga independensi legal/pajak per perusahaan, sambil menyediakan visibilitas, talent pipeline, dan kontrol terkonsolidasi di level grup.

Sebagai langkah lanjutan yang disarankan:
1. Tim Database melakukan review skema tambahan di Bagian 2.3 dan menyelaraskannya dengan skema existing di PRD §9.
2. Tim Product menetapkan threshold spesifik untuk setiap aturan eskalasi lintas company (nominal budget, grade, dst.) yang saat ini ditulis "dikonfigurasi/threshold tertentu" — perlu nilai pasti sesuai kebijakan internal perusahaan.
3. Fitur Company Group disarankan masuk fasing implementasi di **Phase 1–2** (bersamaan dengan Master Employee & Organization Structure di Release 1), karena seluruh modul lain bergantung pada struktur ini sebagai fondasi — menambahkannya belakangan setelah modul lain selesai akan memerlukan migrasi data yang lebih kompleks.

Dokumen ini bersifat *living document* dan akan diperbarui seiring perkembangan proyek bersama PRD utama.

**Versi: 1.0.0 | Status: Draft | Juni 2026**