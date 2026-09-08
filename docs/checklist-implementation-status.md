# Status implementasi checklist — 8 September 2026

Status keseluruhan: **partial**. Perbaikan P0 dan lanjutan P1 di bawah sudah diimplementasikan dan diuji. Seluruh backlog belum selesai; aplikasi belum dinyatakan production-ready.

## Lanjutan P1: kontrak API, approval, dan pembayaran payroll

- Kontrak loan create/self-list memakai aktor session; approval notes diteruskan ke workflow. DTO frontend tidak lagi memakai `Partial<Loan>` atau mengirim employeeId aktor. Work-calendar memvalidasi tanggal kalender nyata dan rentang tanggal; ID tetap path parameter.
- Kontrak trip/expense create dan self-list diselaraskan: identitas aktor ditentukan server, DTO publik/client dan dokumentasi mobile diperbarui. Contract tests mencakup payload aktor palsu dan employee context yang hilang.
- Workflow tidak mengizinkan self-approval termasuk SUPER_ADMIN; rejection memerlukan alasan. Transisi instance dan current step menggunakan conditional update dalam transaksi untuk menolak request bersamaan atau status usang. Pengulangan escalation ke backup yang sama ditolak.
- Header `Idempotency-Key` diizinkan pada CORS untuk origin aplikasi. Pencatatan hasil dan rekonsiliasi tetap memerlukan permission `payroll:disburse` selain `payroll:process`.
- Payroll menyimpan pembuat dari session dan hanya bisa disetujui pengguna lain. Identitas pembuat data legacy tidak ditebak.
- Ledger pembayaran manual menyimpan snapshot nominal/rekening per slip, state export/processing/paid/partial-failure/reconciled/cancelled, idempotency key, referensi bank unik per company, dan log state/actor. Approval tetap pada PayrollRun. Tidak ada submit atau transfer bank otomatis.
- Rekonsiliasi memerlukan seluruh nominal cocok. Payroll menjadi DISBURSED dan cicilan yang benar-benar dipotong pada slip dilunasi dalam transaksi yang sama. Cicilan berubah/sudah dibayar, saldo tidak cocok, atau slip berubah menyebabkan rollback. Cicilan baru di luar snapshot tetap tidak disentuh.
- Jalur lama yang langsung menandai DISBURSED dan export rekening hidup ditutup dengan conflict yang menjelaskan endpoint pengganti. Detail run biasa menghilangkan rekening pegawai; metadata ledger disamarkan, rekening lengkap hanya pada export terotorisasi. Logging query Prisma tidak lagi mencatat SQL/parameter yang dapat memuat data sensitif.
- Halaman payroll menyediakan ekspor file bank per grup, pencatatan hasil per pegawai, retry dengan key yang sama, pesan error dengan input tetap tersimpan, dan konfirmasi rekonsiliasi/pembatalan. Ekspor dijelaskan sebagai file manual yang perlu diproses melalui bank.
- Kode komponen gaji otomatis sekarang unik per company. Tes MySQL menemukan constraint global lama menghalangi company kedua membuat komponen yang sama; schema dan seed diselaraskan.
- ESLint 9 flat config beserta dependency tersedia untuk backend/frontend. Error lint backend diperbaiki; warning backend dan error frontend lama tetap dilaporkan, tidak disembunyikan dengan menonaktifkan rules.

Kontrak, state, migration, batas legacy, dan cara pengujian: [payroll-payment-ledger.md](payroll-payment-ledger.md).

Status P1 tetap **partial**: formula/DSL/versioning belum dibuat, audit kontrak seluruh modul belum selesai, CI dan E2E lengkap belum tersedia. P0 MANAGER_TEAM masih fail-closed dan audit seluruh scope belum tuntas. Perubahan UI ini diperlukan untuk menjalankan alur pembayaran baru; bukan fase kosmetik P2.

## Riwayat P0: isolasi tenant dan query pegawai

- Middleware Prisma selalu menggabungkan filter caller dengan company aktif, termasuk filter company berbentuk `in`, `equals`, `AND` atau `OR`. Bypass workflow admin di middleware database dihapus.
- Payload create/createMany/update/updateMany/upsert pada model dengan companyId tidak boleh mengarah ke company lain; kedua cabang upsert diperiksa. Company yang tidak dicantumkan saat create diisi dari konteks server.
- WorkflowInstanceStep, WorkflowInstanceLog, dan ExpenseApproval dibatasi lewat relasi parent, karena model ini tidak memiliki kolom companyId. Reassignment parent pada record yang sudah ada ditolak.
- Company pilihan yang lolos validasi assignment sekarang diteruskan ke AsyncLocalStorage sebelum controller dijalankan; query database tidak lagi memakai company lama dari token ketika pengguna memilih company lain yang memang ditugaskan kepadanya.
- Repository pegawai membaca scope langsung dari konteks server dan konfigurasi database, lalu menerapkannya pada list/count/detail/update/soft-delete/status. Export memakai list yang sama. Scope tidak lagi bergantung pada filter HTTP yang bisa diabaikan DTO/controller.
- **MANAGER_TEAM tetap 403.** Audit menemukan celah tenant/filter di bawah jalur ini, sehingga pengaktifan hierarchy ditunda sampai fondasi scope aman. Belum ada perubahan schema atau reporting line pegawai.

