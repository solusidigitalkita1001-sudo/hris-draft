# Panduan Karyawan (EMPLOYEE)

Untuk karyawan biasa: absensi harian, pengajuan cuti/izin, slip gaji, pinjaman, tarik gaji awal (EWA), aktivitas harian, dan perjalanan dinas.

**Akun demo:** maya@tech.com / Employee123!

## Menu yang Anda lihat

Dashboard · Self Service · Slip Gaji Saya · Pinjaman · Tarik Gaji Awal · Aktivitas Harian · Perjalanan & Klaim · Kehadiran — ditambah ikon lonceng **Notifikasi** dan menu **Profil** di topbar. Di layar ponsel tersedia bottom-nav: Dashboard, Self, Pinjaman, Notifikasi, Profil (label bottom-nav ini masih berbahasa Indonesia walau aplikasi disetel ke EN).

## Mulai

1. Buka http://localhost:5173 dan masuk dengan email + kata sandi. Centang "Ingat saya" bila perlu; tautan "Lupa kata sandi?" tersedia.
2. Ganti tema (ikon matahari/bulan) dan bahasa (sakelar ID | EN) dari topbar. Sakelar bahasa mengganti seluruh menu dan halaman, termasuk format tanggal (nama bulan/hari ikut bahasa aktif). Di layar ponsel sakelar ID | EN disembunyikan dari topbar — pilih bahasa dari halaman login.
3. Dashboard Anda menampilkan: status absen hari ini, pengajuan cuti/izin terakhir, saldo cuti, kartu tim, dan riwayat kehadiran bulan berjalan. Tombol **Clock in** di kanan atas menuju halaman Kehadiran.
   - Kartu **Tim Saya** kini terisi: ada badge **Atasan** dengan nama atasan langsung beserta posisinya, dan sakelar **Daftar / Bagan** untuk melihat struktur tim. Pada data demo, Maya (Marketing Staff) melapor ke Bambang Supriyadi (Marketing Manager).
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

## Cuti (saldo + aturan H-7)

1. Menu **Self Service** → tab **Cuti** → **Ajukan Cuti**.
2. Pilih **Jenis Cuti**. Dropdown menampilkan **sisa saldo tiap jenis** langsung di pilihannya, mis. `Annual Leave — sisa 9 hari`.
   - Jenis yang belum punya alokasi saldo ditandai `— belum ada saldo` dan **tidak bisa dipilih**. Hubungi HR agar saldonya ditetapkan, atau pilih jenis lain.
   - Di bawah dropdown tampil rincian saldo jenis terpilih: `Saldo <jenis> tahun <tahun>: X hari tersisa (terpakai Y dari Z)`. Saldo dibebankan ke **tahun tanggal mulai cuti**, jadi mengubah Tanggal Mulai ke tahun berikutnya berarti saldo tahun itu yang dipakai.
   - Panel **Saldo Cuti Saya** di bagian bawah form merangkum sisa/total semua jenis.
3. Isi **Tanggal Mulai**, **Tanggal Selesai**, dan **Alasan**. Di bawah kolom tanggal muncul **perkiraan durasi hari kerja** (Sen–Jum, belum memperhitungkan hari libur) dengan catatan bahwa **jumlah final dihitung server** lewat kalender kerja dan hari libur nasional Anda.
4. **Lampiran:** pengajuan yang dibuat **kurang dari H-7** sebelum tanggal mulai **wajib** melampirkan dokumen pendukung (JPG/PNG/GIF/PDF, maks 5MB). Diajukan H-7 atau lebih awal, lampiran opsional — kecuali jenis cutinya sendiri mewajibkan lampiran (pada data demo: Maternity Leave dan Marriage Leave). Form menampilkan peringatan merah bila lampiran wajib.
5. Klik **Ajukan Cuti**. **Pengajuan yang melebihi sisa saldo ditolak saat submit** — bukan lagi nanti di meja atasan — dengan pesan yang menyebut sisa saldo vs jumlah hari yang diajukan, mis. *"Saldo cuti Annual Leave tahun 2026 tidak cukup: sisa 2 hari, sedangkan pengajuan ini memakai 3 hari kerja."* Perpendek rentang tanggal atau pilih jenis lain.
6. Saldo baru **terpotong setelah pengajuan disetujui**, bukan saat dikirim.
7. Pengajuan berstatus **Pending** bisa dibatalkan lewat tombol **Batalkan**. Rentang tanggal yang tumpang tindih dengan pengajuan Pending/Approved lain akan ditolak.

