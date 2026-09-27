# Panduan Group Admin (GROUP_ADMIN)

Untuk administrator grup perusahaan (holding): semua kewenangan Company Admin di seluruh perusahaan dalam grup, ditambah hak RBAC penuh (role, permission, menu access, data scope), rekrutmen, dan siklus payroll dari pembuatan run sampai pencatatan pembayaran.

> **Belum ada akun demo GROUP_ADMIN.** Untuk mencobanya: login sebagai Super Admin (admin@hrms.com / Admin123!) → Administrasi → Pengguna → buat/edit pengguna → centang role GROUP_ADMIN.

## Menu yang Anda lihat

Hampir semuanya: seluruh menu karyawan + operasional, Payroll, Benefit, **Rekrutmen**, Kinerja, LMS, Laporan, dan grup **Administrasi lengkap**: Pengguna, Role, Audit Log, Workflow Templates, **Menu Access**, **Data Scope**, Approval Tarik Gaji, Monitoring Aktivitas, Pengaturan.

Yang **tidak** tampil: **Organisasi → Metode Absensi** (matriks metode per karyawan — khusus Super Admin) dan menu **Aset** (izinnya belum tersedia di sistem, sehingga efektif hanya Super Admin yang melihatnya).

## Mulai

1. Masuk di http://localhost:5173; tema/bahasa lewat topbar.
2. **Berpindah perusahaan:** klik chip perusahaan di kiri topbar → pilih perusahaan dalam grup. Semua halaman dimuat ulang mengikuti perusahaan aktif — biasakan memeriksa chip ini sebelum mengubah data.
3. Dashboard persona admin: statistik perusahaan aktif, approval menunggu, kartu Administrasi, analitik headcount/turnover.
4. Sesi berakhir otomatis setelah 15 menit idle (peringatan 60 detik).

## Kelola grup & perusahaan

1. **Organisasi → Grup Perusahaan:** buat/ubah grup (kode otomatis).
2. **Organisasi → Perusahaan:** tambah perusahaan ke grup (nama, NPWP opsional).
3. Per perusahaan: kelola Cabang (termasuk **kebijakan absensi cabang** — metode Fingerprint / Mobile GPS / Fingerprint+GPS / Face Recognition / Face Recognition+GPS / Manual, radius geofence, aksi di luar radius, toleransi, sakelar wajib lokasi/selfie/auto absent/auto checkout), Departemen, Posisi.

## RBAC penuh

1. **Administrasi → Role:** buat role custom pada perusahaan aktif (**New Role**), atur prioritas, lalu tombol **Permissions** untuk mencentang izin per modul. Role sistem hanya-baca.
2. **Administrasi → Menu Access:** per role, setel tiap menu **Terlihat/Disembunyikan** (default terlihat); tersedia aksi "Tampilkan semua / Sembunyikan semua" per kelompok. Ini lapisan tampilan — permission API tetap lapisan otorisasi utama.
3. **Administrasi → Data Scope:** batasi baris data per role dan per resource (Semua data, Company aktif, Branch/Departemen/Sub-departemen tertentu atau "sendiri" dinamis, Tim yang dipimpin, Data sendiri). Panel "Akses efektif saya" menampilkan hasil resolusinya.
4. **Administrasi → Pengguna:** buat pengguna, tautkan ke karyawan, atur role (mode edit), hapus.

## Payroll lintas perusahaan (siklus penuh)

Dengan izin bawaan, Group Admin memegang seluruh siklus di tiap perusahaan aktif:

1. Salary Components + formula terjadwal (draft → simulasi → publikasi oleh orang kedua).
2. Payroll Periods (buat/tutup).
3. **New Run** (perhitungan otomatis; server menolak bila kehadiran periode belum dikonfirmasi).
4. **Approve Payroll** — pembuat run tidak bisa menyetujui run-nya sendiri.
5. Panel Pembayaran: buat daftar, unduh **file bank CSV**, catat hasil per karyawan, **rekonsiliasi** (menyelesaikan payroll dan melunasi cicilan pinjaman) — pencatatan/rekonsiliasi harus orang berbeda dari penyetuju.
6. Slip: detail, Print, PDF.

Rincian langkahnya sama dengan panduan [company-admin.md](company-admin.md).

## Operasional dan persetujuan

Seluruh alur pada panduan HR Manager dan Company Admin berlaku: karyawan (CRUD, import/export CSV, transaksi karier, **enrollment wajah**), kehadiran (monitoring, input manual, lembur), cuti (H-7 + lampiran), kalender kerja & formula shift, offboarding + exit clearance, dokumen, workflow (inbox, template, **bulk approval**), EWA (approve + **Mark Paid**), monitoring aktivitas harian, rekrutmen (lowongan → pipeline → interview), kinerja, LMS, benefit, laporan 6 tab + Export CSV, audit log + export.

## Tips

- Karena hak Anda luas, manfaatkan **Data Scope** dan **Menu Access** untuk menyempitkan akses role di bawah Anda alih-alih membuat banyak role baru.
- Selalu cek perusahaan aktif sebelum aksi massal (import karyawan, run payroll).
- Audit Log adalah teman terbaik saat menelusuri perubahan lintas admin.

## Batasan saat ini

- **Belum ada akun demo** untuk role ini (lihat catatan di atas).
- **Metode Absensi per karyawan** (matriks Fingerprint/Face/GPS) hanya bisa diubah Super Admin.
- Menu **Aset** tidak tampil karena izin modul aset belum terdefinisi di sistem.
- Halaman **Pengaturan** masih placeholder (Save tidak menyimpan).
- Tidak ada UI: konfirmasi kehadiran periode payroll, void payroll run, reset kata sandi pengguna, reset PIN slip gaji, delegasi approval.
- Impersonasi pengguna tidak tersedia untuk Group Admin.
