# Checklist dan Prompt Perbaikan HRIS Website

Repository: `https://github.com/solusidigitalkita1001-sudo/hris-draft.git`

> Status aktual dan batas verifikasi: [docs/checklist-implementation-status.md](docs/checklist-implementation-status.md). Item lain tetap terbuka.

Target produk: HRIS web yang matang, aman, dan memiliki kualitas pengalaman pengguna setara aplikasi seperti GreatDay.

> Urutan pengerjaan wajib mengikuti prioritas. Jangan mengerjakan kosmetik sebelum celah otorisasi dan keamanan ditutup.

## Definition of Done Global

- [ ] Semua perubahan melewati lint, type-check, unit test, integration test, dan build.
- [ ] Tidak ada regresi pada login, RBAC, approval, attendance, leave, payroll, dan employee management.
- [ ] Semua endpoint memvalidasi tenant/company dan data scope di server, bukan hanya di UI.
- [ ] Endpoint mutasi memiliki validasi input, otorisasi, audit trail, dan proteksi CSRF yang tepat.
- [ ] Error response konsisten dan tidak membocorkan stack trace, SQL, token, atau data sensitif.
- [ ] Perubahan database memakai migration yang reversible dan tidak merusak data lama.
- [ ] UI memiliki loading, empty, error, success, disabled, dan permission-denied state.
- [ ] Dokumentasi dan status fitur sesuai kondisi implementasi sebenarnya.

## P0 — Blocker Keamanan dan Produksi

### 1. Tutup celah data scope `MANAGER_TEAM`

- [ ] Audit `backend/src/modules/administration/administration.service.ts` dan semua pemanggil data-scope resolver.
- [x] Hapus perilaku yang hanya mencatat warning lalu melanjutkan query tanpa filter.
- [x] Terapkan prinsip fail-closed: jika hierarchy manager belum dapat dihitung, kembalikan `403`, bukan data tanpa batas.
- [ ] Definisikan sumber reporting line yang eksplisit, misalnya `employee.managerId` atau tabel hierarchy.
- [ ] Batasi manager pada diri sendiri dan seluruh bawahan yang memang berada di bawah reporting line-nya.
- [ ] Pastikan scope tetap dibatasi `companyId` aktif.
- [ ] Cegah manipulasi `employeeId`, `companyId`, `departmentId`, atau `managerId` dari request.
- [ ] Tambahkan unit dan integration test: direct report, nested report, non-report, cross-company, hierarchy kosong, dan cyclic hierarchy.

Acceptance criteria:

- Manager tidak dapat membaca atau mengubah pegawai di luar timnya meskipun mengganti parameter request secara manual.
- Kegagalan menghitung scope tidak pernah menghasilkan akses lebih luas.

### 2. Audit tenant isolation dan data scope seluruh modul

- [ ] Buat matriks endpoint vs role vs scope untuk employee, attendance, leave, overtime, reimbursement, payroll, loan, performance, recruitment, training, announcement, document, dan reporting.
- [ ] Pastikan `companyId` berasal dari session/token/context server yang tervalidasi.
- [ ] Jangan mempercayai `companyId` dan `employeeId` milik aktor dari body/query/path.
- [ ] Terapkan scope pada query database, bukan filter setelah data dibaca.
- [ ] Tambahkan negative test cross-tenant pada endpoint list, detail, export, update, delete, dan approval.
- [ ] Uji IDOR dengan ID valid milik perusahaan lain.

### 3. Amankan file upload dan download

- [x] Hentikan publikasi seluruh direktori upload melalui `express.static` tanpa otorisasi.
- [ ] Sajikan semua dokumen/file privat melalui controller yang memeriksa session, company, ownership, role, dan scope.
- [ ] Gunakan nama file acak; jangan expose path internal atau nama file mentah sebagai storage key.
- [ ] Validasi MIME berdasarkan content/signature, ekstensi, ukuran, jumlah file, dan kategori yang diizinkan.
- [ ] Tambahkan header download aman: `Content-Disposition`, `X-Content-Type-Options`, dan cache policy yang sesuai.
- [ ] Pertimbangkan malware scan dan object storage dengan signed URL berumur pendek.
- [ ] Tambahkan test akses anonim, cross-company, URL tebakan, path traversal, dan MIME spoofing.