**Setiap jenis cuti punya kuota sendiri** — bukan hanya cuti tahunan. Kuota bawaan pada data demo (dialokasikan ke semua karyawan):

| Jenis cuti | Kuota per tahun | Lampiran wajib |
|---|---|---|
| Annual Leave | 12 hari | tidak |
| Sick Leave | 14 hari | tidak |
| Maternity Leave | 90 hari | ya |
| Paternity Leave | 3 hari | tidak |
| Marriage Leave | 3 hari | ya |
| Bereavement Leave | 3 hari | tidak |
| Unpaid Leave | 30 hari | tidak |

Angka di atas juga menjadi batas maksimal **per pengajuan** untuk jenis tersebut.

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

1. **Atur PIN sekali saja:** dari **Profil → Pengaturan → PIN Slip Gaji → Atur PIN**, atau dari kartu "PIN slip gaji belum diatur" di halaman **Slip Gaji Saya**. Verifikasi dengan kata sandi akun, lalu masukkan PIN 6 digit dua kali (kolom PIN berupa 6 kotak dot, dengan tautan **Hapus** untuk mengosongkannya). Hindari angka mudah ditebak — PIN disimpan terenkripsi di server dan tidak pernah ditampilkan kembali.
2. Menu **Slip Gaji Saya**: nominal seluruh slip tampil sebagai `Rp ••••••••` dengan badge **Terkunci**. Klik **Buka** → dialog "Masukkan PIN Slip Gaji" → **Buka nominal**. Nominal hanya dikirim server setelah PIN terverifikasi. (Bila PIN belum diatur, tombol **Buka** mengarahkan ke dialog Atur PIN lebih dulu.)
3. Satu kali buka membuka **seluruh periode sekaligus**: take-home pay setiap slip langsung tampil di daftar. Banner hijau di atas daftar menyebutkan **sampai jam berapa** nominal terbuka.
4. Sesi buka berlaku **15 menit** dari saat PIN diverifikasi; setelah itu halaman terkunci otomatis dengan pesan "Sesi buka slip gaji berakhir. Masukkan PIN kembali." Menutup atau me-refresh halaman juga langsung mengunci kembali — token buka hanya hidup di memori browser, tidak disimpan.
5. Setelah terbuka, klik **Lihat detail** pada satu periode: muncul kartu take-home pay, rincian **Pendapatan** dan **Potongan** beserta totalnya, dan tombol **Unduh PDF** di bagian bawah dialog.
6. Ubah PIN kapan saja lewat tombol **Ubah PIN** di kanan atas halaman (butuh kata sandi akun). Tombol ini baru muncul setelah PIN pernah diatur.
7. **Salah PIN 5 kali → terkunci 15 menit.** Pesannya menyebutkan sisa waktunya ("Terlalu banyak percobaan PIN salah. Coba lagi dalam N menit."); bila Anda membuka halaman saat masih terkunci, kolom PIN langsung dinonaktifkan dan tanggal/jam berakhirnya lockout ditampilkan. PIN yang benar mereset hitungan percobaan.

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
- **Saldo cuti baru dipotong saat pengajuan disetujui.** Pengajuan yang masih Pending belum "menahan" saldo, jadi dua pengajuan pada rentang tanggal berbeda bisa sama-sama lolos submit walau totalnya melebihi sisa saldo — yang terakhir disetujui akan ditolak approver dengan pesan saldo tidak cukup. (Rentang tanggal yang tumpang tindih tetap dicegah sejak submit.)
- Perkiraan durasi pada form cuti hanya menghitung Sen–Jum dan **belum memperhitungkan hari libur nasional**; jumlah hari final ditentukan server, jadi angka yang tersimpan bisa lebih kecil dari perkiraan.
- **Tidak ada fitur "lupa PIN" slip gaji.** PIN hanya bisa diubah sendiri dengan verifikasi kata sandi akun; tidak ada reset PIN atau pembatalan lockout oleh admin — bila terkunci, tunggu 15 menit.
- Pengajuan perjalanan dinas / klaim biaya **tidak bisa dibatalkan** setelah dikirim.
- Pilihan lokasi site di Aktivitas Harian masih terbatas (belum memuat daftar cabang lengkap), dan bukti foto hanya bisa berupa URL — belum ada upload file.
- Aktivitas harian tidak memiliki status persetujuan; admin hanya memonitor dan dapat menghapus.
- Jika wajah Anda belum didaftarkan, aplikasi tidak menampilkan peringatan khusus — check-in Face Recognition hanya akan gagal saat diverifikasi server.
- Notifikasi tidak bisa diklik untuk melompat ke dokumen terkait.
