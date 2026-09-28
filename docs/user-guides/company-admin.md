# Panduan Company Admin (COMPANY_ADMIN)

Untuk administrator satu perusahaan: kelola pengguna & akses, struktur organisasi dan kebijakan absensi cabang, siklus payroll (persetujuan & pembayaran), benefit, audit trail, serta seluruh operasional HR perusahaan aktif.

**Akun demo:** rudi@tech.com / Employee123!

## Menu yang Anda lihat

Semua menu karyawan + operasional (Organisasi, Workflow, Dokumen, Karyawan, Kehadiran, Kalender Kerja, Cuti, Offboarding) **ditambah**: Payroll, Benefit, Kinerja, LMS, Laporan, dan grup **Administrasi**: **Pengguna, Role, Audit Log, Workflow Templates, Approval Tarik Gaji, Monitoring Aktivitas, Pengaturan**.

Anda **tidak** melihat: Rekrutmen (wewenang HR Manager/Group Admin), Aset, Metode Absensi (khusus Super Admin), serta Menu Access dan Data Scope (butuh hak ubah RBAC — Group Admin/Super Admin).

## Mulai

1. Masuk di http://localhost:5173; tema/bahasa lewat topbar (sakelar ID | EN kini mengganti seluruh halaman, termasuk format tanggal); pilih perusahaan aktif dari chip di kiri topbar bila akses Anda mencakup beberapa perusahaan. Akun demo rudi@tech.com hanya tercakup di **PT Teknologi Maju**, jadi chipnya berisi satu pilihan — perusahaan kedua (**PT Digital Nusantara**, kode DIGI) dalam grup yang sama hanya terlihat oleh role berskala grup (Group Admin/Super Admin).
2. Dashboard persona admin: statistik perusahaan, kartu **Approval Menunggu** (judul dokumen + nama pengaju + satu baris ringkas per pengajuan), kartu **Administrasi** (Pengguna, Role & Izin, Audit Log, Workflow, Laporan, Pengaturan), analitik headcount/turnover, kehadiran 90 hari, aktivitas terbaru.
3. Sesi berakhir otomatis setelah 15 menit idle (peringatan 60 detik); server menolak sesi idle >30 menit.

## Mengelola pengguna & role

1. **Administrasi → Pengguna**: cari pengguna; **Add User** (email, kata sandi min. 8 karakter, tautan ke data karyawan, status). Pengguna baru otomatis mendapat role EMPLOYEE.
2. **Ubah role:** Edit pengguna → panel **Roles** → centang role yang diinginkan (minimal satu) → simpan.
3. **Administrasi → Role**: melihat role dan izinnya (role sistem hanya-baca). Pembuatan role custom dan pengubahan permission membutuhkan hak RBAC yang lebih tinggi (Group/Super Admin).
4. Hapus pengguna dari daftar bila diperlukan (konfirmasi).

## Struktur organisasi & kebijakan absensi cabang

1. **Organisasi**: kelola Perusahaan, Cabang, Departemen, Posisi (kode selalu dibuat otomatis); Struktur Organisasi menampilkan bagan interaktif.
2. **Kebijakan absensi cabang:** Organisasi → **Cabang** → ikon **Policy Attendance** di kartu cabang:
   - **Metode:** Fingerprint · Mobile GPS · Fingerprint + GPS · **Face Recognition** · **Face Recognition + GPS** · Manual (bawaan sebelum policy diatur).
   - **Geofence:** radius meter + koordinat (kosongkan untuk memakai koordinat cabang).
   - **Aksi di luar radius:** Tolak / Terima & tandai / Terima & review.
   - Toleransi terlambat & pulang cepat (menit), serta sakelar: policy aktif, wajib kirim lokasi, wajib selfie, izinkan luar radius, izinkan hari libur/akhir pekan, auto absent, auto checkout.
3. Metode yang tampil saat karyawan check-in = kebijakan cabang **dipadukan** izin metode per karyawan (matriks per karyawan diatur Super Admin).
4. Pastikan karyawan yang memakai Face Recognition sudah **didaftarkan wajahnya** dari halaman detail karyawan (kartu Profil face recognition → Daftarkan wajah, satu foto frontal JPEG/PNG maks 5MB).

## Siklus payroll (periode → run → payslip)

1. **Payroll → Salary Components:** kelola komponen tunjangan/potongan (FIXED atau PERCENTAGE). Tombol **Formula** per komponen membuka panel formula terjadwal: tulis ekspresi (variabel gaji dasar, hari kerja/hadir/cuti/absen, jam lembur), **jalankan simulasi**, lalu **publikasikan** — publikasi harus dilakukan pengguna lain yang punya hak persetujuan payroll (pemisahan tugas).
2. **Payroll Periods:** buat periode (frekuensi, tanggal mulai/akhir, tanggal bayar); tutup periode yang selesai (**Close Period**).
3. **Payroll Runs → New Run:** pilih periode, beri nama, buat — **slip dihitung otomatis saat run dibuat**. Server mensyaratkan kehadiran periode sudah dikonfirmasi; bila belum, pembuatan run ditolak dengan pesan yang menjelaskannya.
4. **Approve Payroll** di detail run (status COMPLETED). Aturan pemisahan tugas: **pembuat run tidak bisa menyetujui run-nya sendiri**.
5. **Pembayaran:** setelah APPROVED, panel Pembayaran payroll: **Buat daftar pembayaran** → **Siapkan file bank** (unduh CSV per bank berisi rekening — jaga kerahasiaannya) → **Catat hasil** per karyawan (dibayar + nominal + referensi bank, atau gagal + alasan) → **Rekonsiliasi pembayaran** setelah semua cocok (menyelesaikan payroll dan melunasi cicilan pinjaman yang dipotong). Pencatatan/rekonsiliasi harus pengguna berbeda dari pemberi persetujuan dan membutuhkan hak pencairan.
6. **Payslip:** klik baris slip untuk detail (jejak perhitungan formula, rincian pendapatan/potongan, ringkasan absensi) — Print atau unduh PDF.

