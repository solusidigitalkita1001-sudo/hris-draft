# Panduan Manager / Atasan Langsung (MANAGER)

Untuk kepala tim, supervisor, dan atasan langsung: menyetujui pengajuan tim (cuti, pinjaman, perjalanan dinas, tukar shift), memonitor kehadiran tim, sekaligus tetap memakai seluruh fitur self-service pribadi.

**Akun demo:** bambang@tech.com / Employee123!

## Menu yang Anda lihat

Semua menu karyawan (Dashboard, Self Service, Slip Gaji Saya, Pinjaman, Tarik Gaji Awal, Aktivitas Harian, Perjalanan & Klaim, Kehadiran) **ditambah**: Organisasi (Struktur Organisasi, Grup Perusahaan, Perusahaan, Cabang, Departemen, Posisi), Workflow, Dokumen, Karyawan, Kalender Kerja (Kalender, Formula Shift, Hari Libur), Cuti, dan Offboarding.

Anda **tidak** melihat: Payroll, Benefit, Rekrutmen, Kinerja, LMS, Laporan, Aset, dan grup menu Administrasi.

## Mulai

1. Masuk di http://localhost:5173. Ganti tema dan bahasa dari topbar (ikon matahari/bulan; sakelar ID | EN). Bila Anda punya akses lebih dari satu perusahaan, ganti lewat chip perusahaan di kiri topbar.
2. Dashboard persona manager menampilkan: kartu **Aksi cepat** (Persetujuan Tim, Kehadiran, Ajukan Cuti, Slip Gaji Saya), daftar **approval yang menunggu**, saldo cuti pribadi, kartu tim beserta kehadiran hari ini, dan riwayat kehadiran Anda.
3. Sesi berakhir otomatis setelah 15 menit idle (peringatan 60 detik).

## Menyetujui pengajuan tim (inbox approval)

1. Menu **Workflow** → tab **My Approvals**. Setiap kartu menampilkan nama step, template, referensi dokumen, dan level saat ini.
2. Klik **Approve**, **Reject**, atau **Escalate** → muncul kotak komentar (opsional) → **Proses**.
3. Tab **Instances** untuk memonitor semua instance workflow dengan filter status (Semua / PENDING / APPROVED / REJECTED / ESCALATED).

Persetujuan juga bisa dilakukan dari dokumen asalnya:

- **Cuti:** menu **Cuti** → daftar semua pengajuan (filter status + cari nama). Tombol **Approve/Reject** ada di baris berstatus PENDING; klik baris untuk detail — di sana ada timeline workflow, lampiran ("View Document"), dan tombol Approve/Reject bila giliran Anda sebagai approver.
- **Pinjaman:** menu **Pinjaman** → klik pengajuan → kartu **Alur Persetujuan** → **Setujui/Tolak** (muncul bila level saat ini memang role Anda).
- **Perjalanan dinas & klaim:** menu **Perjalanan & Klaim** — sebagai approver Anda melihat pengajuan seluruh perusahaan. Trip "Diajukan" bisa di-**Approve/Reject**; trip disetujui bisa diberi **Cash Advance**; klaim disetujui bisa di-**Reimburse** (Transfer/Payroll).
- **Tukar shift (kepala regu):** Self Service → tab **Tukar Shift** → panel "Approval Kepala Regu" → **Setujui/Tolak**.

## Memantau kehadiran tim

1. Menu **Kehadiran** — sebagai role operasional Anda melihat catatan **semua karyawan** perusahaan aktif, dengan pencarian nama dan filter tanggal/status. Kolom Method menampilkan metode absen dan jarak GPS; badge "Review" menandai absen yang perlu ditinjau (di luar radius).
2. Tombol **Check In** membuka form admin: pilih karyawan, tanggal, jam, metode (mis. Manual untuk input HR), dan catatan — untuk mencatatkan kehadiran atas nama anggota tim.
3. Tombol **Overtime** mencatat lembur: karyawan, tanggal, jam mulai/selesai (durasi terhitung otomatis), alasan.

## Melihat data tim

- **Karyawan:** daftar karyawan (cari, filter departemen/status); klik baris untuk profil lengkap: Overview (identitas, bank, status wajah terdaftar), Detail Profil (keluarga, pendidikan, kontak darurat, training, skill, pengalaman, lampiran), dan Karier (riwayat mutasi/promosi).
- **Organisasi → Struktur Organisasi:** bagan interaktif; klik node untuk melihat pimpinan dan daftar orangnya.
- **Kalender Kerja:** melihat kalender kerja, formula shift, dan hari libur nasional.
- **Dokumen:** repositori dokumen perusahaan/karyawan (unduh).
- **Offboarding:** melihat serta memproses resign anggota tim (Approve/Reject saat status SUBMITTED, Complete setelah clearance selesai).

## Fitur pribadi Anda

Sama persis dengan panduan karyawan: absensi sendiri (termasuk Face Recognition + GPS), ajukan cuti (aturan H-7), izin (lampiran wajib), slip gaji ber-PIN, pinjaman, EWA, aktivitas harian, perjalanan dinas, profil 5 tab, notifikasi. Lihat [employee.md](employee.md).

## Tips

- Setelah menyetujui dari inbox Workflow, dokumen asal (cuti/pinjaman) otomatis mengikuti hasil workflow — tidak perlu approve dua kali.
- Kolom Reference di inbox dapat diklik untuk melompat langsung ke dokumen terkait.
- Gunakan filter tanggal di Kehadiran untuk memeriksa kehadiran tim per hari sebelum menyetujui lembur.

## Batasan saat ini

- **Delegasi approval belum ada UI-nya** — bila Anda cuti, tidak ada cara mendelegasikan inbox ke orang lain dari aplikasi.
- Menu **Laporan tidak tersedia** untuk role Manager; minta laporan ke HR/admin.
- Persetujuan **EWA** dilakukan di halaman khusus di bawah menu Administrasi yang tidak tampil untuk Manager — approval EWA ditangani HR Manager/admin.
- Tidak ada koreksi/edit catatan kehadiran yang sudah tercatat — hanya bisa menambah catatan baru (metode Manual).
- Tidak ada persetujuan lembur di UI; lembur yang dicatat langsung tersimpan.
- Halaman Cuti menampilkan tombol Approve/Reject untuk semua pengajuan PENDING; sistem tetap memvalidasi apakah Anda approver yang berhak saat aksi diproses.
