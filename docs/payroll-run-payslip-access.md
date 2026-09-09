# Scope payroll run, period, payslip dan pembayaran

Fase lanjutan P0, 9 September 2026. Menutup jalur baca/mutasi payroll perusahaan serta akses payslip per pegawai. Ini melanjutkan [scope alokasi gaji dan THR](payroll-salary-read-access.md); seluruh audit payroll belum selesai.

## Kebijakan akses

Satu `PayrollRun` menghitung seluruh company dan menyimpan total perusahaan. Period, konfirmasi attendance dan payment batch juga belum mempunyai batas branch/department tersendiri. Karena itu, endpoint tersebut memerlukan **scope payroll seluruh company aktif**. Scope branch, department, sub-department atau self mendapat **403**, termasuk ketika pengguna mempunyai permission process/approve/disburse. Mengambil sebagian slip lalu tetap menampilkan atau menyetujui total perusahaan tidak diizinkan.

`ALL` dan `COMPANY_ONLY` dibatasi ke company aktif. Kebijakan konfigurasi lama tetap berlaku: jika tidak ada konfigurasi scope yang cocok, resolver memberikan akses dalam company, dengan permission endpoint tetap wajib. Resolver memakai konfigurasi role yang paling membatasi; permission atau role admin tidak membatalkan scope payroll yang dikonfigurasi. `MANAGER_TEAM`, scope tidak dikenal/invalid, aktor/company yang hilang dan kegagalan lookup tidak membuka akses. Error lookup dapat menjadi 403 pada middleware company atau error server dari resolver service; keduanya menghentikan pembacaan payroll.

Scope berasal dari session, company assignment yang divalidasi server, dan konfigurasi database. Query `employeeId`/`branchId` tidak dapat mengubah kewenangan. Company yang memang ditugaskan dapat dipilih melalui boundary company yang sudah ada; service tetap menolak argumen company atau actor yang berbeda dari konteks aktif. Pergantian company tidak memperluas pencarian ke seluruh company assignment sekaligus.

## Matriks endpoint

Semua path memakai prefix `/api/v1/payroll` dan memerlukan autentikasi serta company assignment yang valid.

| Endpoint | Permission | Scope dan hasil |
| --- | --- | --- |
| `GET /runs`, `GET /runs/:id` | `payroll:read` | Seluruh company. List berisi company aktif; ID di luar company/parent period yang valid menghasilkan 404. |
| `POST /runs` | `payroll:process` | Seluruh company. Creator harus aktor session; company harus cocok sebelum transaksi kalkulasi dimulai. |
| `PATCH /runs/:id/approve` | `payroll:approve` | Seluruh company. Creator tidak boleh menjadi checker; conditional update tetap memeriksa company, period, status dan maker-checker. |
| `PATCH /runs/:id/disburse`, `GET /runs/:id/disbursements` | `payroll:disburse` / `payroll:read` | Seluruh company. Jalur lama tetap ditutup dengan 409 sesudah pemeriksaan akses; gunakan payment batch. |
| `GET /periods`, `GET /periods/:id`, `GET /periods/:id/attendance-summary` | `payroll:read` | Seluruh company. Review tidak mengungkap daftar attendance perusahaan kepada scope parsial. |
| `POST /periods` | `payroll:create` | Seluruh company. Company berasal dari konteks yang divalidasi. |
| `PATCH /periods/:id`, `PATCH /periods/:id/close`, `PUT /periods/:id/confirm-attendance` | `payroll:update` | Seluruh company. Query mutasi menyertakan company dan soft-delete; konfirmasi juga memeriksa period belum ditutup. Actor konfirmasi berasal dari session. |
| `GET /payslips/:id` | `payroll:read` | Company + scope employee resource payroll, termasuk branch/department/sub-department/self. Slip di luar scope menghasilkan 404. |
| `GET /payslips` | `payroll:read` | Self-list: employeeId session, diiriskan dengan company + scope payroll. Query employeeId diabaikan; akun tanpa employee mendapat 400 di controller. Service juga menolak identitas self yang berbeda. Tetap maksimal 20 slip terbaru. |
| `POST /payment-batches`, `GET /payment-batches/run/:runId`, `GET /payment-batches/:id`, `POST /payment-batches/:id/export`, `POST /payment-batches/:id/cancel` | `payroll:process` | Seluruh company, diperiksa sebelum service pembayaran dijalankan. |
| `PATCH /payment-batches/:id/transactions/:transactionId`, `POST /payment-batches/:id/reconcile` | `payroll:process` dan `payroll:disburse` | Seluruh company, selain aturan idempotency dan lifecycle ledger yang sudah ada. |

