# Panduan HR Manager (HR_MANAGER)

Untuk pimpinan HR: seluruh operasional HR (karyawan, kehadiran, cuti, kalender kerja), persetujuan berjenjang, rekrutmen, kinerja, pelatihan, laporan + export CSV, konfigurasi workflow, persetujuan EWA, dan akses baca payroll.

**Akun demo:** dewi@tech.com / Employee123!

## Menu yang Anda lihat

Semua menu karyawan + operasional (Organisasi, Workflow, Dokumen, Karyawan, Kehadiran, Kalender Kerja, Cuti, Offboarding) **ditambah**: Payroll, Benefit, Rekrutmen (Lowongan, Kandidat, Pipeline, Interview), Kinerja (Dashboard, Cycle, Review, Target), LMS, Laporan, serta grup **Administrasi** berisi: **Workflow Templates**, **Approval Tarik Gaji**, dan **Monitoring Aktivitas**.

Anda **tidak** melihat: Aset, Metode Absensi (khusus Super Admin), dan item Administrasi lain (Pengguna, Role, Audit Log, Menu Access, Data Scope, Pengaturan — wewenang Company/Group Admin).

## Mulai

1. Masuk di http://localhost:5173; tema/bahasa lewat topbar; pilih perusahaan aktif bila lebih dari satu.
2. Dashboard persona HR: statistik tenaga kerja, approval menunggu, aksi cepat **Kelola HR** (Karyawan, Kehadiran, Cuti, Payroll), analitik headcount & turnover, kehadiran 90 hari, aktivitas terbaru.
3. Sesi berakhir otomatis setelah 15 menit idle (peringatan 60 detik).

## Persetujuan (inbox workflow)

1. Menu **Workflow** → tab **My Approvals**: Approve / Reject / Escalate per item, komentar opsional.
2. Alternatif massal: **Administrasi → Workflow Templates** → tab **My Approvals**: centang beberapa pengajuan → **Bulk Approve / Bulk Reject**; klik kolom Reference untuk melompat ke dokumen (cuti, pinjaman, trip, klaim, tukar shift, lembur).
3. Persetujuan juga tersedia langsung di dokumen: daftar/detail **Cuti** (lihat lampiran lewat "View Document"), detail **Pinjaman** (kartu Alur Persetujuan), halaman **Perjalanan & Klaim** (approve trip/klaim, catat Cash Advance, proses Reimburse Transfer/Payroll).

## Mengonfigurasi workflow persetujuan

1. **Administrasi → Workflow Templates** → tab **Approval Templates**.
2. **New Template**: pilih Approval Type (LEAVE_REQUEST, LOAN_REQUEST, BUSINESS_TRIP, EXPENSE_CLAIM, SHIFT_SWAP, OVERTIME_REQUEST, atau custom), resource, lalu susun **stage** berjenjang: nama stage, tipe approver (Role/User/Auto), role approver + role cadangan, SLA jam, izinkan eskalasi, dan condition rules (mis. hanya aktif bila totalDays > 3). Urutan stage bisa dinaik-turunkan.
3. Template bisa di-**Edit**, **Duplicate** (salinan nonaktif), atau **Delete**.

## Persetujuan Tarik Gaji Awal (EWA)

1. **Administrasi → Approval Tarik Gaji**: daftar pengajuan EWA semua karyawan (cari nama/NIK, filter status).
2. Baris PENDING: **Approve** (catatan opsional) atau **Reject** (alasan wajib, min. 3 karakter). **Detail** menampilkan periode gaji, fee, dan riwayat.
3. Penandaan **Mark Paid** (pencatatan bukti transfer) membutuhkan hak pencairan — umumnya dilakukan Company Admin.

## Rekrutmen

1. **Rekrutmen → Lowongan**: buat job posting (New Posting), pantau status DRAFT → PUBLISHED → CLOSED/FILLED.
2. **Kandidat**: kelola talent pool dan tambah kandidat.
3. **Pipeline**: papan New → Screening → Interview → Offer → Hired (plus Rejected/Withdrawn); geser stage atau tolak langsung dari kartu.
4. **Interview**: jadwalkan dan kelola wawancara.

## Kinerja, LMS, Benefit

- **Kinerja**: konfigurasi metode/periode/library/workflow review, buat siklus review, planning target (OKR), eksekusi self-review & manager-review, lihat hasil.
- **LMS**: buat kursus (New Course), kelola sesi dan pendaftaran peserta.
- **Benefit**: melihat plan benefit dan daftar pesertanya (pembuatan/ubah plan menjadi wewenang admin).

## Payroll (akses baca + export)

- Menu **Payroll**: dashboard ringkasan, Salary Components, Payroll Periods, Payroll Runs, dan slip per karyawan (Print/PDF).
- Role ini dapat **melihat dan mengunduh**, tetapi **tidak membuat run, tidak menyetujui run, dan tidak mencatat pembayaran** — lihat panduan Company Admin/Group Admin untuk siklus penuh.

## Laporan + export CSV

1. Menu **Laporan** — 6 tab: **Headcount, Attendance, Leave, Payroll, Turnover, Recruitment**.
2. Atur rentang tanggal (tab Payroll memakai filter periode payroll; Headcount berupa snapshot terkini).
3. Tombol **Export CSV** tersedia di setiap tab dan mengunduh data sesuai tab aktif.

## Operasional harian lain

Sama seperti HR Staff namun dengan kewenangan penuh: data karyawan (tambah/edit/import/export CSV, transaksi karier), **enrollment wajah** di detail karyawan, monitoring kehadiran + input manual + lembur, **kalender kerja** (buat kalender tahunan, atur hari per tanggal, import CSV hari libur, copy antar tahun, formula shift pabrik, hari libur nasional), dokumen, offboarding (approve/complete + exit clearance), dan **Administrasi → Monitoring Aktivitas** (lihat detail aktivitas lapangan + validasi geofence, hapus laporan).

## Fitur pribadi Anda

Sama dengan panduan karyawan (absensi, cuti H-7, izin, slip gaji ber-PIN, pinjaman, EWA, profil 5 tab). Lihat [employee.md](employee.md).

## Tips

- Gunakan bulk approval di Administrasi → Workflow Templates saat antrean menumpuk; hasil per item dilaporkan (berhasil/gagal).
- Ubah template workflow hanya di luar jam sibuk — instance yang sedang berjalan mengikuti template saat dibuat.
- Sebelum periode payroll dihitung admin, pastikan kehadiran dan cuti bulan berjalan sudah beres — hasil absensi memengaruhi slip.

## Batasan saat ini

- **Delegasi approval belum ada UI-nya** (fitur server sudah ada, tampilannya belum).
- Payroll untuk role ini **read-only** (tidak bisa membuat, menyetujui, atau mencairkan run).
- **Mark Paid EWA** butuh hak pencairan yang tidak dimiliki HR Manager.
- Benefit: tidak ada aksi mendaftarkan karyawan ke plan dari UI — hanya melihat peserta.
- Monitoring Aktivitas tidak memiliki approve/reject — hanya lihat detail dan hapus.
- Halaman Pengguna/Role/Audit/Pengaturan tidak tersedia untuk role ini.
