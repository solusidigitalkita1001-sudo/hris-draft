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

### Perusahaan pada data demo

Grup **PT Holding Utama** (kode HOLDING) berisi **dua** perusahaan, sehingga company switcher benar-benar bisa dicoba:

| Perusahaan | Kode | Isi data demo |
|---|---|---|
| PT Teknologi Maju | TECH | perusahaan utama: semua akun demo, 3 cabang, kehadiran, payroll, cuti, pinjaman, dst. |
| PT Digital Nusantara | DIGI | 1 cabang (DIGI-HQ), departemen Product & Sales, hierarki posisi Direktur → Manager → Staff, 8 karyawan aktif |

PT Digital Nusantara **tidak punya akun login sendiri**. Yang bisa berpindah ke sana adalah role dengan cakupan lintas perusahaan: **SUPER_ADMIN** (admin@hrms.com — melihat semua perusahaan) dan **GROUP_ADMIN** (cakupan seluruh perusahaan dalam grup). Akun demo lain (rudi, dewi, rina, bambang, maya) hanya tercakup di PT Teknologi Maju, jadi chip perusahaan mereka hanya berisi satu pilihan.

## Hal yang berlaku untuk semua role

- **Bahasa & tema:** ganti dari topbar — sakelar **ID | EN** dan ikon matahari/bulan (terang/gelap). Preferensi tema dan bahasa tidak ada di halaman Profil; keduanya memang diatur lewat topbar.
  - Sakelar bahasa kini mengganti bahasa di **seluruh menu dan halaman** aplikasi, bukan lagi sebagian saja.
  - **Tanggal ikut bahasa aktif**: nama bulan/hari mengikuti ID atau EN tanpa perlu muat ulang halaman.
  - Pengecualian yang masih ada: nominal rupiah tetap diformat gaya Indonesia (`Rp 1.250.000`); label baris pada ringkasan approval dibentuk server dalam bahasa Indonesia; label **bottom-nav di layar ponsel** (Dashboard · Self · Pinjaman · Notifikasi · Profil) masih berbahasa Indonesia; dan sakelar ID | EN di topbar disembunyikan pada layar sangat kecil — di halaman login sakelarnya selalu tampil.
- **Perusahaan aktif:** pengguna dengan akses lebih dari satu perusahaan dapat berpindah lewat chip nama perusahaan di kiri topbar. Seluruh isi halaman dimuat ulang mengikuti perusahaan terpilih.
- **Inbox approval menampilkan ringkasan dokumen:** kartu di **Workflow → My Approvals** memuat judul dokumen (mis. "Pengajuan Cuti"), nama pengaju + NIK, dan baris fakta sesuai jenis dokumen — approver tidak perlu membuka modul lain untuk memutuskan. Kartu "Approval Menunggu" di dashboard juga menampilkan judul + nama pengaju + satu baris ringkas.
- **Pengajuan cuti divalidasi saldo saat dikirim** (bukan lagi saat approval): jenis cuti tanpa alokasi saldo tidak bisa dipilih, dan pengajuan yang melebihi sisa saldo ditolak dengan pesan yang menyebut sisa vs jumlah diajukan. Lihat [employee.md](employee.md) bagian "Cuti".
- **Keamanan sesi:**
  - Setelah **15 menit tanpa aktivitas**, muncul dialog "Masih di sana?" dengan hitung mundur **60 detik**; jika tidak direspons, Anda keluar otomatis dan kembali ke halaman login dengan pemberitahuan "Sesi berakhir karena tidak ada aktivitas".
  - Di sisi server, sesi yang menganggur lebih dari **30 menit** ditolak saat mencoba menyambung kembali — Anda harus login ulang.
  - Sesi aktif di perangkat lain dapat dilihat dan dicabut dari **Profil → Pengaturan → Keamanan & akses**.
- **Nominal slip gaji dilindungi PIN 6 digit** yang kini benar-benar berfungsi: satu kali buka membuka seluruh periode selama **15 menit**, salah PIN **5 kali** mengunci **15 menit**, dan tidak ada reset PIN oleh admin. Detailnya di panduan Employee bagian "Slip gaji".
