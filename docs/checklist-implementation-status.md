# Status implementasi checklist — 9 September 2026

Status keseluruhan: **partial**. Perbaikan P0 dan lanjutan P1 di bawah sudah diimplementasikan dan diuji. Seluruh backlog belum selesai; aplikasi belum dinyatakan production-ready.

## Lanjutan P0: scope payroll run, period, payslip dan pembayaran

- Detail dan self-list payslip menggabungkan company aktif, scope payroll pada employee, soft-delete, serta company parent run/period di query database. Slip di luar scope menghasilkan 404; employee self-list tetap dari session dan service menolak identitas palsu.
- Relasi run pada payslip tidak lagi membuka total perusahaan, notes run/period atau aktor approval. Identitas employee pada query detail run publik tidak mengambil rekening. Bukti formula dan benefit pada detail slip dibaca setelah parent lolos scope, dalam transaksi RepeatableRead, dengan pemeriksaan company dan pemilik yang sesuai.
- Run/period/review attendance/konfirmasi serta seluruh jalur payment batch/export kini memerlukan scope payroll seluruh company. Branch/department/sub-department/self mendapat 403 walaupun memiliki permission proses atau approval, karena model run/batch masih memproses seluruh perusahaan. Permission endpoint tetap wajib; konfigurasi tanpa pembatas masih mengikuti default company yang ada.
- Creator/checker/actor konfirmasi harus cocok dengan session. Conditional approval mempertahankan maker-checker dan menambahkan company serta parent period; mutasi period menyertakan company/soft-delete. Guard HTTP run/period dijalankan sebelum middleware audit; service juga memeriksa konteks. Guard payment batch berada pada boundary HTTP sebelum service ledger dengan context internal terpercaya.
- Run, period, payslip dan payment batch memakai no-store, termasuk error. ID run/slip serta endpoint attendance divalidasi UUID. Nilai snapshot run/slip, rumus, lifecycle pembayaran dan kebijakan status publikasi slip tidak diubah.
- Ditambahkan **48 tes**: 18 MySQL nyata, 22 kontrak HTTP run/payslip dan delapan kontrak HTTP payment. Hasil gabungan **834 passed / 88 suites**; typecheck/build lulus; lint **0 errors / 823 warnings** pada 349 file. Tidak ada perubahan frontend, schema, migration atau database aplikasi.

Matriks endpoint, dampak kompatibilitas, snapshot historis dan batas lengkap: [payroll-run-payslip-access.md](payroll-run-payslip-access.md). Audit konsumen gaji lain/laporan, kebijakan publikasi slip, histori effective date dan correction payroll tetap backlog.

## Lanjutan P0: scope baca alokasi gaji, THR dan gaji pada profil pegawai

- List/detail salary sekarang memakai query yang menggabungkan company aktif, parent employee, soft-delete dan scope resource payroll. Filter employee client hanya mempersempit hasil. Branch/department/sub-department/self diuji pada MySQL nyata; MANAGER_TEAM, konteks yang hilang dan kegagalan lookup tetap ditolak.
- Detail pegawai tidak lagi menyertakan gaji hanya berdasarkan izin membaca employee. Bagian `employeeSalaries` memerlukan permission baca payroll dan scope payroll yang cocok; jika tidak, array kosong tanpa membuka nominal melalui respons profil.
- Relasi salary ke employee berbeda company ditolak oleh predicate parent. Nested komponen yang mereferensikan master company lain tidak dibaca pada list/detail/profil. Identitas employee di respons salary hanya memuat ID, nama dan employee number, tanpa tax ID/konteks kalkulasi internal.
- Input THR dibaca dalam satu transaksi RepeatableRead setelah employee lolos scope. Beberapa gaji aktif menghasilkan 409; upah invalid/non-IDR ditolak 422. Rumus THR tetap sama, dan log kalkulasi tidak lagi memuat nominal.
- UUID query/path serta tanggal THR divalidasi. Response list/detail salary dan THR memakai no-store, termasuk respons error. Kontrak array tetap sama; tidak ada pagination baru.
- Ditambahkan **24 tes**: 11 MySQL nyata dan 13 kontrak HTTP. Pada fase scope salary: **786 passed / 86 suites**; typecheck/build lulus; lint **0 errors / 826 warnings** pada 346 file. Source frontend tidak berubah.