### 4. Perbaiki health/readiness check

- [x] `/health` atau readiness memeriksa MySQL/database utama dengan timeout pendek.
- [x] Bedakan liveness dan readiness.
- [ ] Masukkan dependency kritis lain seperti Redis/queue bila aplikasi tidak siap melayani request tanpanya.
- [x] Jangan bocorkan credential atau detail internal dalam response health.
- [ ] Tambahkan test kondisi database down dan recovery.

### 5. Benahi session bootstrap dan penyimpanan auth frontend

- [x] Jangan menjadikan `localStorage` sebagai sumber kebenaran untuk `isAuthenticated`, role, dan permission.
- [x] Saat aplikasi dibuka atau di-refresh, panggil `/auth/me` sebelum merender route privat.
- [ ] Simpan hanya data non-sensitif yang benar-benar diperlukan; utamakan cookie `HttpOnly`, `Secure`, dan `SameSite` untuk session.
- [x] Jika `/auth/me` gagal `401/403`, bersihkan state dan arahkan ke login.
- [ ] Refresh role/permission setelah perubahan akses tanpa mengandalkan data lama.
- [ ] Buat auth loading screen agar tidak terjadi flash halaman privat atau redirect palsu.
- [ ] Tambahkan test refresh browser, session expired, permission berubah, multi-tab logout, dan user disabled.

### 6. Pastikan proteksi CSRF menyeluruh

- [ ] Petakan semua request mutasi: `POST`, `PUT`, `PATCH`, dan `DELETE`.
- [x] Bootstrap CSRF token secara eksplisit sebelum mutasi pertama atau gunakan mekanisme server yang terdokumentasi.
- [x] Jangan sekadar memasang header bila cookie kebetulan sudah ada.
- [x] Tangani token expired/rotated dan retry maksimum satu kali secara aman.
- [ ] Verifikasi konfigurasi CORS, credentials, origin, SameSite, dan HTTPS produksi.
- [ ] Tambahkan integration test untuk token hilang, salah, expired, origin tidak sah, serta request valid.

## P1 — Integritas Bisnis dan API

### 7. Selaraskan kontrak API

- [ ] Hasilkan OpenAPI/Swagger dari sumber yang terjaga dan publikasikan untuk lingkungan internal.
- [x] Perbaiki mismatch validator/controller pada employee loan.
- [x] Perbaiki ketidakkonsistenan work-calendar ID antara query dan path parameter.
- [ ] Audit seluruh DTO, validator, controller, service, dan client agar nama field, type, nullable, enum, pagination, serta error sama.
- [ ] Standarkan response envelope dan error code yang dapat digunakan frontend/mobile.
- [ ] Tambahkan contract test frontend-backend dan mobile-backend.
- [ ] Perbarui dokumentasi mobile API agar tidak mengarahkan client mengirim identitas aktor yang seharusnya berasal dari session.

### 8. Selesaikan payroll formula dengan aman

- [ ] Jangan menampilkan formula sebagai fitur aktif bila masih `coming soon`.
- [ ] Tentukan grammar/DSL terbatas; jangan memakai `eval` atau eksekusi JavaScript arbitrer.
- [ ] Validasi referensi komponen, tipe nilai, pembagian nol, siklus dependency, dan batas kompleksitas.
- [ ] Sediakan preview/simulation sebelum publish.
- [ ] Versioning formula dan effective date wajib tersedia.
- [ ] Simpan audit trail perubahan dan hasil kalkulasi.
- [ ] Tambahkan test deterministik, pembulatan, pajak, prorata, retroactive adjustment, dan edge case.

### 9. Matangkan payroll disbursement

