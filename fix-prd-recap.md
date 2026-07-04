# Rekap Task Belum Selesai dari `fix-prd.md`

## Status Umum

- Sumber acuan: `fix-prd.md`
- Status dokumen: `Draft`
- Fokus tambahan utama: dukungan `Company Group`
- Kondisi implementasi saat ini: sebagian fondasi sudah ada, tetapi enforcement multi-company masih parsial

## Ringkasan Temuan

### Sudah Ada Sebagian

- Model `CompanyGroup` sudah ada di Prisma.
- Relasi `Company -> groupId` sudah ada.
- UI `Company Switcher` sudah ada di top navigation.
- Beberapa dokumen modul turunan sudah mulai mengadopsi terminologi `Group View`, `Group Super Admin`, dan `group-wide`.

### Masih Parsial

- Auth masih memakai `companyId` tunggal sebagai konteks utama.
- Token auth belum membawa `company_scope[]`.
- Middleware akses company masih membandingkan request hanya terhadap satu `companyId`.
- Endpoint daftar company masih berpotensi mengembalikan company di luar scope user.
- Pemilihan company aktif di frontend belum benar-benar berbasis scope hasil auth backend.

### Belum Ada / Belum Terlihat

- Tabel `employee_company_assignments`.
- Tabel `user_company_access`.
- Row-level security lintas modul berbasis `company_scope[]`.
- Group Executive Dashboard yang benar-benar terimplementasi.
- Workflow lintas company yang lengkap untuk `Transfer` dan `Secondment`.
- Threshold bisnis final untuk approval lintas company.

## Daftar Task Belum Selesai

### Prioritas 1 — Fondasi Akses Multi-Company

- Selesai tahap awal: tambahkan `company_scope[]` ke context auth backend.
- Selesai tahap awal: tambahkan `company_scope[]` ke access token dan response `/auth`.
- Selesai tahap awal: update middleware autentikasi agar request membawa daftar company yang boleh diakses.
- Selesai tahap awal: ubah middleware akses company agar memvalidasi terhadap daftar scope, bukan satu company saja.
- Selesai tahap awal: batasi endpoint daftar company agar hanya mengembalikan company yang memang accessible.
- Selesai tahap awal: sinkronkan frontend auth type dan company switcher dengan `company_scope[]`.

### Prioritas 2 — Fondasi Data Company Group

- Selesai tahap awal: implementasi tabel `user_company_access`.
- Selesai tahap awal: implementasi tabel `employee_company_assignments`.
- Selesai tahap awal: generate Prisma client dan migration backend.
- Belum: sinkronkan skema tambahan tersebut ke PRD utama dan flow modul detail.

### Prioritas 3 — Proses Bisnis Lintas Company

- Implementasikan alur `Transfer` permanen antar company.
- Implementasikan alur `Secondment` sementara antar company.
- Tentukan approval chain final untuk kasus lintas company.
- Tentukan perilaku payroll, leave, attendance, dan asset saat employee berpindah company.

### Prioritas 4 — Reporting dan Dashboard

- Implementasikan `Group View / Company View` yang benar-benar mempengaruhi query data.
- Tambahkan Group Executive Dashboard.
- Tambahkan pelaporan agregat lintas company dengan kolom company yang jelas.

### Prioritas 5 — Keputusan Produk yang Masih Menggantung

- Tetapkan threshold nominal/grade untuk approval lintas company.
- Tetapkan siapa saja role group final yang dipakai sistem.
- Tetapkan kapan fitur `Company Group` masuk phase implementasi aktif.

## Task Yang Mulai Dikerjakan Sekarang

- Menambahkan `company_scope[]` ke auth backend dan frontend.
- Memperketat validasi akses company di middleware.
- Membatasi daftar company sesuai scope user.
- Menambahkan fondasi tabel akses multi-company dan assignment lintas company.

## Progress Implementasi

- Schema Prisma ditambah untuk `user_company_access` dan `employee_company_assignments`.
- Migration sudah dibuat dan diaplikasikan ke database lokal.
- Auth repository/service sudah mulai memakai `companyAccesses` untuk membentuk `companyScope`.
- Employee detail repository sudah mulai memuat riwayat assignment lintas company.
- CRUD backend untuk `user_company_access` sudah ditambahkan.
- Endpoint backend untuk `employee_company_assignments` sudah ditambahkan.
- Fondasi infra sudah ditambah untuk `Nginx` load balancer, `RabbitMQ`, `Redis`, dan background worker `BullMQ`.

## Catatan

- Rekap ini disusun dari isi `fix-prd.md` dan pengecekan cepat ke codebase saat ini.
- File ini dipakai sebagai rekap kerja awal, bukan pengganti `fix-prd.md`.