Matriks endpoint, perilaku array kosong/404, pengujian dan batas lengkap: [payroll-salary-read-access.md](payroll-salary-read-access.md). Run/period/payslip dan boundary HTTP ledger/export dilanjutkan pada fase di atas; konsumen gaji pada EWA, lembur, final payroll dan laporan masih perlu audit. Histori effective date/penjadwalan aktivasi/correction payroll belum diimplementasikan; makna record gaji nonaktif legacy tidak ditebak.

## Lanjutan P1: integritas mutasi alokasi gaji

- Create menyimpan penonaktifan alokasi lama dan alokasi/komponen baru dalam satu transaksi; update mengganti komponen dan parent salary secara atomik. Tes kegagalan setelah insert/replace membuktikan kondisi lama pulih dan retry berhasil.
- Mutasi salary memakai transaksi Serializable serta lock company yang sama dengan kalkulasi payroll dan publikasi formula. Duplikasi tanggal efektif dan aktivasi bersamaan tidak menghasilkan dua alokasi aktif. Data legacy dengan beberapa alokasi aktif ditolak saat create untuk ditinjau.
- Company berasal dari konteks server; body company pada create menjadi opsional dan tetap harus cocok jika diberikan. Employee target dan parent salary diperiksa dalam query company + scope resource payroll, termasuk branch/self. MANAGER_TEAM dan konteks aktor yang hilang tetap ditolak. List/detail salary dan THR kini dilanjutkan pada fase scope baca di atas; audit seluruh payroll belum selesai.
- Nominal harus positif, finite, dalam kapasitas Decimal(15,2), dan maksimal dua desimal; currency IDR. Komponen duplikat, lebih dari 512 alokasi, tanggal invalid dan patch kosong ditolak. Komponen yang diserahkan/diaktifkan harus aktif, belum dihapus dan milik company yang sama.
- Alokasi yang sudah direferensikan payslip tidak dapat diubah gaji pokok, currency, tanggal efektif atau komponennya. Notes/status aktif tetap dapat diubah; perubahan finansial memerlukan alokasi baru. Lock bersama memastikan perlindungan berlaku saat kalkulasi dan edit berjalan bersamaan.
- Audit EmployeeSalary menyamarkan gaji, komponen, notes dan nested employee, sambil mempertahankan nama field yang berubah. Audit create dapat menggunakan ID dari respons. Audit masih best-effort setelah respons; durable audit atomik dan sanitasi log historis belum selesai.
- Ditambahkan **43 tes**: 13 MySQL nyata, 17 validasi DTO, 10 kontrak HTTP dan tiga redaction audit. Pada fase mutasi: **762 passed / 85 suites**; typecheck/build lulus; lint **0 errors / 827 warnings** pada 345 file, tanpa temuan pada lima file baru. Hasil terbaru tersedia di tabel verifikasi.

Kontrak dan batas lengkap: [payroll-salary-allocations.md](payroll-salary-allocations.md). Tidak ada schema/migration/UI atau perubahan data aplikasi. Pemilihan gaji masih mengikuti `isActive`; tanggal mendatang belum menjadwalkan aktivasi, dan histori effective date/correction payroll tetap backlog.

## Lanjutan P1: akurasi input kalender, attendance dan cuti payroll