- [ ] Bedakan state `draft`, `approved`, `exported`, `submitted`, `processing`, `paid`, `partially_failed`, `failed`, `reconciled`, dan `cancelled` sesuai kebutuhan nyata.
- [ ] Terapkan maker-checker/segregation of duties.
- [ ] Gunakan idempotency key agar submit ulang tidak membayar dua kali.
- [x] Rekonsiliasi per pegawai/transaksi, bukan hanya per file CSV.
- [ ] Lindungi nomor rekening dan data payroll di log, UI, export, dan audit.
- [x] Jika belum ada integrasi bank, labeli fitur dengan jujur sebagai export bank file, bukan pembayaran selesai.
- [x] Tambahkan test duplicate submission, partial failure, retry, rollback, dan reconciliation mismatch.

### 10. Kurangi type escape pada modul finansial

- [ ] Inventarisasi seluruh `as any` di payroll, reimbursement, loan, dan reporting.
- [ ] Ganti dengan DTO/type yang jelas dan type guard untuk input eksternal.
- [ ] Aktifkan aturan lint agar penambahan `any` baru gagal tanpa alasan terdokumentasi.
- [ ] Tambahkan test untuk nominal besar, decimal precision, nilai negatif, null, dan currency.

### 11. Audit workflow approval

- [ ] Pastikan aktor tidak dapat menyetujui permintaan sendiri kecuali kebijakan eksplisit memperbolehkan.
- [ ] Terapkan urutan approver, delegation, escalation, cancellation, recall, dan rejection reason.
- [ ] Gunakan transaction/locking untuk mencegah double approval dan race condition.
- [ ] Catat before/after, actor, timestamp, IP/request ID, dan alasan pada audit trail.
- [ ] Pastikan notifikasi tidak dianggap bukti transaksi berhasil.

## P1 — Testing, CI/CD, dan Operasional

### 12. Tambahkan CI milik repository

- [ ] Commit workflow CI ke `.github/workflows` dan jangan mengecualikannya dari version control.
- [ ] Jalankan install reproducible, lint, type-check, unit test, integration test, build frontend, build backend, serta dependency/security scan.
- [ ] Gunakan MySQL dan dependency nyata untuk integration test kritis.
- [ ] Jadikan test advisory lock/payroll concurrency bagian dari pipeline.
- [ ] Proteksi branch agar merge membutuhkan pipeline hijau.
- [ ] Jangan menyimpan secret di repository atau log CI.

### 13. Tambahkan E2E untuk critical journey

- [ ] Login, logout, expired session, reset password bila tersedia.
- [ ] Admin membuat/mengubah employee dan assignment.
- [ ] Employee check-in/check-out dan koreksi attendance.
- [ ] Leave/overtime/reimbursement submit sampai approval/rejection.
- [ ] Payroll calculate, review, approve, lock, export/submit, dan reconcile.
- [ ] Role/permission berubah saat user sedang login.
- [ ] Negative E2E untuk forbidden route dan cross-tenant access.
- [ ] Jalankan minimal smoke E2E di CI.

### 14. Security verification

- [ ] Tambahkan SAST, dependency audit, secret scan, dan container scan bila memakai image.
- [ ] Jalankan DAST pada staging untuk auth, IDOR, CSRF, XSS, injection, upload, dan rate limit.
- [ ] Uji brute force/rate limit login dan endpoint sensitif.
- [ ] Verifikasi security headers dan CSP tanpa merusak UI.
- [ ] Dokumentasikan threat model untuk tenant isolation, payroll, dokumen, dan approval.

### 15. Deployment reproducible

- [ ] Sediakan dokumentasi environment variable lengkap tanpa nilai secret.
- [ ] Sediakan Docker Compose atau manifest deployment yang benar-benar dapat dijalankan bila arsitektur memerlukannya.
- [ ] Jalankan migration secara aman dan satu kali pada deployment.
- [ ] Tambahkan rollback plan aplikasi dan database.
- [ ] Verifikasi backup serta lakukan restore drill terjadwal.
- [ ] Dokumentasikan seed/demo data terpisah dari produksi.

