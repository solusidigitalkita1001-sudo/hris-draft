# Panduan Karyawan (EMPLOYEE)

Untuk karyawan biasa: absensi harian, pengajuan cuti/izin, slip gaji, pinjaman, tarik gaji awal (EWA), aktivitas harian, dan perjalanan dinas.

**Akun demo:** maya@tech.com / Employee123!

## Menu yang Anda lihat

Dashboard · Self Service · Slip Gaji Saya · Pinjaman · Tarik Gaji Awal · Aktivitas Harian · Perjalanan & Klaim · Kehadiran — ditambah ikon lonceng **Notifikasi** dan menu **Profil** di topbar. Di layar ponsel tersedia bottom-nav: Dashboard, Self, Pinjaman, Notifikasi, Profil.

## Mulai

1. Buka http://localhost:5173 dan masuk dengan email + kata sandi. Centang "Ingat saya" bila perlu; tautan "Lupa kata sandi?" tersedia.
2. Ganti tema (ikon matahari/bulan) dan bahasa (sakelar ID | EN) dari topbar.
3. Dashboard Anda menampilkan: status absen hari ini, pengajuan cuti/izin terakhir, saldo cuti, kartu tim, dan riwayat kehadiran bulan berjalan. Tombol **Clock in** di kanan atas menuju halaman Kehadiran.
4. Diamkan aplikasi 15 menit dan sesi berakhir otomatis (ada peringatan 60 detik lebih dulu).

## Absensi harian (check-in / check-out)

1. Menu **Kehadiran** → panel "info hari ini" menampilkan tanggal, jadwal kerja, dan status ("Belum check-in" / "Sudah check-in HH:mm" / "Sudah check-out").
2. Klik **Check In** (tombol hanya aktif bila server mengizinkan check-in hari itu).
3. Pilih **Method**. Pilihan yang muncul mengikuti kebijakan absensi cabang Anda digabung izin metode per karyawan — bisa berupa Fingerprint, Mobile GPS, Face Recognition, atau Manual. Kotak ringkasan menampilkan cabang, jadwal, kebijakan, radius geofence, dan apakah lokasi wajib dikirim.
4. Jika metodenya **Face Recognition**: setelah menekan Check In muncul **Liveness Challenge** — kamera depan menyala dan Anda diminta melakukan satu gerakan acak (kedip 2x, senyum lebar, putar kepala kiri/kanan, atau angguk 2x). Sistem merekam 5 frame lalu memverifikasi gerakan dan mencocokkan wajah di server. Gagal? Klik **Ulangi Challenge** (gerakan diacak ulang).
5. **GPS diambil otomatis** oleh browser bila metode memakai GPS/Face Recognition atau kebijakan cabang mewajibkan lokasi — izinkan akses lokasi saat diminta.
6. Selesai bekerja, kembali ke halaman Kehadiran dan klik **Check Out**.
7. Riwayat kehadiran Anda tampil di tabel dengan filter bulan dan status (All / PRESENT / ABSENT / LATE / EXCUSED). Kartu kecil di dasar sidebar juga menunjukkan status absen hari ini beserta progres jam kerja.

**Tips:** pastikan wajah Anda sudah didaftarkan oleh HR (dari halaman detail karyawan) sebelum memakai Face Recognition; jika belum, verifikasi wajah akan ditolak server.

## Cuti (aturan H-7)

1. Menu **Self Service** → tab **Cuti** → **Ajukan Cuti**.
2. Pilih **Jenis Cuti** — saldo jenis terpilih langsung ditampilkan ("X hari tersisa").
3. Isi **Tanggal Mulai**, **Tanggal Selesai**, dan **Alasan**.
4. **Lampiran:** pengajuan yang dibuat **kurang dari H-7** sebelum tanggal mulai **wajib** melampirkan dokumen pendukung (JPG/PNG/GIF/PDF, maks 5MB). Diajukan H-7 atau lebih awal, lampiran opsional — kecuali jenis cutinya sendiri mewajibkan lampiran. Form menampilkan peringatan merah bila lampiran wajib.
5. Klik **Ajukan Cuti**. Saldo terpotong otomatis setelah disetujui.
6. Pengajuan berstatus **Pending** bisa dibatalkan lewat tombol **Batalkan**.

## Izin (lampiran selalu wajib)

1. Self Service → tab **Izin** → **Ajukan Izin**.
2. Pilih **Tipe Izin**: Sakit, Keperluan Pribadi, Datang Terlambat, Pulang Cepat, Izin Keluar Kantor, Perjalanan Dinas, Kerja Dari Rumah, atau Lainnya.
3. Isi tanggal mulai/selesai, **Durasi** (boleh setengah hari: 0.5), dan **Alasan**.
4. **Setiap pengajuan izin wajib melampirkan dokumen** (JPG/PNG/GIF/PDF, maks 5MB) — tanpa kecuali.
5. Kirim, lalu pantau statusnya di tab yang sama (mode Tabel atau List, dengan filter status dan pencarian). Pengajuan Pending bisa dibatalkan.

## Lembur dan tukar shift

- Tab **Lembur** hanya menampilkan riwayat lembur Anda beserta statusnya (dicatat HR/atasan) — tidak ada form pengajuan lembur.
- Tab **Tukar Shift** hanya muncul untuk **pegawai pabrik** yang memakai formula shift: klik **Request Tukar Shift**, pilih tanggal, pilih rekan satu regu (preview shift Anda vs shift rekan tampil), isi alasan, kirim — request diteruskan ke kepala regu. Kepala regu menyetujui/menolak dari panel "Approval Kepala Regu" di tab yang sama.
- Tab **Kalender Kerja** menampilkan jadwal bulanan Anda (hari kerja/shift/libur/cuti disetujui) lengkap dengan legenda dan profil jadwal.