Verifikasi tambahan: `tenant-scope.test.ts`, `employee.scope.test.ts`, dan test propagasi company context. Pada iterasi tenant sebelumnya, 495 test backend lulus dan 1 dilewati. Hasil gabungan terbaru tersedia pada tabel verifikasi di bawah.

Batas penting: middleware Prisma tidak otomatis memeriksa setiap nested write atau setiap referensi foreign key. Insert child tanpa companyId tetap membutuhkan validasi parent pada service/transaction pemiliknya. Jalur log workflow dan approval expense yang diperiksa berasal dari instance baru yang dibatasi company, instance yang dibaca melalui query berscope, atau claim yang di-update melalui query berscope dalam transaksi. Ini belum membuktikan semua jalur nested write dan raw SQL aman. Scope branch/department pada seluruh sub-entity serta perubahan assignment organisasi masih membutuhkan audit lanjutan.

## Hasil implementasi

| Area | Perubahan | Bukti |
| --- | --- | --- |
| Data scope | MANAGER_TEAM, scope tidak dikenal, scope organisasi invalid, serta self tanpa employeeId ditolak. Kegagalan lookup scope tidak lagi diteruskan tanpa filter. Prefix API `/api/v1` dipetakan ke resource yang benar. | administration.scope.test.ts; CompanyScope.fail-closed.test.ts |
| Konfigurasi akses | COMPANY_ADMIN/GROUP_ADMIN harus memiliki company assignment yang sesuai saat mengakses konfigurasi administration. | administration.scope.test.ts |
| File privat | Static `/uploads` ditutup. Dokumen termasuk signed URL memerlukan session, permission dan query company/ownership/scope. Path internal dihapus dari metadata dokumen. Download memakai attachment, no-store dan nosniff. | document-management.access.test.ts; private-files.test.ts |
| Kuitansi dan bukti kinerja | Endpoint download berdasarkan ID record. Frontend menggunakan endpoint baru. Query memeriksa company, scope dan pemilik/approver/reviewer yang sesuai. Path traversal dan symlink keluar storage ditolak. | private-files.test.ts; private-path.test.ts |
| Upload | Nama kuitansi/evidence acak. Signature, MIME dan ekstensi dicocokkan. Kuitansi baru berada dalam direktori company/employee dan referensi saat create claim harus cocok. Dokumen yang gagal dibuat dibersihkan dari disk. | FileValidation.test.ts; receipt-reference.test.ts |
| Session frontend | Auth/roles/permissions tidak dipersist. Route privat menunggu `/auth/me`. Bootstrap paralel digabungkan; response lama tidak mengaktifkan kembali session setelah logout. Logout antar-tab dan refresh profil saat window focus tersedia. `/auth/me` memeriksa status akun. | auth.store.test.ts |
| CSRF | Semua mutasi melalui client API menunggu bootstrap token. Penolakan CSRF spesifik memicu satu retry. Token server memiliki usia maksimum dua jam; origin asing ditolak untuk mutasi cookie-authenticated. | CsrfProtection.test.ts; CsrfProtection.integration.test.ts |
| Readiness | `/health/live` terpisah. `/health` dan `/health/ready` memeriksa database dan dependency aktif, timeout dua detik, dan menggabungkan probe yang belum selesai. | readiness.test.ts |
| Biometrik | Decoder menolak encoding Base64url noncanonical; format ciphertext yang dihasilkan aplikasi tetap sama. | biometric-crypto.test.ts |

## Hasil verifikasi aktual

Verifikasi dilakukan pada salinan source di `/tmp/hris-backend-verify` dan `/tmp/hris-frontend-verify`; lint memakai salinan `/tmp/hris-lint-backend-20260907` dan `/tmp/hris-lint-frontend-20260907` dengan dependency flat-config terbaru. Dependency dipasang melalui `npm ci`; Prisma Client dihasilkan dari schema repository. Environment memakai nilai test acak, tanpa menyalin secret aplikasi. MySQL 9.5 dijalankan sementara pada localhost:13367 dengan datadir baru di `/tmp`.

| Command | Hasil |
| --- | --- |
| Backend `npm run check` | Passed |
| Backend `npm test -- --runInBand` | **627 passed; 74 suites passed**, termasuk advisory lock dan ledger MySQL nyata |
| Backend `npm run build` | Passed |
| Frontend `npm test` | **12 passed; 3 suites passed** |
| Frontend `npm run build` | Passed, termasuk TypeScript; masih ada peringatan ukuran bundle |
| Backend `npm run lint` | Passed: **0 errors, 832 warnings** pada 326 file. |
| Frontend `npm run lint` | **258 errors, 15 warnings** pada 154 file; gate keseluruhan belum lulus. Target panel/service/detail payroll baru lulus lint tanpa warning. |
| Migration baru dan rollback | Ketiga migration diterapkan dan rollback diuji pada database test dengan fixture dibersihkan; schema hasil migration sama dengan schema Prisma (`No difference detected`). |
| CORS aplikasi hasil build | Preflight origin aplikasi dengan `Idempotency-Key` berhasil (204). |
| Chromium desktop/mobile | Panel dengan data sintetis, form/input diuji; tidak ada overflow halaman. Detector UI: tanpa temuan. |
| `node scripts/checks/p0-isolated.cjs` | Passed; pelengkap untuk CSRF, ownership, upload spoofing, path containment, dan race session |
| `git diff --check` | Passed |

