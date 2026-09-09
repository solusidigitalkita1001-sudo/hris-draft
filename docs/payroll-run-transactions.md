# Transaksi pembuatan payroll — 9 September 2026

Pembaruan akses 9 September 2026: run, period/review attendance dan seluruh endpoint payment batch memerlukan scope payroll seluruh company aktif, selain permission endpoint. Lihat [matriks scope run/payslip](payroll-run-payslip-access.md) untuk kontrak dan hasil verifikasi terbaru.

`POST /api/v1/payroll/runs` kini menyimpan run, slip seluruh pegawai, komponen slip, snapshot formula/pinjaman, pencatatan potongan EWA, total dan status COMPLETED dalam **satu transaksi database**. Jika salah satu tahap gagal, seluruh penulisan transaksi dibatalkan. Perubahan ini tidak membuat correction run retroaktif.

## Kontrak pembuatan dan request ulang

Endpoint dan body tidak berubah. Permission dan company scope tetap melalui middleware yang ada; identitas pembuat berasal dari session. Service memeriksa company pemilik periode, status periode, serta konfirmasi review attendance di dalam transaksi.

- Keberhasilan mengembalikan 201 dengan run yang sudah COMPLETED.
- Satu periode hanya boleh memiliki satu run biasa yang belum dihapus. Request kedua, termasuk request bersamaan atau retry setelah respons hilang, mendapat 409 beserta ID run yang sudah ada pada pesan error. Buka run tersebut untuk melanjutkan approval; endpoint ini tidak membuat run koreksi kedua.
- Jika kalkulasi atau penyimpanan gagal sebelum commit, tidak ada run/slip baru yang tersisa. Sesudah penyebab kegagalan diperbaiki, request dapat diulang.
- Periode tertutup, attendance belum direview, tidak ada gaji aktif, currency selain IDR, nominal invalid/overflow, dan net pay negatif ditolak. Beberapa alokasi gaji aktif untuk pegawai yang sama juga ditolak agar satu pegawai tidak menerima slip ganda.
- Periode, pegawai pemilik gaji, serta komponen gaji harus berada dalam company run yang sama.

Run legacy yang sudah tersisa dari versi lama tidak dihapus atau ditandai selesai secara otomatis. Keberadaannya menghalangi pembuatan run biasa kedua pada periode yang sama; data tersebut perlu ditinjau melalui prosedur koreksi yang terkontrol. Belum ada endpoint otomatis untuk memperbaiki run legacy tersebut.

## Batas transaksi dan konkurensi

Service memakai transaksi Prisma Serializable, mengunci row company dengan `SELECT ... FOR UPDATE` sampai commit, menunggu koneksi maksimal 10 detik dan membatasi transaksi hingga 60 detik. Konflik serialisasi `P2034` dapat dicoba ulang dua kali; kesalahan bisnis tidak dicoba ulang otomatis.

Lock company sama dengan publikasi formula. Karena itu, nomor run tidak bertabrakan saat periode berbeda dihitung bersamaan, dan publikasi formula tidak bisa menyela pembacaan versi di tengah run. Request periode sama diserialisasi sebelum memeriksa keberadaan run. Ini merupakan proteksi jalur service; belum ada unique constraint baru atau jaminan terhadap penulisan SQL langsung di luar aplikasi.

Pembacaan alokasi gaji, versi formula, attendance, cuti, lembur, kalender, konfigurasi company, pinjaman dan EWA menggunakan transaction client yang sama. Seluruh pembuatan komponen sistem, slip, snapshot dan pembaruan EWA/totals juga memakai client tersebut. Repository yang dipakai modul lain tetap dapat memakai client default saat dipanggil tanpa transaction client.

Event `PAYROLL_RUN_CREATED` diterbitkan setelah commit. Jika penerbitan event gagal, payroll yang sudah tersimpan tetap dikembalikan sebagai hasil sukses dan kegagalannya dicatat tanpa nominal gaji. Pengiriman event belum memakai transactional outbox; jaminan pengiriman ulang setelah proses mati masih merupakan backlog operasional.

## Potongan EWA dan pinjaman

Bug sebelumnya: hasil agregasi EWA memiliki `ewaId`, tetapi payroll membaca `id` melalui `any`. Nominal dapat muncul sebagai potongan tanpa mengaitkan transaksi EWA dengan run. Jalur payroll kini memakai row EWA bertipe dan menghapus agregasi melalui type escape tersebut.