## Slip gaji (PIN 6 digit)

1. **Atur PIN sekali saja:** dari **Profil → Pengaturan → PIN Slip Gaji → Atur PIN**, atau dari kartu "PIN slip gaji belum diatur" di halaman **Slip Gaji Saya**. Verifikasi dengan kata sandi akun, lalu masukkan PIN 6 digit dua kali. Hindari angka mudah ditebak.
2. Menu **Slip Gaji Saya**: nominal seluruh slip tampil sebagai `Rp ••••••••`. Klik **Buka** dan masukkan PIN — nominal hanya dikirim server setelah PIN terverifikasi.
3. Sesi buka berlaku **15 menit**; setelah itu halaman terkunci lagi dan PIN diminta ulang. Menutup/merefresh halaman juga mengunci kembali.
4. Setelah terbuka, klik **Lihat detail** untuk rincian pendapatan/potongan dan **Unduh PDF**.
5. Ubah PIN kapan saja lewat tombol **Ubah PIN** (butuh kata sandi akun).
6. Salah PIN berkali-kali akan memblokir sementara ("Terlalu banyak percobaan...").

## Pinjaman karyawan

1. Menu **Pinjaman** → **Ajukan Pinjaman**.
2. Pilih **Jenis Pinjaman** (plafon maksimal dan jumlah cicilan maksimal tampil di pilihan), isi **Jumlah**, **Cicilan (bulan)**, dan **Alasan**. **Estimasi cicilan per bulan** dihitung otomatis (termasuk bunga jenis pinjaman).
3. Pengajuan berjalan lewat workflow persetujuan berjenjang. Pantau progres di halaman detail: kartu **Alur Persetujuan** menampilkan tiap level approver.
4. Setelah disetujui, halaman detail menampilkan **Jadwal Cicilan** beserta progres pembayaran; cicilan dipotong otomatis lewat payroll.

## Tarik Gaji Awal (EWA)

1. Menu **Tarik Gaji Awal** → **Ajukan Tarik Gaji**.
2. Panel limit menampilkan pendapatan aktual Anda periode berjalan (gaji dasar prorata hari hadir + lembur disetujui) dan **maksimal tarik 50%**, dikurangi pengajuan yang masih berjalan.
3. Isi jumlah, biaya admin (jika ada), dan alasan (min. 3 karakter) → **Ajukan Sekarang**.
4. Status: Menunggu Approval → Disetujui → Sudah Dibayar → Terpotong di Gaji. Pengajuan yang masih menunggu bisa dibatalkan.

## Aktivitas harian (untuk pekerja lapangan)

1. Menu **Aktivitas Harian** → **Laporkan Aktivitas**.
2. Isi tanggal, tipe (Kerja Rutin, Kunjungan Site, Inspeksi Site, Rapat, Lainnya), lokasi site, judul, jam mulai/selesai, dan deskripsi.
3. **Wajib klik "Capture Lokasi GPS Sekarang"** sebelum kirim — sistem memverifikasi apakah Anda berada di dalam radius site (badge "Di Dalam/Di Luar Radius" tampil di riwayat).
4. Tandai aktivitas **Selesai** atau hapus laporan dari tabel riwayat.

## Perjalanan dinas & klaim biaya

1. Menu **Perjalanan & Klaim** → tombol **Travel Request** (perjalanan dinas: tujuan, estimasi biaya, tanggal, tujuan perjalanan) atau **Expense Claim** (klaim biaya: kategori, nominal, tanggal, upload struk maks 5MB, bisa dikaitkan ke trip yang sudah disetujui).
2. Pantau status di dua tab: **Business Trip** (Diajukan/Disetujui/Ditolak/Selesai) dan **Expense Claim** (Dikirim/Disetujui/Ditolak/Direimburse).

## Profil Anda

Menu Profil (avatar di topbar) memiliki 5 tab: **Ringkasan** (data pribadi, saldo cuti, kelengkapan profil, atasan langsung, kontak darurat), **Slip Gaji** (ringkasan; membuka nominal tetap lewat halaman Slip Gaji Saya), **Kepegawaian** (data & riwayat jabatan), **Dokumen** (pratinjau/unduh dokumen kepegawaian), **Pengaturan** (ganti kata sandi min. 8 karakter, atur/ubah PIN slip gaji, cabut sesi perangkat lain).

## Notifikasi

Ikon lonceng di topbar (badge jumlah belum dibaca) → halaman Notifikasi: filter "Semua"/"Belum dibaca", tandai terbaca satuan atau semua, dan hapus.

## Batasan saat ini

- **Tidak ada form pengajuan lembur** — lembur diinput oleh HR/atasan; Anda hanya melihat riwayatnya.
- **Tidak ada fitur "lupa PIN" slip gaji.** PIN hanya bisa diubah sendiri dengan verifikasi kata sandi akun; tidak ada reset PIN oleh admin.
- Pengajuan perjalanan dinas / klaim biaya **tidak bisa dibatalkan** setelah dikirim.
- Pilihan lokasi site di Aktivitas Harian masih terbatas (belum memuat daftar cabang lengkap), dan bukti foto hanya bisa berupa URL — belum ada upload file.
- Aktivitas harian tidak memiliki status persetujuan; admin hanya memonitor dan dapat menghapus.
- Jika wajah Anda belum didaftarkan, aplikasi tidak menampilkan peringatan khusus — check-in Face Recognition hanya akan gagal saat diverifikasi server.
- Notifikasi tidak bisa diklik untuk melompat ke dokumen terkait.