Pemeriksaan scope company dilakukan sebelum middleware audit pada router run/period. Service run/period juga memeriksa konteks untuk pemanggilan langsung. Pada payment batch, guard berada di router bersama autentikasi dan RBAC; service ledger tetap memakai kontrak context internal terpercaya yang eksplisit. Caller internal baru harus menerapkan otorisasi sebelum membentuk context tersebut.

## Predicate dan isi respons

- Payslip dicari dengan company aktif, employee dengan company yang sama dan belum dihapus, predicate scope payroll, serta parent run dan period dengan company yang sama dan belum dihapus. Filter ini berlaku pada detail dan self-list, bukan penyaringan sesudah data dibaca. Scope organisasi mengikuti assignment pegawai saat request, bukan snapshot organisasi pada tanggal payroll.
- Relasi `payrollRun` pada payslip sekarang hanya menyertakan `id`, `name`, `runNumber`, `status`, serta metadata period (`id`, `name`, `code`, `frequency`, `startDate`, `endDate`, `payDate`). Total perusahaan, notes run/period, actor approval dan data slip pegawai lain tidak disertakan lewat relasi ini.
- Detail run memakai query publik tersendiri dengan identitas employee minimal: ID, nama dan nomor pegawai. Rekening tidak diambil oleh query detail run publik. Jalur kalkulasi internal tetap terpisah.
- Nested komponen slip hanya menyertakan master komponen company yang sama. Snapshot historis yang sah tetap tersedia meskipun master komponen sudah nonaktif/dihapus. Perubahan ini tidak menghitung ulang nilai snapshot.
- Detail payslip membaca parent dan bukti dependennya dalam transaksi RepeatableRead. Formula calculations harus cocok dengan company, run dan slip serta master komponen/version dari company yang sama. Benefit deduction harus merujuk enrollment milik employee pada slip dan benefit plan company yang sama. Enrollment pegawai lain atau master company lain tidak ikut terbaca.
- Total run tetap nilai snapshot tersimpan. `_count.payslips` dan daftar slip menghitung/menampilkan child yang lolos predicate parent; jumlahnya dapat berbeda dari `totalEmployees` historis setelah pegawai dihapus atau jika data legacy mempunyai relasi invalid. Data legacy tersebut perlu review, tanpa mengubah total yang sudah disimpan melalui endpoint baca.
- Tidak ada perubahan rumus breakdown, kebijakan status DRAFT/FINALIZED pada self-list, pagination run, format Decimal, atau lifecycle bank. Penerbitan slip kepada pegawai berdasarkan status run tetap membutuhkan kebijakan tersendiri.

Respons run, period, payslip dan payment batch memakai `Cache-Control: no-store`, termasuk error autentikasi/otorisasi/validasi. ID run/slip serta kedua endpoint attendance memakai UUID. List run/period memvalidasi query company; filter pegawai pada list run tidak membuat run menjadi payroll parsial.

## Verifikasi

- `payroll-run-access.mysql.test.ts`: 18 tes pada MySQL nyata dengan konfigurasi scope nyata. Meliputi empat scope parsial, ALL/COMPANY_ONLY, company switch/admin, parent lintas company/soft-delete, bukti formula dan benefit, penolakan mutasi sebelum write, maker-checker, serta konteks request bersamaan.
- `payroll-run-access.routes.test.ts`: 22 tes HTTP. Seluruh 13 jalur run/period ditolak pada scope parsial; autentikasi, permission, no-store, UUID, actor dan self-list diuji.
- `payroll-payment.routes.test.ts`: delapan tes tambahan membuktikan tujuh jalur ledger/export tidak melewati guard dan lookup scope gagal menolak export.
- Fixture kalkulasi/attendance/formula kini memasang konteks aktor server untuk memanggil service. Tes maker-checker memeriksa company/period pada conditional update. Tes mock SUPER_ADMIN payslip diperbaiki untuk memeriksa predicate company aktif dan pergantian company eksplisit.

Jalankan terhadap schema repository pada database sintetis lokal:

```sh
PAYROLL_ACCESS_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand payroll-run-access payroll-payment.routes payroll.maker-checker
```

Suite MySQL menolak host/database di luar database lokal tersebut, dilewati jika environment tidak disediakan, dan membersihkan fixture UUID miliknya sendiri. Hasil gabungan terbaru tersedia di [checklist implementasi](checklist-implementation-status.md).

Tidak ada migration, perubahan schema/UI, atau perubahan database aplikasi. Backlog meliputi histori effective date dan correction run, payroll parsial dengan batas organisasi eksplisit, kebijakan publikasi slip, konsumen gaji pada EWA/lembur/final payroll, audit seluruh laporan dan konfigurasi/formula payroll, serta durable audit. Scope seluruh aplikasi belum dinyatakan selesai.