Nominal potongan menggunakan `amountPaidOut`; untuk record legacy bernilai null, fallback ke `amountRequested` tetap dipertahankan. Nilai negatif atau melebihi kapasitas uang ditolak, nilai nol tidak dipotong. EWA tanpa pegawai bergaji aktif tetap PAID karena tidak menghasilkan potongan pada slip.

EWA hanya ditandai DEDUCTED jika masuk slip yang dibuat. Update memeriksa ID, company, employee, status PAID, `payrollRunId` null, dan nominal sumber yang sama dengan saat dibaca. Nominal/status berubah menyebabkan conflict dan rollback seluruh run. Penandaan ini adalah pencatatan potongan, bukan transfer bank baru.

Cicilan yang telah memiliki snapshot potongan tidak dipilih lagi oleh run berikutnya, walaupun status cicilan masih PENDING menunggu rekonsiliasi pembayaran. Snapshot diperlakukan sebagai reservasi potongan. Membatalkan batch pembayaran tidak menghapus reservasi tersebut. Pelepasan/correction snapshot perlu alur terpisah, bukan penghapusan data otomatis.

Pelunasan cicilan tetap terjadi pada rekonsiliasi ledger pembayaran, sebagaimana [payroll-payment-ledger.md](payroll-payment-ledger.md). EWA yang keliru tertinggal PAID atau cicilan dengan snapshot ganda dari versi lama belum diperbaiki otomatis oleh perubahan ini; audit data legacy tetap diperlukan.

## Nominal dan batas yang tersisa

Total run menggunakan Decimal untuk earnings, deductions, dan net pay, dengan validasi kapasitas Decimal(15,2). Tes mencakup penjumlahan `9999999999998.00 + 0.10 + 0.20 = 9999999999998.30` serta overflow yang membatalkan transaksi. Ini tidak berarti semua mesin finansial lama sudah bermigrasi dari number ke Decimal.

Pemilihan gaji masih mengikuti alokasi aktif yang ada; pemilihan histori gaji berdasarkan effective date belum tersedia. [Mutasi alokasi gaji](payroll-salary-allocations.md) kini memakai lock company yang sama dan menolak perubahan finansial jika alokasi sudah dipakai slip. Cuti lintas periode, kalender organisasi/tahun dan shift kini ditangani pada [fase input attendance](payroll-attendance-inputs.md), tetapi histori assignment dan pembekuan sumber saat review masih terbuka. Correction/retroactive adjustment run, transactional outbox, dan load test untuk company dengan jumlah pegawai besar masih terbuka. Transaksi panjang dapat timeout dan rollback; batas waktu ini bukan hasil benchmark kapasitas produksi.

Tidak ada perubahan schema atau migration baru pada fase transaksi ini. Empat migration dari fase sebelumnya tetap diperlukan untuk schema formula dan ledger. Tidak ada migration atau perubahan data pada database aplikasi, push, maupun deployment.

## Bukti pengujian

`backend/src/modules/payroll/payroll-calculation.mysql.test.ts` berisi 11 tes dengan MySQL nyata. Hanya event bus dan logger yang dimock; repository payroll, formula, EWA, pinjaman, company settings dan kalender memakai database sintetis.

Cakupan: rollback setelah pegawai kedua gagal formula, rollback setelah status EWA dan total sudah ditulis, retry setelah gagal, satu run untuk request bersamaan pada periode sama, nomor run periode berbeda, potongan EWA/cicilan hanya sekali, EWA tanpa gaji aktif, nominal EWA legacy null, konflik nominal usang, Decimal besar/pecahan/overflow, referensi lintas company, salary aktif ganda, currency, periode tertutup/belum direview, payroll kosong, serta penerbitan event sesudah commit.

Jalankan dari direktori backend dengan database lokal sintetis yang bernama persis `hris_payment_integration`:

```sh
PAYROLL_CALCULATION_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand payroll-calculation.mysql
```

Fixture menggunakan UUID miliknya sendiri dan dibersihkan setelah tes. Tanpa environment variable tersebut, suite MySQL dilewati. Suite lengkap pada fase ini: **694 tes backend / 79 suite lulus**, termasuk 11 tes kalkulasi, tujuh formula, tiga ledger, dan advisory lock MySQL. Typecheck/build backend lulus; lint backend 0 error dan 827 warning. Hasil frontend terakhir tidak diulang karena source frontend tidak berubah pada fase ini.