> Catatan hak akses: dengan izin bawaan, Company Admin dapat **melihat, menyetujui, dan meng-export** payroll. Pembuatan run (hak proses) dan pencatatan pembayaran (hak pencairan) bawaannya ada di Group Admin/Super Admin — sesuaikan permission role bila perusahaan Anda ingin Company Admin menjalankan semuanya.

## Persetujuan & monitoring

- **Workflow** (inbox My Approvals; Approve/Reject/Escalate, komentar opsional). Setiap kartu inbox memuat **ringkasan dokumen**: judul ("Pengajuan Cuti", "Pengajuan Pinjaman", …), **nama pengaju + NIK**, baris fakta sesuai jenis dokumen (cuti: jenis/periode/durasi/alasan · pinjaman: jumlah/tenor · lembur: tanggal/durasi · trip: tujuan/periode/biaya · dst.), tahap + level, tanggal diajukan, dan nama template. Dokumen yang tak terbaca tampil sebagai *"Rincian dokumen tidak tersedia — buka modul terkait untuk memeriksa."*
- **Administrasi → Workflow Templates** (kelola template + bulk approval + kolom Reference yang bisa diklik ke dokumen). Tabel di sini **belum memakai ringkasan** — masih menampilkan ID pengguna dan referensi mentah, jadi bacalah isi pengajuan dari inbox Workflow.
- **Approval Tarik Gaji (EWA):** Approve/Reject pengajuan, **Mark Paid** dengan nominal + nomor bukti transfer, lihat detail lengkap.
- **Monitoring Aktivitas:** aktivitas harian lapangan seluruh karyawan + validasi geofence; lihat detail atau hapus.
- **Cuti / Pinjaman / Perjalanan & Klaim:** persetujuan langsung dari dokumen, sama seperti panduan HR Manager.
- **Audit Log:** **Administrasi → Audit Log** — filter aksi/entity/IP/tanggal, klik **Detail** untuk melihat nilai lama vs baru (JSON) dan metadata (user, IP, user agent), tombol **Export** mengunduh CSV sesuai filter.

## Benefit, kinerja, LMS, laporan

- **Benefit:** buat/edit plan (tipe, provider, kontribusi karyawan/perusahaan, status aktif) dan lihat peserta per plan.
- **Kinerja** dan **LMS:** kelola siklus review dan kursus pelatihan.
- **Laporan:** 6 tab (Headcount, Attendance, Leave, Payroll, Turnover, Recruitment), semuanya bisa **Export CSV**.

## Fitur pribadi Anda

Akun admin yang tertaut data karyawan tetap punya semua fitur self-service (absen, cuti dengan **validasi saldo saat submit**, slip gaji ber-PIN, dst.) — lihat [employee.md](employee.md).

## Tips

- Terapkan pemisahan tugas dengan sadar: pembuat run ≠ penyetuju ≠ pencatat pembayaran; formula gaji juga dipublikasikan orang kedua.
- Simpan file CSV bank di tempat terbatas — berisi nomor rekening lengkap.
- Setelah menutup periode payroll, run baru tidak bisa dibuat untuk periode itu.

## Batasan saat ini

- Halaman **Pengaturan** (Administrasi → Pengaturan) masih placeholder — tombol Save belum menyimpan apa pun.
- **Menu Access** dan **Data Scope** tidak tersedia untuk role ini (butuh hak ubah RBAC).
- Tidak ada UI konfirmasi kehadiran periode payroll — bila pembuatan run ditolak karena kehadiran belum dikonfirmasi, proses konfirmasi harus dilakukan di luar UI saat ini.
- Tidak ada reset kata sandi pengguna dari halaman Pengguna (field kata sandi nonaktif saat edit); tidak ada reset PIN slip gaji oleh admin.
- Pembatalan (void) payroll run tidak tersedia di UI.
- Rekrutmen dan Aset tidak tampil untuk role ini dengan izin bawaan.
- **Tidak ada UI untuk menetapkan/menyesuaikan saldo cuti** karyawan atau menjalankan akrual tahunan, padahal alokasi saldo kini prasyarat pengajuan cuti (endpointnya ada di server, halamannya belum).
- **Saldo cuti baru dipotong saat approval** — pengajuan Pending belum menahan saldo, jadi beberapa pengajuan (rentang tanggal berbeda) bisa lolos submit meski totalnya melebihi sisa; yang disetujui terakhir ditolak server.
- **Delegasi approval belum ada UI-nya** — tidak ada cara mengalihkan inbox approval ke orang lain dari aplikasi.
