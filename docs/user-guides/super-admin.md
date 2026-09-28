# Panduan Super Admin (SUPER_ADMIN)

Untuk administrator platform: melewati semua pembatasan role/permission, melihat seluruh menu di semua perusahaan, dan memegang dua kendali eksklusif — **matriks metode absensi per karyawan** dan menu **Aset**. Juga role kunci untuk penyiapan awal sistem.

**Akun demo:** admin@hrms.com / Admin123!

## Menu yang Anda lihat

Semua menu tanpa kecuali, termasuk dua yang hanya untuk Anda:

- **Organisasi → Metode Absensi** (matriks per karyawan)
- **Aset**

Pengaturan Menu Access/Data Scope tidak pernah membatasi Super Admin — Anda selalu melihat semuanya.

## Mulai

1. Masuk di http://localhost:5173 dengan admin@hrms.com / Admin123!.
2. Topbar: chip perusahaan aktif (Anda dapat berpindah ke perusahaan mana pun), toggle tema, sakelar bahasa ID | EN (kini mengganti seluruh halaman, termasuk format tanggal), lonceng notifikasi, menu profil (Profile, Settings, Sign out).
   - Data demo sudah berisi **dua perusahaan** dalam grup PT Holding Utama, jadi switcher benar-benar bisa diuji: **PT Teknologi Maju** (TECH) dan **PT Digital Nusantara** (DIGI — 1 cabang DIGI-HQ, departemen Product & Sales, hierarki Direktur → Manager → Staff, 8 karyawan aktif, tanpa akun login sendiri). Akun Anda tidak dibatasi cakupan perusahaan, sehingga keduanya tampil di chip.
3. Dashboard persona admin: statistik perusahaan aktif, kartu **Approval Menunggu** (judul dokumen + nama pengaju + satu baris ringkas per pengajuan), kartu Administrasi, analitik headcount & turnover.
4. Keamanan sesi berlaku juga untuk Anda: idle 15 menit → dialog "Masih di sana?" 60 detik → logout; server menolak sesi idle >30 menit.

## Penyiapan awal sistem (urutan yang disarankan)

1. **Organisasi:** buat Grup Perusahaan → Perusahaan → Cabang → Departemen → Posisi (semua kode dibuat otomatis).
2. **Kebijakan absensi cabang:** Organisasi → Cabang → ikon **Policy Attendance** per cabang — pilih metode (Fingerprint / Mobile GPS / Fingerprint+GPS / Face Recognition / **Face Recognition+GPS** / Manual), radius + koordinat geofence, aksi di luar radius (Tolak / Terima & tandai / Terima & review), toleransi terlambat/pulang cepat, dan sakelar wajib lokasi/selfie, izin hari libur/akhir pekan, auto absent, auto checkout.
3. **Kalender kerja:** kalender tahunan + jam kerja per hari; formula shift untuk pabrik; hari libur nasional/cuti bersama (bisa import CSV).
4. **Karyawan:** input atau **Import CSV**; untuk pegawai pabrik pilih kategori FACTORY + formula shift; **daftarkan wajah** dari detail karyawan bila cabang memakai Face Recognition.
5. **Pengguna & role:** Administrasi → Pengguna (buat akun, tautkan karyawan, atur role) dan Role (role custom + permission per modul), lalu rapikan **Menu Access** dan **Data Scope** per role.
6. **Workflow Templates:** definisikan alur persetujuan per jenis pengajuan (cuti, pinjaman, trip, klaim, tukar shift, lembur) — stage berjenjang, role approver + cadangan, SLA, eskalasi, condition rules.
7. **Payroll:** komponen gaji + formula terjadwal, periode, lalu run.

> **Catatan penyiapan cuti:** pengajuan cuti kini divalidasi terhadap saldo **saat dikirim**, jadi setiap karyawan butuh baris saldo per jenis cuti per tahun sebelum bisa mengajukan apa pun. Pembuatan/penyesuaian saldo **belum ada halamannya di UI** — pada lingkungan demo saldo berasal dari seed (Annual 12, Sick 14, Maternity 90, Paternity 3, Marriage 3, Bereavement 3, Unpaid 30 hari per tahun untuk semua karyawan).

## Matriks Metode Absensi (khusus Anda)

1. **Organisasi → Metode Absensi** — halaman berbadge "Khusus Super Admin".
2. Tabel karyawan × 3 metode: **Fingerprint**, **Face Recognition**, **Mobile GPS** — masing-masing berupa sakelar per karyawan; perubahan tersimpan langsung.
3. Metode efektif saat karyawan check-in = **kebijakan cabang ∩ izin per karyawan** dari matriks ini. Gunakan untuk pengecualian per orang (mis. mematikan GPS untuk staf back-office).
4. Ada pencarian NIK/nama dan paginasi 20 baris.