### 16. Observability

- [ ] Tambahkan structured logging dengan request/correlation ID.
- [ ] Redact password, token, cookie, rekening bank, gaji, NIK, dan PII lain.
- [ ] Tambahkan metric latency, error rate, throughput, DB pool, queue depth, job failure, dan auth failure.
- [ ] Tambahkan tracing untuk request/job kritis bila memungkinkan.
- [ ] Buat alert untuk error rate, dependency down, payroll job gagal, queue macet, dan disk/storage.
- [ ] Definisikan retention log dan aksesnya.

## P2 — UI/UX Website

### 17. Konsistensi bahasa dan istilah

- [ ] Pilih Bahasa Indonesia sebagai default atau implementasikan i18n dengan konsisten.
- [ ] Hilangkan campuran istilah seperti `Submit`, `Save`, `Employee`, `Leave`, dan padanannya pada flow yang sama.
- [ ] Buat glossary istilah HR agar menu, judul, tombol, status, toast, dan error konsisten.
- [ ] Gunakan format tanggal, jam, angka, dan mata uang Indonesia secara konsisten.

### 18. Standarkan design system

- [ ] Definisikan token warna, typography, spacing, radius, shadow, dan breakpoint.
- [ ] Satukan variant button, input, select, table, badge, dialog, drawer, toast, skeleton, empty state, dan error state.
- [ ] Pastikan semua komponen memiliki focus, hover, active, disabled, loading, error, dan success state.
- [ ] Hindari hard-coded style yang berulang.
- [ ] Verifikasi contrast, keyboard navigation, focus order, label form, dan screen-reader name.

### 19. Navigasi dan information architecture

- [ ] Kelompokkan menu berdasarkan tugas pengguna, bukan struktur database/backend.
- [ ] Tampilkan hanya menu yang boleh diakses, namun server tetap wajib memeriksa izin.
- [ ] Tambahkan breadcrumb dan judul halaman konsisten.
- [ ] Pertahankan state filter/pagination ketika kembali dari halaman detail.
- [ ] Buat global search/quick action hanya bila data scope sudah aman.
- [ ] Pastikan sidebar dan mobile web navigation tetap usable pada layar kecil.

### 20. Dashboard berbasis peran

- [ ] Employee: attendance hari ini, sisa cuti, pengajuan, payslip, dan pengumuman.
- [ ] Manager: pending approval, anggota tidak hadir, anomali, dan ringkasan tim.
- [ ] HR/Admin: headcount, attendance anomaly, kontrak berakhir, onboarding, payroll status, dan alert operasional.
- [ ] Setiap kartu memiliki loading, empty, error, drill-down, serta scope yang benar.
- [ ] Hindari vanity metric yang tidak membantu tindakan pengguna.

### 21. Tabel dan form enterprise

- [ ] Standarkan server-side search, filter, sorting, pagination, dan export.
- [ ] Tampilkan active filter serta tombol reset.
- [ ] Gunakan confirmation untuk aksi berisiko dan cegah double-submit.
- [ ] Validasi field saat relevan, fokus ke error pertama, dan pertahankan input setelah gagal.
- [ ] Gunakan draft/autosave hanya untuk form panjang dan dengan status yang jelas.
- [ ] Export harus menghormati filter, permission, dan data scope.

### 22. Performance frontend

- [ ] Terapkan lazy loading per route/modul secara konsisten.
- [ ] Analisis bundle dan pecah dependency besar yang tidak diperlukan di initial load.
- [ ] Hindari request ganda saat bootstrap dan re-render.
- [ ] Gunakan cache/query invalidation yang eksplisit setelah mutasi.
- [ ] Virtualisasi tabel/list besar jika hasil profiling membuktikan perlu.
- [ ] Tetapkan performance budget dan ukur halaman kritis.

## P3 — Dokumentasi dan Kebersihan Repository