- Review attendance dan pembuatan payroll memakai loader yang sama dalam transaksi masing-masing. Review mengikuti pegawai dengan gaji aktif, termasuk pegawai tanpa attendance, dan menambahkan `workDays` pada setiap entry.
- Hari kerja dihitung dari aturan mingguan beserta pengecualian tanggal, dengan prioritas kalender department/branch/company dan tahun sesuai periode. Kalender hilang/ambigu ditolak, bukan menghasilkan nol diam-diam. Kalender eksplisit semua libur tetap sah.
- Rotasi FACTORY dan snapshot tukar shift APPROVED didukung. Formula shift, company, peserta, tanggal, status parent dan payload override divalidasi; konfigurasi tidak lengkap menolak payroll dan membatalkan penulisan.
- Batas tanggal memakai tanggal UTC inklusif agar jam dari date picker tidak menghilangkan hari pertama. Rentang lintas tahun dan tahun kabisat diuji.
- Cuti dihitung dari tanggal yang beririsan dengan periode dan jadwal kerja, tanpa menjumlahkan seluruh `totalDays` permohonan. Tanggal hadir dan cuti tumpang tindih dihitung sekali; kehadiran mengambil prioritas. Absen review, formula dan slip memakai hasil yang sama.
- Jam lembur dijumlahkan dengan Decimal; `0.1 + 0.2 = 0.3` tersimpan di input formula dan slip. Potongan telat hanya berlaku pada hari kerja terjadwal. Mesin tarif lembur/potongan tetap memakai kebijakan lama.
- Ditambahkan 18 tes aturan kalender dan tujuh tes MySQL nyata dari review sampai slip/formula, termasuk rollback dan retry setelah sumber diperbaiki. Pada fase input attendance: **719 passed / 81 suites**; typecheck dan build lulus; lint **0 errors / 827 warnings**, tanpa temuan pada empat file baru. Hasil terbaru tersedia di tabel verifikasi.

Kontrak, aturan per tanggal dan batas lengkap: [payroll-attendance-inputs.md](payroll-attendance-inputs.md). Tidak ada migration, UI atau perubahan data aplikasi. Histori gaji/assignment, pembekuan sumber saat review, snapshot sumber per hari, kebijakan unpaid/partial-day leave, penggolongan tarif lembur hari libur dan correction payroll tetap terbuka. Pengajuan/saldo cuti serta endpoint kalender lain belum diubah.

## Lanjutan P1: transaksi payroll dan potongan sekali saja

- Pembuatan run, seluruh slip/komponen, snapshot formula dan pinjaman, pencatatan potongan EWA, total serta status COMPLETED memakai satu transaksi Serializable. Kegagalan pada tahap mana pun membatalkan seluruh penulisan; retry setelah perbaikan tidak menyisakan slip parsial.
- Lock row company sampai commit menyelaraskan pembuatan run dengan publikasi formula dan penomoran run. Request bersamaan untuk periode yang sama menghasilkan satu run; request berikutnya mendapat 409 dengan referensi run yang sudah ada. Correction run terpisah belum tersedia.
- Pembacaan payroll, kalender, company settings, loan dan EWA menerima transaction client yang sama. Tidak ada nested transaction EWA yang commit lebih dahulu.
- Bug EWA `ewaId` vs `id` dihapus bersama type escape agregasinya. Hanya EWA yang benar-benar dipotong di slip yang ditandai DEDUCTED, dengan pemeriksaan company/employee/status/nominal. EWA tanpa gaji aktif tetap PAID; fallback payout null ke requested amount untuk data legacy tetap diuji.
- Cicilan yang sudah memiliki snapshot tidak dipotong lagi oleh run berikutnya. Pelunasan tetap di rekonsiliasi ledger. Reservasi snapshot tidak dilepas otomatis saat batch dibatalkan.
- Total run memakai Decimal; tes nominal besar, pecahan dan overflow tersedia. Referensi periode/pegawai/komponen lintas company, beberapa gaji aktif untuk satu pegawai, non-IDR, payroll kosong, periode tertutup dan review attendance yang belum lengkap ditolak.
- Event diterbitkan sesudah commit. Kegagalan publikasi tidak membuat hasil payroll yang sudah tersimpan dilaporkan sebagai gagal; transactional outbox masih backlog.
- Sebelas tes MySQL memakai repository payroll, formula, EWA, pinjaman, company settings dan kalender nyata, dengan event bus/logger mock. Pada fase transaksi: **694 passed / 79 suites**; typecheck dan build lulus; lint **0 errors / 827 warnings**. Hasil terbaru tersedia di tabel verifikasi.