Suite final menjalankan advisory lock dan tiga test ledger terhadap MySQL nyata. Test cross-company lainnya masih banyak menggunakan mock; HTTP tests memakai Supertest lokal. Schema baseline disiapkan dari datamodel sebelum ledger, lalu migration baru diterapkan: ini belum verifikasi ulang seluruh rantai migration historis dari database kosong. Rollback diuji pada fixture kosong, belum restore drill data produksi. E2E aplikasi lengkap, readiness down/recovery nyata, DAST, load test, dan restore drill masih terbuka.

Dependency `node_modules` workspace memiliki file macOS `dataless` yang menyebabkan ETIMEDOUT/MODULE_NOT_FOUND. Install offline tidak memiliki cache lengkap; unduhan pertama timeout, lalu install ulang di folder sementara berhasil. Source dan node_modules workspace tidak diganti oleh proses verifikasi. Installer melaporkan advisories dependency yang masih perlu audit/tindak lanjut (backend: 3 moderate dan 1 high; frontend: 1 high).

## Dampak API dan kompatibilitas

Tiga migration baru dan SQL rollback telah disiapkan serta diuji pada MySQL sementara. Belum ada migration ke database aplikasi, push, atau deployment.

- `MANAGER_TEAM` mengembalikan 403 sampai reporting line pegawai tersedia. Position.reportsToId belum dianggap sebagai sumber hierarchy pegawai secara otomatis.
- URL raw `/uploads/*` tidak lagi dapat diakses. Dokumen memakai controller document; kuitansi memakai `/api/v1/private-files/receipts/:claimId`; evidence memakai `/api/v1/private-files/performance-evidence/:evidenceId`. Prefix mengikuti konfigurasi aplikasi.
- Signed document URL tetap memiliki format yang sama tetapi sekarang memerlukan session dan permission aktif; client eksternal yang membagikan link anonim harus menyesuaikan.
- Metadata dokumen tidak lagi berisi `filePath`. Hasil upload kuitansi mengembalikan storage key relatif pada `filePath`, bukan path filesystem internal. Frontend memakai URL referensi untuk pengajuan dan endpoint berdasarkan ID untuk download.
- Kuitansi legacy yang sudah terkait klaim tetap dapat dibaca melalui endpoint baru bila tersimpan di root kuitansi yang benar. Pengajuan baru harus memakai referensi hasil upload baru yang terikat company/employee; path legacy bebas tidak diterima sebagai input baru.
- Kebijakan dokumen employee/restricted: pemilik atau uploader dapat membaca; role pengelola dokumen yang diterapkan ialah SUPER_ADMIN, COMPANY_ADMIN, HR_ADMIN, HR_MANAGER dalam company aktif, tetap dibatasi data scope. Receipt administratif memperbolehkan role admin/HR sesuai modul, tetap dalam company/scope.
- Token CSRF lama yang tidak memiliki timestamp ditolak; client memperbaruinya melalui satu retry khusus CSRF. Error permission/origin tidak diretry sebagai CSRF.
- Health dapat mengembalikan 503 ketika database tidak tersedia.

## Backlog prioritas berikutnya

1. Selesaikan sumber reporting line pegawai, migration, direct/nested report dan cycle tests. MANAGER_TEAM saat ini aman dengan penolakan, belum fungsional.
2. Lengkapi matriks endpoint/role/scope dan audit semua list/detail/export/mutasi. Middleware lama masih menginjeksi filter ke query; pemaksaan filter pada repository seluruh modul belum terbukti.
3. Audit seluruh consumer file selain dokumen/kuitansi/planning evidence, termasuk upload gagal pada modul lain dan attachment performance-result. Akses raw ditolak, tetapi kesetaraan fungsi seluruh consumer belum diverifikasi.
4. Lengkapi test client CSRF retry/rotation dan E2E auth browser; pastikan revocation/role changes di server berlaku sesuai kebijakan session, bukan hanya refresh profil frontend.
5. Selesaikan 258 error/15 warning lint frontend dan warning backend, perluas MySQL integration/E2E ke critical journeys, audit advisories dependency dan seluruh quality gates.
6. Lanjut P1: OpenAPI/kontrak seluruh modul, formula payroll dengan DSL/versioning, review legacy payroll dan batch pengganti/correction, typing finansial, CI/operasional. P2 UI polish menunggu P0 terverifikasi menyeluruh.

Perubahan deployment yang sudah staged sebelum pengerjaan (`.github/workflows/deploy.yml`, `.gitignore`, `scripts/server-deploy.sh`) dipertahankan.
