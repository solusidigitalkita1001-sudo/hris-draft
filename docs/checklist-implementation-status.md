# Status implementasi checklist — 9 September 2026

Status keseluruhan: **partial**. Perbaikan P0 dan lanjutan P1 di bawah sudah diimplementasikan dan diuji. Seluruh backlog belum selesai; aplikasi belum dinyatakan production-ready.

## Lanjutan P1: transaksi payroll dan potongan sekali saja

- Pembuatan run, seluruh slip/komponen, snapshot formula dan pinjaman, pencatatan potongan EWA, total serta status COMPLETED memakai satu transaksi Serializable. Kegagalan pada tahap mana pun membatalkan seluruh penulisan; retry setelah perbaikan tidak menyisakan slip parsial.
- Lock row company sampai commit menyelaraskan pembuatan run dengan publikasi formula dan penomoran run. Request bersamaan untuk periode yang sama menghasilkan satu run; request berikutnya mendapat 409 dengan referensi run yang sudah ada. Correction run terpisah belum tersedia.
- Pembacaan payroll, kalender, company settings, loan dan EWA menerima transaction client yang sama. Tidak ada nested transaction EWA yang commit lebih dahulu.
- Bug EWA `ewaId` vs `id` dihapus bersama type escape agregasinya. Hanya EWA yang benar-benar dipotong di slip yang ditandai DEDUCTED, dengan pemeriksaan company/employee/status/nominal. EWA tanpa gaji aktif tetap PAID; fallback payout null ke requested amount untuk data legacy tetap diuji.
- Cicilan yang sudah memiliki snapshot tidak dipotong lagi oleh run berikutnya. Pelunasan tetap di rekonsiliasi ledger. Reservasi snapshot tidak dilepas otomatis saat batch dibatalkan.
- Total run memakai Decimal; tes nominal besar, pecahan dan overflow tersedia. Referensi periode/pegawai/komponen lintas company, beberapa gaji aktif untuk satu pegawai, non-IDR, payroll kosong, periode tertutup dan review attendance yang belum lengkap ditolak.
- Event diterbitkan sesudah commit. Kegagalan publikasi tidak membuat hasil payroll yang sudah tersimpan dilaporkan sebagai gagal; transactional outbox masih backlog.
- Sebelas tes MySQL memakai repository payroll, formula, EWA, pinjaman, company settings dan kalender nyata, dengan event bus/logger mock. Seluruh suite backend kini **694 passed / 79 suites**; typecheck dan build lulus; lint **0 errors / 827 warnings**.

Kontrak retry, batas legacy, dan bukti tes: [payroll-run-transactions.md](payroll-run-transactions.md). Fase ini tidak mengubah schema, UI, data aplikasi, atau menjalankan deployment. Correction retroaktif, audit data legacy EWA/cicilan, histori gaji dan sumber kalender/cuti tetap terbuka.

## Lanjutan P1: formula payroll

- Parser/DSL terbatas mendukung aritmetika, min/max/round, enam variabel payroll, dan referensi komponen. Tidak ada eval atau eksekusi JavaScript. Referensi, tipe input, pembagian nol, nilai negatif/overflow, cycle, dan kompleksitas divalidasi.
- Hitungan Decimal berpresisi 40 digit menggunakan HALF_UP dua desimal; dependensi memakai nominal komponen yang sudah dibulatkan. Formula allowance taxable masuk ke mesin pajak yang ada. Prorata ditulis eksplisit dalam formula.
- Draft berupa revisi immutable, dilengkapi simulasi, tanggal efektif, dan publikasi oleh pengguna selain pembuat. Reviewer read+approve dapat simulasi tanpa izin update. Company dan aktor berasal dari session/konteks server.
- Transaksi mengunci row company sampai commit. Nomor revisi bersamaan tetap unik, publikasi berulang tidak menggandakan audit, serta cycle diperiksa pada jadwal mendatang dan saat publikasi bersamaan.
- Payroll memilih versi menurut **awal periode** dan menyimpan ekspresi, versi, input, dependensi, nominal, serta engine version bersama slip. Sebelum tanggal efektif pertama, metode FIXED/PERCENTAGE tetap dipakai. Slip lama tidak berubah saat revisi berikutnya dipublikasikan.
- UI menyediakan draft/revisi, simulasi, konfirmasi publikasi, pesan error dengan input tetap tersimpan, dan jejak perhitungan pada detail slip. Pergantian company menutup panel/editor sebelumnya dan memuat ulang daftar komponen company baru. Komponen sistem tetap memakai mesin khususnya.
- Migration formula dan rollback sudah diuji pada MySQL sintetis, termasuk kesamaan schema sesudah pasang ulang. Belum diterapkan ke database aplikasi.

Kontrak dan batas lengkap: [payroll-formulas.md](payroll-formulas.md).

| Checklist formula dari dokumen sumber | Status |
| --- | --- |
| Fitur UI sesuai kemampuan aktual | Implemented: terhubung ke API dan kalkulasi payroll |
| Grammar/DSL terbatas | Implemented |
| Validasi dependensi, tipe, nol, cycle, kompleksitas | Implemented |
| Preview sebelum publish | Implemented |
| Versioning dan effective date | Implemented |
| Audit perubahan dan hasil kalkulasi | Implemented |
| Tes deterministik, pembulatan, pajak, prorata, retroactive adjustment, edge case | **Partial**: tes inti lulus; backdating ditolak dan diuji, correction/retroactive adjustment run belum dibuat |