Kontrak retry, batas legacy, dan bukti tes: [payroll-run-transactions.md](payroll-run-transactions.md). Fase ini tidak mengubah schema, UI, data aplikasi, atau menjalankan deployment. Correction retroaktif, audit data legacy EWA/cicilan dan histori gaji tetap terbuka; kalender/cuti payroll dilanjutkan pada fase input di atas.

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

Batas formula: IDR; kalender/cuti lintas periode sudah diperbaiki pada fase input di atas, tetapi histori/snapshot sumber dan correction retroaktif masih terbuka. Orkestrasi run kini atomik pada fase transaksi; run parsial dari versi lama tetap perlu review. Fase ini belum menutup seluruh P1 atau menyatakan payroll production-ready.

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
| Backend `npm test -- --runInBand` | **834 passed; 88 suites passed**, termasuk advisory lock, ledger, formula, kalkulasi atomik, input attendance, mutasi/scope gaji serta scope run/payslip MySQL nyata |
| Backend `npm run build` | Passed |
| Kalender dengan `TZ=America/Los_Angeles` | **18 passed**; hasil tanggal UTC tetap sama di zona waktu server berbeda. |
| Frontend `npm test` | **18 passed; 5 suites passed** (8 September; frontend tidak berubah pada fase backend setelahnya) |
| Frontend `npm run build` | Passed pada 8 September, termasuk TypeScript; masih ada peringatan ukuran bundle |
| Backend `npm run lint` | Passed: **0 errors, 823 warnings** pada 349 file; helper akses dan dua suite scope run/payslip baru tanpa temuan. |
| Frontend `npm run lint` | **254 errors, 15 warnings**; gate keseluruhan belum lulus. Panel/service formula beserta UI test lulus lint tanpa warning. |
| Migration baru dan rollback | Keempat migration diterapkan dan rollback diuji pada database test dengan fixture dibersihkan; schema hasil migration sama dengan schema Prisma (`No difference detected`). |
| CORS aplikasi hasil build | Preflight origin aplikasi dengan `Idempotency-Key` berhasil (204). |
| Chromium desktop/mobile | Panel pembayaran dan formula dengan data sintetis; form, permission/konfirmasi diuji. Formula pada 1280px dan 390px tanpa overflow atau page error. Detector UI: tanpa temuan. |
| `node scripts/checks/p0-isolated.cjs` | Passed; pelengkap untuk CSRF, ownership, upload spoofing, path containment, dan race session |
| `git diff --check` | Passed |

