# Scope akses dan transisi EWA

Fase lanjutan P0, 10 September 2026. List/detail EWA sebelumnya belum memakai scope pegawai secara konsisten, detail memiliki pengecualian company untuk admin, kalkulasi dapat memakai gaji nonaktif, dan update status tidak memeriksa status sebelumnya di database. Fase ini memperbaiki jalur tersebut, melanjutkan [akses payroll run/payslip](payroll-run-payslip-access.md).

## Kontrak otorisasi

Semua endpoint memakai prefix `/api/v1/ewa`, autentikasi, company assignment yang valid dan permission EWA sesuai aksi. Company aktif diteruskan middleware ke request context; service menolak argumen company/actor yang berbeda. Role SUPER_ADMIN/GROUP_ADMIN tidak membatalkan predicate company. Company lain yang memang ditugaskan harus dipilih sebagai company aktif sebelum datanya dibaca.

Predicate Employee menggabungkan **scope resource EWA dan payroll**, company aktif dan soft-delete. Irisan ini diperlukan karena request/limit EWA memuat nilai yang berasal dari gaji. Permission EWA mengizinkan penggunaan data untuk proses EWA; permission `payroll:read` tambahan tidak diwajibkan untuk self-service ini. Tidak ada akses ke seluruh modul payroll hanya karena pengguna mempunyai permission EWA.

Scope branch, department, sub-department dan self berlaku langsung di query database. MANAGER_TEAM, scope invalid, konteks hilang dan kegagalan lookup tidak menghasilkan akses lebih luas. Tanpa konfigurasi pembatas yang cocok, resolver tetap mengikuti default company yang sudah ada. Role HR/finance juga tunduk pada kedua scope tersebut.

| Endpoint | Permission | Batas tambahan |
| --- | --- | --- |
| `GET /` | `ewa:read` | HR/finance dapat membaca pegawai dalam irisan scope; pengguna nonstaf hanya employee session. Filter employee client hanya mempersempit hasil. |
| `GET /:id` | `ewa:read` | Predicate sama dengan list; ID di luar scope/company menghasilkan 404. |
| `GET /my` | `ewa:read` | Employee session, termasuk ketika pemanggil HR/finance. Argumen self yang berbeda ditolak oleh service; query employee tidak menjadi identitas aktor. |
| `GET /my/limit` | `ewa:read` | Employee session dan kedua scope harus cocok sebelum input gaji/attendance dibaca. Akun tanpa employee mendapat 400 di controller atau 403 dari service jika dipanggil langsung. |
| `POST /` | `ewa:create` | HR/admin dapat mengajukan atas nama pegawai dalam scope. Role lain, termasuk finance tanpa role HR, hanya untuk employee session. Employee yang tidak dikirim memakai employee session jika tersedia. |
| `POST /:id/approve` | `ewa:approve` | HR/admin, target dalam scope, status PENDING; employee pemilik request tidak boleh menyetujui requestnya sendiri. |
| `POST /:id/reject` | `ewa:approve` | HR/admin, target dalam scope, status PENDING; larangan self-reject tetap berlaku. Alasan wajib valid. |
| `POST /:id/cancel` | `ewa:update` | Pemilik atau HR/admin dalam scope; hanya PENDING, sesuai kebijakan service yang sudah ada. |
| `POST /:id/mark-paid` | `ewa:disburse` | Finance/admin, target dalam scope, status APPROVED; aktor pencatat wajib sama dengan session. |

Role HR/admin yang digunakan tetap `HR_STAFF`, `HR_MANAGER`, `COMPANY_ADMIN`, `GROUP_ADMIN`, `SUPER_ADMIN`. Role finance/admin tetap `FINANCE_STAFF`, `FINANCE_MANAGER`, `COMPANY_ADMIN`, `GROUP_ADMIN`, `SUPER_ADMIN`. Role khusus di luar daftar itu tidak otomatis menjadi pengelola seluruh pegawai hanya karena memiliki permission read/create. Akun nonstaf tanpa employee ditolak.

Record EWA juga memeriksa parent Employee dan company-nya. Parent period/run opsional; jika terisi, parent harus berada di company yang sama dan belum dihapus, termasuk period dari run. Data dengan relasi legacy lintas company atau parent yang dihapus tidak tampil dan tidak dapat dimutasi lewat endpoint ini. Identitas employee yang disertakan tetap minimal; rekening dan tax ID tidak diambil.

## Create dan kalkulasi limit

Employee diperiksa dalam query berscope sebelum period/salary dibaca, dan diperiksa ulang dalam transaksi create. Period yang diminta dicari dengan company aktif dan soft-delete. Salary dipilih hanya dari alokasi aktif, belum dihapus, company/employee yang sama; fallback ke alokasi nonaktif dihapus. Beberapa salary aktif menghasilkan 409, salary non-IDR/nonpositif/invalid menghasilkan 422. Tanpa salary aktif, limit menggunakan hasil nol dan create ditolak.

Create tetap menghitung earned gross di server serta membatasi reservasi pada kebijakan 50% yang sudah ada. Query preview `percent` tetap menerima 1–100; parameter itu tidak mengubah batas create. Client tidak boleh mengirim earnedGross atau periode hasil kalkulasi; kiriman eksplisit ditolak validator 422 sebelum service. UUID dan nominal diperiksa lagi pada input create service. Nominal create, admin fee dan pembayaran harus finite, sesuai kapasitas Decimal(15,2), maksimal dua desimal; nilai boolean, null, array dan object tidak dianggap uang. Amount request/pembayaran harus positif, fee boleh nol.