### 23. Status fitur yang jujur

- [ ] Ganti klaim `100%` dengan status: `planned`, `partial`, `implemented`, `tested`, `production-ready`.
- [ ] Bedakan keberadaan UI, API, business rule, test, keamanan, dan kesiapan operasional.
- [ ] Tandai payroll formula/disbursement sesuai kemampuan aktual.
- [ ] Buat known limitations dan production-readiness checklist.

### 24. Lisensi dan repository hygiene

- [ ] Selaraskan visibilitas repository dengan klaim proprietary pada README/LICENSE.
- [ ] Hapus `.DS_Store`, output test, coverage, log, build artifact, dan file lokal dari version control.
- [ ] Rapikan `.gitignore` tanpa mengecualikan CI atau konfigurasi deployment yang semestinya dimiliki repository.
- [ ] Gunakan commit message yang menjelaskan tujuan perubahan.
- [ ] Tambahkan CONTRIBUTING, setup lokal, test guide, migration guide, dan security reporting policy.

## Urutan Eksekusi yang Disarankan

- [ ] Sprint 1: `MANAGER_TEAM`, tenant isolation, private upload/download, auth bootstrap, CSRF, health check.
- [ ] Sprint 2: contract API, workflow approval, formula payroll, disbursement lifecycle, financial typing.
- [ ] Sprint 3: CI, integration/E2E/security test, reproducible deployment, observability.
- [ ] Sprint 4: design system, i18n, navigation, dashboards, forms/tables, performance.
- [ ] Sprint 5: dokumentasi, production readiness review, load test, restore drill, dan UAT.

---

# Prompt Codex Siap Tempel

