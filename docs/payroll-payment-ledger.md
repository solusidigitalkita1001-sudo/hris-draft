# Payroll: ekspor bank dan rekonsiliasi manual

Implementasi 8 September 2026. Fitur ini **tidak mengirim pembayaran ke bank**. `PAID` berarti petugas sudah mencatat bukti pembayaran; `RECONCILED` berarti seluruh catatan cocok dengan snapshot nominal dan payroll berhasil diselesaikan.

## Alur

1. Pembuat menghasilkan payroll. Pengguna berbeda menyetujui run berstatus `COMPLETED`.
2. Buat daftar pembayaran dari run `APPROVED`. Nominal, pegawai, rekening, dan riwayat pembuat/pemberi persetujuan disimpan sebagai snapshot. Satu run memiliki maksimal satu batch.
3. Ekspor file bank. Hanya transaksi yang belum berstatus `PAID` masuk file. Ekspor tidak mengubah payroll menjadi `DISBURSED` dan tidak melunasi cicilan.
4. Petugas memproses file melalui kanal bank, memeriksa hasil di bank, lalu mencatat hasil setiap transaksi. Pemberi persetujuan payroll tidak boleh mencatat atau merekonsiliasi pembayaran run tersebut.
5. `PAID` memerlukan nominal desimal yang persis sama dengan snapshot serta referensi bank yang unik dalam company. `FAILED` memerlukan alasan dan dapat dicatat ulang setelah pemeriksaan bank. Catatan `PAID` tidak dapat diedit.
6. Setelah seluruh transaksi dibayar dengan nominal cocok, rekonsiliasi mengubah batch menjadi `RECONCILED`, payroll menjadi `DISBURSED`, dan melunasi **hanya cicilan yang dibekukan pada slip** dalam satu transaksi database. Jika cicilan berubah, sudah dibayar, saldo tidak cocok, atau slip berubah, seluruh rekonsiliasi rollback.

State batch: `DRAFT`, `EXPORTED`, `PROCESSING`, `PAID`, `PARTIALLY_FAILED`, `FAILED`, `RECONCILED`, `CANCELLED`. Persetujuan berada pada PayrollRun; state `SUBMITTED` tidak digunakan karena belum ada koneksi bank.

## Kontrak API

Prefix mengikuti aplikasi; default `/api/v1/payroll/payment-batches`. Seluruh endpoint memerlukan session, company yang tervalidasi dan permission `payroll:process`. Pencatatan hasil dan rekonsiliasi juga memerlukan `payroll:disburse`, mempertahankan pembatasan pencairan sebelumnya. Body/query tidak menentukan identitas aktor atau company.

| Method dan path | Input | Hasil |
| --- | --- | --- |
| `POST /` | `{ "runId": "uuid" }` | Snapshot batch baru |
| `GET /run/:runId` | UUID run | Batch tersamarkan atau `null` |
| `GET /:id` | UUID batch | Batch tersamarkan |
| `POST /:id/export` | `{}` | `{ batch, mode: "MANUAL_BANK_FILE_EXPORT", paymentSubmitted: false, groups }` |
| `PATCH /:id/transactions/:transactionId` | `{ "status": "PAID", "amount": "1000.10", "bankReference": "referensi-bank" }` | Batch setelah pencatatan |
| `PATCH /:id/transactions/:transactionId` | `{ "status": "FAILED", "failureReason": "alasan" }` | Batch setelah pencatatan |
| `POST /:id/reconcile` | `{}` | Batch setelah rekonsiliasi |
| `POST /:id/cancel` | `{}` | Batch setelah pembatalan |

Semua mutasi kecuali export memerlukan header `Idempotency-Key` berisi 16–128 karakter ASCII terlihat tanpa spasi. Gunakan key yang sama saat mengulang request dengan payload dan aktor sama setelah timeout. Payload/aktor berbeda dengan key lama menghasilkan conflict. Key, perubahan status dan log dikomit bersama. GET mengembalikan kondisi terbaru; response replay mempertahankan hasil request awal.

Response menggunakan envelope aplikasi `data`. Nominal pada DTO ledger adalah **string desimal**, maksimal 13 digit utuh dan dua desimal; jangan mengirim angka JSON atau string berformat ribuan. Rekening, pemilik rekening dan referensi bank disamarkan pada metadata/UI. Isi CSV memuat rekening lengkap dan hanya tersedia melalui export terotorisasi dengan `Cache-Control: no-store`.

Endpoint lama `PATCH /payroll/runs/:id/disburse` dan `GET /payroll/runs/:id/disbursements` mengembalikan conflict yang mengarahkan client ke batch ledger. Metadata detail run biasa tidak lagi menyertakan rekening pegawai.

## Migration dan kompatibilitas

Urutan migration:

1. `20260907120000_payroll_run_creator`: `created_by` nullable untuk data lama, wajib diisi dari session saat create baru.
2. `20260908100000_payroll_payment_ledger`: batch, transaksi, log, idempotency operation dan snapshot cicilan.
3. `20260908110000_salary_component_company_code`: kode komponen gaji unik per company; kode otomatis yang sama dapat dipakai company berbeda.

SQL rollback manual tersedia di `docs/migrations`. Uji deployment harus menggunakan backup dan staging sesuai lingkungan tujuan. Rollback database tidak membatalkan pembayaran di bank. Rollback uniqueness global ditolak bila kode sudah dipakai lebih dari satu company; jangan menghapus atau mengganti kode otomatis secara diam-diam.

Pembuat payroll lama tidak ditebak atau diisi dari approver. Run tanpa riwayat maker-checker valid tidak bisa dibuatkan batch. Run lama yang memiliki potongan pinjaman tanpa snapshot memerlukan tinjauan/migrasi data terkontrol sebelum rekonsiliasi. Belum ada layar administrasi untuk proses peninjauan legacy tersebut.

Pembatalan hanya tersedia sebelum ada catatan pembayaran berhasil. Batch yang dibatalkan bersifat terminal; membuat batch pengganti pada run yang sama belum didukung. Pastikan tidak ada pembayaran sukses atau tertunda di bank sebelum membatalkan atau mengirim ulang file.

Template CSV belum disertifikasi terhadap spesifikasi impor setiap bank. Idempotency melindungi pencatatan aplikasi; pengiriman ulang file di kanal bank tetap membutuhkan pemeriksaan transaksi di bank. Formula payroll, koreksi pembayaran yang sudah tercatat, dan rekonsiliasi otomatis dari bank belum tersedia.

## Verifikasi

- Unit/HTTP contract: validasi, actor/company, pembuat/pemberi persetujuan, masking, snapshot bank, retry, duplikasi key/ref, mismatch, kegagalan sebagian, dan rollback.
- MySQL nyata: request create/payment konkuren, satu rekonsiliasi berhasil, potongan snapshot sekali, installment di luar snapshot tetap pending, rollback status/key/log dan company asing.
- Frontend: bukti pembayaran serta key dipertahankan setelah gagal, konfirmasi rekonsiliasi, checker read-only, dan error lookup tidak dianggap daftar kosong.
- Review Chromium desktop/ponsel memakai fixture sintetis, tanpa halaman meluber dan dengan input nominal desimal valid. Ini belum E2E aplikasi dengan session/database/bank nyata.

Jalankan test MySQL hanya pada schema lokal terpisah bernama `hris_payment_integration` yang sudah bermigrasi, dengan `PAYROLL_PAYMENT_DB_URL` disetel. Test membuat dan menghapus fixture miliknya sendiri; URL selain localhost dan nama database tersebut ditolak.