Batas formula: IDR; audit sumber data kalender/cuti lintas periode dan correction retroaktif masih terbuka. Orkestrasi run kini atomik pada fase transaksi di atas; run parsial dari versi lama tetap perlu review. Fase ini belum menutup seluruh P1 atau menyatakan payroll production-ready.

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

Status P1 tetap **partial**: formula/DSL/versioning sudah terhubung, tetapi correction payroll retroaktif dan audit kontrak seluruh modul belum selesai, CI dan E2E lengkap belum tersedia. P0 MANAGER_TEAM masih fail-closed dan audit seluruh scope belum tuntas. Perubahan UI ini diperlukan untuk menjalankan alur pembayaran baru; bukan fase kosmetik P2.

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

Verifikasi dilakukan pada salinan source di `/tmp/hris-backend-verify` dan `/tmp/hris-frontend-verify`; lint memakai salinan `/tmp/hris-lint-backend-20260907` dan `/tmp/hris-lint-frontend-20260907` dengan dependency flat-config terbaru. Dependency dipasang melalui `npm ci`; Prisma Client dihasilkan dari schema repository. Environment memakai nilai test acak, tanpa menyalin secret aplikasi. MySQL 9.5 dijalankan sementara pada localhost:13367 dengan datadir khusus pengujian di `/tmp`.

| Command | Hasil |
| --- | --- |
| Backend `npm run check` | Passed |
| Backend `npm test -- --runInBand` | **694 passed; 79 suites passed**, termasuk advisory lock, ledger, formula dan kalkulasi atomik MySQL nyata |
| Backend `npm run build` | Passed |
| Frontend `npm test` | **18 passed; 5 suites passed** (8 September; frontend tidak berubah pada fase transaksi) |
| Frontend `npm run build` | Passed pada 8 September, termasuk TypeScript; masih ada peringatan ukuran bundle |
| Backend `npm run lint` | Passed: **0 errors, 827 warnings** pada 336 file. |
| Frontend `npm run lint` | **254 errors, 15 warnings**; gate keseluruhan belum lulus. Panel/service formula beserta UI test lulus lint tanpa warning. |
| Migration baru dan rollback | Keempat migration diterapkan dan rollback diuji pada database test dengan fixture dibersihkan; schema hasil migration sama dengan schema Prisma (`No difference detected`). |
| CORS aplikasi hasil build | Preflight origin aplikasi dengan `Idempotency-Key` berhasil (204). |
| Chromium desktop/mobile | Panel pembayaran dan formula dengan data sintetis; form, permission/konfirmasi diuji. Formula pada 1280px dan 390px tanpa overflow atau page error. Detector UI: tanpa temuan. |
| `node scripts/checks/p0-isolated.cjs` | Passed; pelengkap untuk CSRF, ownership, upload spoofing, path containment, dan race session |
| `git diff --check` | Passed |

Suite final menjalankan advisory lock, tiga test ledger, tujuh test formula dan sebelas test kalkulasi atomik terhadap MySQL nyata. Test formula mencakup nomor revisi dan publikasi bersamaan, cycle mendatang, pembatasan company/aktor/tanggal, penghapusan dependensi, serta snapshot dari proses payroll. Kalender, konfigurasi potongan, EWA dan event bus pada fixture formula sebelumnya memakai stub; suite transaksi baru memakai repository/database nyata untuk semua sumber data tersebut, dengan event bus/logger mock. Test cross-company lainnya masih banyak menggunakan mock; HTTP tests memakai Supertest lokal. Schema baseline disiapkan dari datamodel sebelum ledger, lalu migration baru diterapkan: ini belum verifikasi ulang seluruh rantai migration historis dari database kosong. Rollback diuji pada fixture kosong, belum restore drill data produksi. E2E aplikasi lengkap, readiness down/recovery nyata, DAST, load test, dan restore drill masih terbuka.

Dependency `node_modules` workspace memiliki file macOS `dataless` yang menyebabkan ETIMEDOUT/MODULE_NOT_FOUND. Install offline tidak memiliki cache lengkap; unduhan pertama timeout, lalu install ulang di folder sementara berhasil. Source dan node_modules workspace tidak diganti oleh proses verifikasi. Installer melaporkan advisories dependency yang masih perlu audit/tindak lanjut (backend: 3 moderate dan 1 high; frontend: 1 high).

## Dampak API dan kompatibilitas

Empat migration baru dan SQL rollback telah disiapkan serta diuji pada MySQL sementara. Belum ada migration ke database aplikasi, push, atau deployment.

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
5. Selesaikan 254 error/15 warning lint frontend dan warning backend, perluas MySQL integration/E2E ke critical journeys, audit advisories dependency dan seluruh quality gates.
6. Lanjut P1: OpenAPI/kontrak seluruh modul, correction payroll retroaktif, audit histori gaji/kalender/cuti dan data legacy payroll, batch pengganti/correction, typing finansial, transactional outbox, load test, CI/operasional. P2 UI polish menunggu P0 terverifikasi menyeluruh.

Perubahan deployment yang sudah staged sebelum pengerjaan (`.github/workflows/deploy.yml`, `.gitignore`, `scripts/server-deploy.sh`) dipertahankan.
