# Panduan Pengguna HRIS Enterprise

Kumpulan user guide end-to-end per role. Setiap guide ditulis dari sudut pandang pengguna: menu apa yang terlihat, alur kerja utama langkah demi langkah, tips, dan batasan yang ada saat ini.

## Indeks

| Guide | Role | Untuk siapa |
|---|---|---|
| [super-admin.md](super-admin.md) | SUPER_ADMIN | Administrator platform lintas grup/perusahaan |
| [group-admin.md](group-admin.md) | GROUP_ADMIN | Administrator satu grup perusahaan (holding) |
| [company-admin.md](company-admin.md) | COMPANY_ADMIN | Administrator satu perusahaan |
| [hr-manager.md](hr-manager.md) | HR_MANAGER | Kepala HR: approval, payroll (baca), rekrutmen, laporan |
| [hr-staff.md](hr-staff.md) | HR_STAFF | Staf HR operasional: data karyawan, kehadiran, dokumen |
| [manager.md](manager.md) | MANAGER | Atasan langsung / kepala tim: approval dan monitoring tim |
| [employee.md](employee.md) | EMPLOYEE | Karyawan: absensi, cuti/izin, slip gaji, pinjaman, EWA |

## Akun demo (lingkungan pengembangan)

Aplikasi berjalan di **http://localhost:5173**.

| Role | Email | Kata sandi |
|---|---|---|
| SUPER_ADMIN | admin@hrms.com | Admin123! |
| COMPANY_ADMIN | rudi@tech.com | Employee123! |
| HR_MANAGER | dewi@tech.com | Employee123! |
| HR_STAFF | rina@tech.com | Employee123! |
| MANAGER | bambang@tech.com | Employee123! |
| EMPLOYEE | maya@tech.com | Employee123! |

> **Catatan:** role **GROUP_ADMIN belum memiliki akun demo** pada data seed saat ini. Untuk mencoba alurnya, buat pengguna baru lalu berikan role GROUP_ADMIN lewat menu Administrasi → Pengguna (mode edit) menggunakan akun SUPER_ADMIN.

## Hal yang berlaku untuk semua role

- **Bahasa & tema:** ganti dari topbar — sakelar **ID | EN** dan ikon matahari/bulan (terang/gelap). Preferensi tema dan bahasa tidak ada di halaman Profil; keduanya memang diatur lewat topbar.
- **Perusahaan aktif:** pengguna dengan akses lebih dari satu perusahaan dapat berpindah lewat chip nama perusahaan di kiri topbar. Seluruh isi halaman dimuat ulang mengikuti perusahaan terpilih.
- **Keamanan sesi:**
  - Setelah **15 menit tanpa aktivitas**, muncul dialog "Masih di sana?" dengan hitung mundur **60 detik**; jika tidak direspons, Anda keluar otomatis dan kembali ke halaman login dengan pemberitahuan "Sesi berakhir karena tidak ada aktivitas".
  - Di sisi server, sesi yang menganggur lebih dari **30 menit** ditolak saat mencoba menyambung kembali — Anda harus login ulang.
  - Sesi aktif di perangkat lain dapat dilihat dan dicabut dari **Profil → Pengaturan → Keamanan & akses**.
- **Nominal slip gaji dilindungi PIN 6 digit** — lihat panduan Employee bagian "Slip gaji" untuk detailnya.