Reservasi PENDING, APPROVED dan PAID tetap dihitung untuk periode yang beririsan. Create memakai advisory lock per company/employee, serta lock row employee **sampai commit**. Row lock diambil sebelum pembacaan yang dapat membuat snapshot transaksi usang, sehingga interval antara pelepasan advisory lock dan commit tidak mengizinkan dua reservasi membaca saldo lama. Pemeriksaan employee, pembacaan reservasi dan insert memakai transaction client yang sama.

Query reservasi internal tetap menghitung klaim berdasarkan company/employee/status/rentang periode tanpa menghilangkan klaim legacy hanya karena parent period/run tidak lagi terlihat. Ini menjaga agar limit tidak membesar dari penghilangan utang; record legacy tersebut perlu review. Query deduksi payroll internal tetap memakai kontrak transaksi payroll sebelumnya.

## Transisi status dan pencatatan

Setiap aksi tetap memeriksa role, kepemilikan dan status yang sesuai. Penulisan memakai `updateMany` dengan ID, company, predicate akses Employee/parent dan **status yang sebelumnya dibaca**, dalam transaksi dengan pembacaan hasil. Jika status atau assignment Employee berubah sebelum update, hasil nol menjadi 409. Approval versus cancellation, atau dua pencatatan PAID dari status APPROVED yang sama, hanya memiliki satu pemenang; request yang kalah tidak menimpa metadata hasil pertama.

Controller tidak lagi memakai fallback actor `system`. Service menolak actor kosong, hilang atau berbeda dari session sebelum aksi dilakukan. Ini mengamankan identitas pencatat; model EWA masih belum menyimpan creator user terpisah untuk request yang dibuat HR atas nama orang lain. Larangan self-approval yang ada berdasarkan employee pemilik, bukan bukti creator/checker user yang lengkap.

Seluruh respons EWA memakai `Cache-Control: no-store`, termasuk error. ID path/employee/period memakai UUID; alasan dan catatan dibatasi 4.000 karakter, referensi pembayaran dipangkas dan dibatasi 100 karakter. Unknown actor/status fields tetap tidak diteruskan sebagai field mutasi yang dipercaya.

Log create/pembayaran/rejection tidak memuat nominal, breakdown gaji atau alasan pribadi. Pesan limit yang ditolak juga tidak memuat nominal karena ErrorHandler mencatat pesan operational error. Rincian limit hanya ada pada respons limit yang terotorisasi. Audit memakai redaction untuk nominal, snapshot gross/limit, notes/alasan, referensi pembayaran dan nested employee, sambil mempertahankan status/actor/nama field yang berubah. Audit masih best-effort setelah respons; POST belum menyimpan before-snapshot atomik, dan log/audit historis belum disanitasi.

## Verifikasi dan batas

- `ewa-access.mysql.test.ts`: 18 tes dengan repository dan scope database nyata. Meliputi company/admin, branch/department/sub-department/self, irisan dua resource, ownership/custom role/finance, parent invalid/deleted, input salary, create, reservasi bersamaan, approval/cancel race, duplicate payout race, perubahan assignment saat mutasi serta logging. Barrier pada dua tes transisi memastikan kedua request sudah membaca status awal sebelum bersaing menulis.
- `ewa.routes.test.ts`: 28 tes HTTP dengan router, company middleware, permission dan validator nyata; service/authentication/audit dimock. Meliputi seluruh sembilan endpoint, identitas session, company switch, validasi, no-store, error 404/409 dan field palsu.
- `ewa-audit.test.ts`: satu tes redaction snapshot/diff, termasuk create dan perubahan status.
- Enam tes reservation/controller yang sudah ada tetap dipertahankan; fixture reservation memisahkan lookup scope/employee dari perilaku reservasi yang diuji.

Jalankan pada schema repository dalam database sintetis lokal:

```sh
EWA_ACCESS_DB_URL='mysql://root@127.0.0.1:13367/hris_payment_integration' npm test -- --runInBand ewa-access.mysql ewa.routes ewa-audit ewa.service.reservation ewa.controller.guard
```

Suite MySQL menolak host/database di luar database lokal tersebut, dilewati jika environment tidak tersedia, dan membersihkan fixture UUID miliknya sendiri. Hasil gabungan terbaru ada pada [checklist implementasi](checklist-implementation-status.md).

Fase ini tidak mengganti aturan earned gross EWA: kalender/fallback 22 hari, penghitungan hadir, penggolongan lembur weekday/weekend dan pembulatan masih kebijakan lama. Penyesuaian dengan loader kalender payroll, histori effective date, snapshot sumber atomik, aturan fee/payout, penutupan periode, serta idempotency/reference uniqueness pembayaran EWA masih perlu fase integritas finansial tersendiri. Pencatatan PAID tetap manual, tanpa pengiriman uang ke bank. Scope perhitungan lembur/final payroll serta laporan lain belum ditutup oleh fase ini. Tidak ada perubahan schema, migration, UI atau database aplikasi.
