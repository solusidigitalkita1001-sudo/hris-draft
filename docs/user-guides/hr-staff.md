# Panduan Staf HR (HR_STAFF)

Untuk staf HR operasional: mengelola data induk karyawan, mendaftarkan wajah untuk absensi, memonitor kehadiran, mengelola dokumen, dan memproses administrasi harian. Role ini fokus pada input/monitoring — persetujuan berjenjang dan payroll berada di HR Manager/admin.

**Akun demo:** rina@tech.com / Employee123!

## Menu yang Anda lihat

Semua menu karyawan (Dashboard, Self Service, Slip Gaji Saya, Pinjaman, Tarik Gaji Awal, Aktivitas Harian, Perjalanan & Klaim, Kehadiran) **ditambah**: Organisasi (Struktur Organisasi, Grup Perusahaan, Perusahaan, Cabang, Departemen, Posisi), Workflow, Dokumen, Karyawan, Kalender Kerja, Cuti, dan Offboarding.

Anda **tidak** melihat: Payroll, Benefit, Rekrutmen, Kinerja, LMS, Laporan, Aset, dan grup Administrasi.

## Mulai

1. Masuk di http://localhost:5173; atur tema/bahasa dari topbar; pilih perusahaan aktif bila punya akses lebih dari satu.
2. Dashboard persona HR menampilkan statistik tenaga kerja (total karyawan, departemen, hadir hari ini, sedang cuti), kartu approval menunggu, analitik headcount & turnover, kehadiran 90 hari, aktivitas terbaru, dan aksi cepat **Kelola HR** (Karyawan, Kehadiran, Cuti, Payroll — tombol Payroll akan ditolak karena role Anda tidak punya aksesnya).
3. Sesi berakhir otomatis setelah 15 menit idle (peringatan 60 detik).

## Mengelola data karyawan

1. Menu **Karyawan** — cari, filter departemen dan status (ACTIVE/PROBATION/RESIGNED/TERMINATED/CONTRACT_END).
2. **Tambah:** tombol **Add Employee** → isi tiga bagian: data pribadi (nomor karyawan dibuat otomatis oleh sistem), organisasi & kepegawaian (departemen, posisi, cabang, tipe kerja, kategori — kategori **FACTORY** memunculkan pilihan Formula Shift + tanggal mulai shift), serta bank & pajak (bank, rekening, NPWP, BPJS).
3. **Import massal:** tombol **Import CSV** → unggah file CSV → sistem melaporkan jumlah baris berhasil/dilewati beserta error.
4. **Export:** tombol **Export CSV** mengunduh daftar karyawan mengikuti filter aktif.
5. **Detail karyawan** (klik baris): tiga area — **Overview** (identitas, bank/pajak, snapshot karier), **Detail Profil** (7 tab: Tanggungan Keluarga, Pendidikan, Kontak Darurat, Riwayat Training, Daftar Skill, Pengalaman Kerja, Lampiran), dan **Karier** (riwayat + tombol Tambah transaksi karier: promosi/demosi/mutasi/transfer/rotasi/penugasan sementara/perubahan status, dengan nomor SK dan tanggal efektif).

## Mendaftarkan wajah karyawan (enrollment Face Recognition)

1. Buka detail karyawan → Overview → kartu **Profil face recognition**.
2. Klik **Daftarkan wajah** → pilih/ambil **satu foto frontal** (JPEG/PNG, maks 5MB, pencahayaan jelas; di ponsel langsung membuka kamera depan).
3. Status berubah menjadi "Wajah sudah terdaftar" — hanya template biometrik yang disimpan (terenkripsi), foto sumber tidak.
4. Gunakan **Daftarkan ulang** bila wajah berubah signifikan, atau **Hapus profil** untuk mencabut (karyawan tidak bisa absen Face Recognition sampai didaftarkan ulang).

## Memonitor kehadiran

1. Menu **Kehadiran** — catatan semua karyawan perusahaan aktif; cari nama, filter tanggal dan status. Perhatikan badge **Review** (absen di luar radius yang perlu ditinjau) dan kolom Method + jarak GPS.
2. **Input manual:** tombol **Check In** → pilih karyawan, tanggal, jam, metode (gunakan Manual untuk input HR), catatan.
3. **Catat lembur:** tombol **Overtime** → karyawan, tanggal, jam mulai/selesai, alasan.
4. Aktivitas harian lapangan dipantau HR Manager/admin dari menu Administrasi; Anda dapat menandai aktivitas selesai dari halaman Aktivitas Harian bila diminta.

## Cuti dan izin karyawan

- Menu **Cuti** menampilkan seluruh pengajuan cuti perusahaan (filter status, cari nama, kartu ringkas Pending/Approved). Klik baris untuk detail: periode, alasan, **lampiran** ("View Document"), dan timeline workflow persetujuan.
- Peran Anda di sini adalah **memantau**; keputusan approve/reject dijalankan approver pada workflow (atasan/HR Manager). Tombol Approve/Reject yang tampil akan divalidasi server sesuai kewenangan.

## Dokumen dan organisasi

- **Dokumen:** unggah dokumen perusahaan/karyawan (tombol Upload; wajib pilih kategori), pantau dokumen yang akan/telah kedaluwarsa (tab Semua/Expiring/Expired), unduh.
- **Organisasi:** lihat struktur organisasi, cabang (termasuk ringkasan kebijakan absensi per cabang), departemen, posisi. Perubahan struktur menjadi wewenang admin.
- **Kalender Kerja:** lihat kalender kerja, formula shift, dan hari libur sebagai referensi jadwal.
- **Offboarding:** catat pengunduran diri baru (**New Resignation**: ID karyawan, tanggal resign, alasan) dan pantau progres exit clearance per departemen.

## Fitur pribadi Anda

Sama dengan panduan karyawan: absensi sendiri, cuti (H-7), izin (lampiran wajib), slip gaji ber-PIN, pinjaman, EWA, perjalanan dinas, profil 5 tab. Lihat [employee.md](employee.md).

## Tips

- Nomor karyawan, kode organisasi, dan kode-kode lain selalu dibuat otomatis oleh sistem — biarkan kolomnya kosong.
- Sebelum karyawan pabrik mulai absen shift, pastikan kategori FACTORY + formula shift sudah diisi di form karyawan.
- Setelah menambah karyawan, langsung daftarkan wajahnya bila cabang memakai metode Face Recognition.

## Batasan saat ini

- Role ini **tidak dapat mengakses payroll, laporan, rekrutmen, kinerja, LMS, dan benefit** — semuanya di HR Manager/admin.
- Persetujuan cuti/kehadiran/EWA bukan wewenang HR Staff; server menolak aksi approve meski tombolnya terlihat di beberapa halaman.
- Form tambah/edit karyawan belum menampilkan pesan kesalahan bila penyimpanan gagal — bila halaman tidak berpindah setelah Simpan, periksa kembali isian wajib.
- Form resign memakai input ID karyawan manual (belum berupa pilihan nama).
- Tidak ada edit/hapus catatan kehadiran dan tidak ada export di halaman Kehadiran.
- Pengelolaan kalender kerja (buat/ubah) butuh izin lebih tinggi; akses Anda efektif hanya melihat.
