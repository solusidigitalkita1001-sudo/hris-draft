# Pemberitahuan slip gaji lewat email

Keputusan organisasi (GAP-13, 30 September 2026): karyawan mendapat **email
berisi tautan aman**, dan membuka slipnya **tetap meminta PIN**.

## "Aman" di sini berarti tautannya tidak membawa kredensial apa pun

Ini bagian yang mudah salah, jadi disebut terang-terangan: email hanya memuat
**deep link** ke Self Service. Tidak ada token, tidak ada tanda tangan, tidak
ada apa pun yang bisa dipakai untuk membuka slip hanya dengan mengklik. Membaca
slip tetap butuh masuk ke aplikasi lalu memasukkan PIN slip gaji.

Token sekali-klik di dalam kotak masuk akan menjadikan **akses email = akses
slip gaji**, dan itu justru yang ingin dicegah oleh gerbang PIN. Kotak masuk
sering dibagi, tersinkron ke ponsel pribadi, atau terbaca di layar yang dilihat
orang lain.

Konsekuensi yang perlu diketahui: karyawan yang lupa kata sandinya tidak bisa
langsung melihat slip dari email — ia melewati alur lupa kata sandi lebih dulu.
Itu pertukaran yang disengaja.

## Tidak ada nominal di email

Sama seperti notifikasi in-app: emailnya hanya mengatakan slip sudah tersedia
dan periode mana. Nominal yang sudah masuk kotak masuk tidak bisa ditarik
kembali, sementara di dalam sistem ia masih dilindungi PIN, audit, dan scope.

Ada test yang memakukan ini: badan email diperiksa agar tidak memuat deretan
angka sepanjang uang, kata `Rp`, maupun istilah seperti "netto"/"gaji bersih".

## Opt-in per perusahaan

Mati sampai diminta. Aktifkan lewat company setting:

| Key | Nilai |
|---|---|
| `payslip_email_notification_enabled` | `'true'` untuk mengaktifkan; nilai lain (termasuk `'TRUE'`, `'1'`, kosong) dianggap tidak aktif |

Mengirim email slip gaji ke seluruh karyawan mengubah apa yang keluar dari
sistem, jadi itu keputusan tenant — bukan konsekuensi deploy. Disiplinnya sama
dengan `benefit_payroll_deduction_enabled` dan
`unpaid_leave_deduction_enabled`.

Selain itu, pengiriman hanya jalan bila SMTP memang dikonfigurasi
(`SMTP_ENABLED=true`). Tujuan tautannya diatur oleh `PAYSLIP_SELF_SERVICE_URL`
(default `http://localhost:5173/my-payslips`) — arahkan ke domain aplikasi
produksi saat memasangnya.

## Kegagalan email tidak boleh membatalkan apa pun

Email dikirim setelah run **disetujui** dan slip sudah terlihat di Self Service.
Karena itu setiap kegagalan per penerima dicatat lalu ditelan: server SMTP yang
lambat atau mati tidak boleh membatalkan persetujuan payroll yang sudah sah.
Yang gagal muncul di log sebagai peringatan dengan jumlahnya, supaya tidak
hilang tanpa jejak.

Karyawan tanpa akun aktif tidak dikirimi apa pun — in-app maupun email — karena
tidak ada tempat untuk memberitahunya.

Diverifikasi: 7 test bentuk pesan (termasuk escaping nama periode dan larangan
nominal) dan 10 test pengiriman (gerbang opt-in, kegagalan SMTP yang tidak
merusak, karyawan tanpa akun, run tanpa slip).