```text
Kamu adalah senior full-stack engineer, application security engineer, QA engineer, dan product-minded UI/UX engineer. Kerjakan repository berikut secara langsung:

https://github.com/solusidigitalkita1001-sudo/hris-draft.git

Tujuan:
Meningkatkan HRIS website menuju kualitas production-ready dan pengalaman pengguna setara produk HRIS matang seperti GreatDay. Fokus utama adalah keamanan multi-company, akurasi logic HR/payroll, kestabilan, test coverage, dan konsistensi UI/UX.

Gunakan file `checklist-dan-prompt-perbaikan-hris-website.md` di repository sebagai backlog dan source of truth. Jika file belum ada, gunakan checklist yang menyertai prompt ini.

ATURAN KERJA WAJIB

1. Jangan langsung mengubah kode. Mulai dengan membaca:
   - AGENTS.md/CLAUDE.md/CODEX.md dan instruksi repository lainnya;
   - README, package manager, env example, schema/migrations;
   - arsitektur frontend dan backend;
   - auth/session, RBAC, data scope, upload, payroll, approval, dan test setup.
2. Jalankan baseline lint, type-check, test, dan build. Catat command, hasil, dan kegagalan awal.
3. Periksa `git status`. Jangan menimpa atau menghapus perubahan milik user yang tidak terkait.
4. Kerjakan secara bertahap sesuai P0 -> P1 -> P2 -> P3. P0 harus selesai dan terverifikasi sebelum pekerjaan kosmetik.
5. Buat perubahan kecil dan reviewable. Jangan melakukan rewrite besar tanpa bukti kebutuhan.
6. Pertahankan stack, pola arsitektur, dan style repository kecuali ada alasan teknis kuat.
7. Jangan mengubah kontrak API atau schema secara diam-diam. Jika perlu, update seluruh consumer, migration, test, dan dokumentasi.
8. Jangan memakai `eval`, hardcoded secret, bypass authorization, filter data hanya di client, atau `as any` untuk menutupi error type.
9. Semua akses data harus fail-closed dan dibatasi company + role + data scope di server.
10. Jangan mempercayai `companyId`, `employeeId`, role, permission, manager, atau owner dari input client bila bisa diturunkan dari session dan database.
11. Jangan menyatakan pekerjaan selesai hanya karena build berhasil. Tambahkan test positif, negatif, cross-tenant, dan regression yang relevan.
12. Jangan push, deploy, membuat PR, atau mengubah secret tanpa izin eksplisit.

FASE 1 — AUDIT DAN RENCANA

- Petakan struktur aplikasi, database, endpoint, route frontend, permission, dan critical journey.
- Buat matriks endpoint x role x data scope x company isolation.
- Cocokkan temuan aktual terhadap checklist.
- Untuk setiap item tulis: status, bukti file/baris atau test, risiko, solusi, dependency, dan acceptance criteria.
- Tandai temuan tambahan yang tidak ada di checklist.
- Setelah audit, buat rencana implementasi berurutan dengan estimasi relatif S/M/L.
- Jika ada keputusan bisnis yang benar-benar ambigu, ajukan pertanyaan singkat. Untuk keputusan teknis yang aman dan reversible, lanjutkan dengan asumsi yang dicatat.

FASE 2 — P0 SECURITY DAN PRODUCTION BLOCKERS

A. MANAGER_TEAM
- Temukan implementasi data scope `MANAGER_TEAM`, terutama di administration service dan semua consumer.
- Hilangkan kondisi yang hanya warning lalu membiarkan query tanpa filter.
- Implementasikan fail-closed segera.
- Jika model reporting hierarchy tersedia, implementasikan direct dan nested reports secara aman serta cegah cycle.
- Terapkan filter scope langsung pada database query dan selalu gabungkan dengan company aktif.
- Tambahkan test untuk direct report, nested report, non-report, cross-company, hierarchy kosong, forged ID, dan cycle.

B. Tenant isolation
- Audit list/detail/create/update/delete/export/approve di seluruh modul.
- Ambil identitas aktor dan company dari session/context server yang tervalidasi.
- Tambahkan negative integration test cross-company dan IDOR.

C. Upload/download
- Hilangkan static exposure untuk file privat.
- Gunakan authenticated download endpoint dengan ownership, permission, scope, dan company checks.
- Validasi ukuran, MIME signature, extension, filename, path, dan kategori file.
- Tambahkan test anonymous access, cross-company, guessed URL, traversal, dan MIME spoofing.

D. Auth frontend
- Jadikan `/auth/me` sebagai sumber kebenaran pada bootstrap route privat.
- Jangan percaya persisted `isAuthenticated`, role, atau permissions.
- Tangani loading, 401/403, session expired, role change, user disabled, dan multi-tab logout.
- Gunakan session cookie yang aman sesuai arsitektur aplikasi.

E. CSRF
- Pastikan semua mutasi terlindungi.
- Implementasikan token bootstrap/rotation yang jelas dan aman.
- Verifikasi CORS, credential, origin, SameSite, Secure, dan HTTPS behavior.
- Tambahkan test valid/invalid/missing/expired token serta invalid origin.

F. Health checks
- Pisahkan liveness dan readiness.
- Readiness harus mengecek database utama dan dependency kritis dengan timeout.
- Tambahkan test dependency down dan recovery.

Setelah Fase 2:
- Jalankan lint, type-check, seluruh unit/integration test, build, dan test security yang relevan.
- Berikan ringkasan file yang berubah, bukti test, risiko tersisa, dan checklist P0 yang telah dicentang.
- Jika P0 belum aman, jangan lanjut ke UI polish.

FASE 3 — BUSINESS LOGIC DAN API

- Selaraskan DTO/validator/controller/service/client dan hasilkan OpenAPI.
- Perbaiki mismatch employee-loan serta work-calendar ID berdasarkan implementasi aktual.
- Buat contract tests.
- Audit approval untuk self-approval, ordering, delegation, race condition, transaction, idempotency, dan audit trail.
- Implementasikan payroll formula hanya dengan DSL/parser terbatas, dependency validation, cycle detection, versioning, effective date, preview, dan deterministic tests. Jangan gunakan eval.
- Matangkan disbursement lifecycle, maker-checker, idempotency, per-transaction reconciliation, retry, dan partial failure. Jika hanya CSV export, beri label fitur yang akurat.
- Kurangi `as any` pada modul finansial dan tambahkan type guards serta decimal/rounding tests.

FASE 4 — QUALITY ENGINEERING DAN OPERASIONAL

- Tambahkan workflow CI yang dimiliki repository: install reproducible, lint, type-check, unit, integration dengan MySQL nyata, build, security scan, dan smoke E2E.
- Tambahkan E2E untuk auth, employee, attendance, leave/overtime/reimbursement approval, dan payroll lifecycle.
- Tambahkan SAST, dependency audit, secret scan, dan panduan DAST staging.
- Sediakan konfigurasi deployment reproducible, migration strategy, rollback, backup, dan restore drill.
- Tambahkan structured logging, correlation ID, redaction, metrics, dependency/job monitoring, dan alert recommendations.

FASE 5 — UI/UX

- Audit route dan komponen sebelum membuat ulang UI.
- Konsistenkan bahasa/istilah, locale tanggal/angka/mata uang, serta status labels.
- Konsolidasikan design tokens dan reusable component states.
- Pastikan accessibility: keyboard, focus, semantic labels, contrast, dan responsive layout.
- Perbaiki navigation, breadcrumb, role-based dashboard, filter persistence, tabel, form validation, empty/loading/error/success state, dan double-submit prevention.
- Terapkan lazy loading per route dan optimasi hanya berdasarkan profiling/bundle analysis.
- Jangan menyembunyikan masalah authorization dengan sekadar menyembunyikan tombol/menu.

FASE 6 — DOKUMENTASI DAN FINAL VERIFICATION

- Ubah dokumentasi status fitur menjadi planned/partial/implemented/tested/production-ready.
- Sinkronkan README, API docs, env docs, migrations, setup, test guide, deployment, known limitations, dan security policy.
- Rapikan repository tanpa menghapus file user yang tidak terkait.
- Jalankan seluruh quality gate final dari clean install bila memungkinkan.

FORMAT LAPORAN SETIAP ITERASI

1. Outcome singkat.
2. Checklist yang diselesaikan.
3. File yang diubah dan alasan.
4. Migration/API compatibility impact.
5. Test command dan hasil aktual (passed/failed/skipped; jangan mengarang).
6. Security verification, termasuk negative/cross-tenant tests.
7. Risiko atau blocker tersisa.
8. Langkah berikutnya berdasarkan prioritas.

DEFINITION OF DONE

- Tidak ada authorization path yang fail-open.
- Cross-company dan IDOR tests lulus untuk endpoint kritis.
- File privat tidak dapat diakses anonim atau lintas scope.
- Auth bootstrap tidak bergantung pada permission/session lokal yang stale.
- Semua endpoint mutasi kritis memiliki CSRF protection yang teruji.
- Payroll/approval menggunakan transaction, locking/idempotency yang sesuai dan memiliki regression tests.
- Lint, type-check, unit, integration, build, dan critical E2E lulus.
- UI menyediakan seluruh state penting, responsive, accessible, dan konsisten.
- Dokumentasi tidak melebih-lebihkan kesiapan fitur.

Mulai sekarang dengan audit repository dan baseline verification. Setelah itu kerjakan P0 satu per satu. Jangan berhenti pada rekomendasi: implementasikan, uji, dan perbarui checklist, tetapi berhenti dan laporkan jika dibutuhkan keputusan bisnis, credential/akses baru, destructive migration, deployment, atau perubahan kontrak eksternal yang belum diotorisasi.
```

## Cara Pakai

1. Simpan file ini di root repository.
2. Buka repository di Codex.
3. Tempel seluruh bagian **Prompt Codex Siap Tempel**.
4. Minta Codex menyelesaikan P0 dahulu; review diff dan hasil test sebelum lanjut P1.
5. Jalankan dalam beberapa sesi agar perubahan tetap kecil dan mudah ditinjau.