## Administrasi harian

- **Pengguna:** buat (role awal otomatis EMPLOYEE), edit role via checklist, hapus.
- **Role & permission:** role sistem hanya-baca; role custom bebas diatur.
- **Menu Access:** sembunyikan/tampilkan menu per role per perusahaan (tidak memengaruhi Anda).
- **Data Scope:** batasi cakupan baris data per role/resource (10 pilihan cakupan, dari Semua data sampai Data sendiri), dengan pratinjau "Akses efektif".
- **Audit Log:** filter aksi/entity/IP/tanggal, detail nilai lama vs baru, **Export CSV**.
- **Approval Tarik Gaji (EWA):** Approve/Reject, **Mark Paid** dengan bukti transfer, detail lengkap.
- **Monitoring Aktivitas:** aktivitas lapangan semua karyawan + validasi geofence; detail dan hapus.
- **Workflow Templates:** kelola template + tab My Approvals dengan **bulk approve/reject** dan kolom Reference yang bisa diklik ke dokumen. Tabel ini belum memakai ringkasan dokumen — untuk membaca isi pengajuan, pakai inbox **Workflow → My Approvals**, yang kini menampilkan judul dokumen, **nama pengaju + NIK**, baris fakta per jenis dokumen, tahap + level, tanggal diajukan, dan nama template (dokumen tak terbaca tampil sebagai *"Rincian dokumen tidak tersedia — buka modul terkait untuk memeriksa."*).

## Payroll ujung-ke-ujung

Sama dengan panduan Company/Group Admin: komponen + formula (publikasi oleh orang kedua) → periode → **New Run** (hitung otomatis) → **Approve** (pembuat run tetap tidak boleh menyetujui run-nya sendiri — aturan ini berlaku juga untuk Anda) → panel pembayaran (file bank CSV → catat hasil → rekonsiliasi) → slip (Print/PDF). Lihat [company-admin.md](company-admin.md) untuk langkah rinci.

## Aset (khusus Anda saat ini)

Menu **Aset**: daftar aset perusahaan (status AVAILABLE/ASSIGNED/MAINTENANCE/DISPOSED, nilai, pemegang saat ini) dan **Add Asset** (kode dibuat otomatis).

## Modul lain

Seluruh modul operasional (kehadiran, cuti dengan **validasi saldo saat submit** + aturan H-7, offboarding + exit clearance, dokumen, rekrutmen, kinerja, LMS, benefit, laporan 6 tab + Export CSV, perjalanan & klaim, pinjaman, EWA) tersedia penuh — alur detailnya ada di panduan role terkait. Anda juga bisa menyetujui langkah workflow mana pun (bypass role approver), termasuk dari halaman detail cuti/pinjaman.

## Tips

- Anda adalah satu-satunya yang bisa mengubah matriks metode absensi — bila karyawan mengeluh pilihan metode check-in tidak muncul, cek matriks ini dan kebijakan cabangnya sekaligus.
- Jaga akun ini seperlunya; untuk operasional harian gunakan akun role yang lebih sempit agar audit trail bermakna.
- Setelah mengubah role/permission pengguna, minta pengguna login ulang agar menu barunya termuat.

## Batasan saat ini

- **Aset:** hanya bisa menambah dan melihat — belum ada UI assign/return/edit/hapus aset.
- **Pengaturan** (Administrasi → Pengaturan) masih placeholder; tombol Save belum menyimpan.
- Tidak ada UI untuk: konfirmasi kehadiran periode payroll (prasyarat pembuatan run), void payroll run, reset kata sandi pengguna, **reset/unlock PIN slip gaji karyawan** (lockout 5 kali salah = 15 menit hanya bisa ditunggu), **delegasi approval**, dan **penetapan/penyesuaian saldo cuti + akrual tahunan**.
- **Saldo cuti kini prasyarat pengajuan** tetapi belum ada halaman untuk mengaturnya: endpoint set-saldo dan akrual tahunan sudah ada di server, halamannya belum. Karyawan tanpa alokasi tidak bisa mengajukan jenis cuti itu sama sekali.
- **Saldo cuti baru dipotong saat approval** — pengajuan Pending belum menahan saldo, jadi beberapa pengajuan (rentang tanggal berbeda) bisa lolos submit meski totalnya melebihi sisa; yang disetujui terakhir ditolak server.
- Enrollment wajah memakai satu foto tanpa liveness; liveness challenge hanya terjadi saat check-in.
- Benefit belum punya aksi mendaftarkan karyawan ke plan dari UI.