Suite final menjalankan advisory lock, tiga test ledger, tujuh test formula, sebelas test kalkulasi atomik, tujuh test input attendance, 13 test mutasi alokasi gaji, 11 test scope baca gaji/THR/profil dan 18 test scope run/period/payslip terhadap MySQL nyata. Test formula mencakup nomor revisi dan publikasi bersamaan, cycle mendatang, pembatasan company/aktor/tanggal, penghapusan dependensi, serta snapshot dari proses payroll; fixture kalender formula kini memakai database nyata, dengan konfigurasi potongan/EWA/event masih mock. Suite transaksi, input attendance dan alokasi gaji memakai repository/database nyata untuk sumber kalkulasi, dengan event bus/logger mock; tes alokasi serta scope salary/run/payslip juga memakai konfigurasi data scope nyata. Fixture kalkulasi/attendance/formula kini memakai request context aktor untuk pemanggilan service. Test cross-company lainnya masih banyak menggunakan mock; HTTP tests memakai Supertest lokal. Schema baseline disiapkan dari datamodel sebelum ledger, lalu migration baru diterapkan: ini belum verifikasi ulang seluruh rantai migration historis dari database kosong. Rollback diuji pada fixture kosong, belum restore drill data produksi. E2E aplikasi lengkap, readiness down/recovery nyata, DAST, load test, dan restore drill masih terbuka.

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
- Summary attendance payroll menambahkan `workDays`, memakai daftar gaji aktif, dan menghitung absen dari jadwal. Kalender/shift hilang atau ambigu menghasilkan 400; detail kompatibilitas dan batas snapshot review ada di [payroll-attendance-inputs.md](payroll-attendance-inputs.md).
- Mutasi alokasi gaji memakai company/context server dan scope payroll; company create opsional. Validasi uang/komponen lebih ketat (422), tanggal duplikat/aktivasi ganda dan edit finansial alokasi yang sudah dipakai slip ditolak (409). Kontrak lengkap ada di [payroll-salary-allocations.md](payroll-salary-allocations.md).
- List/detail salary dan THR kini mengikuti scope payroll di query database. Bagian gaji pada profil employee menjadi array kosong jika permission/scope payroll tidak mengizinkan. UUID/tanggal yang invalid ditolak dan endpoint baca salary/THR memakai no-store; matriks lengkap ada di [payroll-salary-read-access.md](payroll-salary-read-access.md).
- Run/period dan payment batch/export sekarang memerlukan scope seluruh company (403 untuk scope pegawai/organisasi parsial). Payslip detail/self-list mengikuti scope employee dan tidak menyertakan total/notes perusahaan pada nested run. Actor harus cocok session; UUID dan no-store diperketat. Kontrak lengkap: [payroll-run-payslip-access.md](payroll-run-payslip-access.md).

## Backlog prioritas berikutnya

1. Selesaikan sumber reporting line pegawai, migration, direct/nested report dan cycle tests. MANAGER_TEAM saat ini aman dengan penolakan, belum fungsional.
2. Lengkapi matriks endpoint/role/scope dan audit semua list/detail/export/mutasi. Salary/THR/profil dan payslip sudah memakai predicate server. Run/period serta boundary HTTP ledger/export memerlukan scope seluruh company. Konsumen gaji EWA/lembur/final payroll, konfigurasi/formula dan laporan masih perlu audit; kebijakan publikasi slip serta payroll parsial perlu kontrak tersendiri. Middleware lama masih menginjeksi filter ke query; pemaksaan filter pada repository seluruh modul belum terbukti.
3. Audit seluruh consumer file selain dokumen/kuitansi/planning evidence, termasuk upload gagal pada modul lain dan attachment performance-result. Akses raw ditolak, tetapi kesetaraan fungsi seluruh consumer belum diverifikasi.
4. Lengkapi test client CSRF retry/rotation dan E2E auth browser; pastikan revocation/role changes di server berlaku sesuai kebijakan session, bukan hanya refresh profil frontend.
5. Selesaikan 254 error/15 warning lint frontend dan warning backend, perluas MySQL integration/E2E ke critical journeys, audit advisories dependency dan seluruh quality gates.
6. Lanjut P1: OpenAPI/kontrak seluruh modul, correction payroll retroaktif, histori gaji/assignment dan penjadwalan aktivasi salary, pembekuan serta snapshot sumber attendance, kebijakan unpaid/partial-day leave dan tarif lembur hari libur, audit data legacy payroll, batch pengganti/correction, typing finansial, audit atomik dan redaction lintas modul, transactional outbox, load test, CI/operasional. P2 UI polish menunggu P0 terverifikasi menyeluruh.

Perubahan deployment yang sudah staged sebelum pengerjaan (`.github/workflows/deploy.yml`, `.gitignore`, `scripts/server-deploy.sh`) dipertahankan.
