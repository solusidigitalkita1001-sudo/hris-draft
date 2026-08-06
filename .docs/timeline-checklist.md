# Timeline & Checklist Hardening HRIS Enterprise

Estimasi total durasi: **14 minggu (~3.5 bulan)** untuk Batch 0 + Batch 1 (Go-live Ready)
Asumsi tim: 2 Backend, 2 Frontend, 1 DevOps, 1 QA, 1 Tech Lead (part-time)

---

## Fase 0: Week 0 - Pre-Flight & Security Foundation (1 Minggu)

Target: Semua **CRITICAL severity** (14 items) + environment stabilization SEBELUM lanjut development.
Owner: Tech Lead + Backend Senior

| # | Task | Dependensi | Estimasi | Status | Acceptance Criteria | Gap ID |
|---|------|------------|----------|--------|---------------------|--------|
| 0.1 | **Env Validation**: Tambahkan Zod schema validation untuk config saat bootstrap. Jangan fallback ke hardcoded secrets — THROW ERROR jika required env tidak ada | - | 4h | ✅ | `npm run dev` gagal exit 1 jika JWT secrets, DB URL, encryption key tidak di-set. Pesan error jelas env mana yang missing | SEC-001, SEC-002, OPS-002 |
| 0.2 | **CSRF Protection**: Pasang CSRF middleware (`csurf` atau custom double-submit cookie pattern) untuk semua mutation endpoint. Inject CSRF token di cookie HttpOnly, client include via header `X-CSRF-Token` | 0.1 | 8h | ☐ | Postman tanpa header CSRF dapat 403 Forbidden. Form mutation login/change password/payslip create tetap berjalan dengan token | SEC-003 |
| 0.3 | **Field-level PII Encryption**: Implementasi `CryptoService` dengan AES-256-GCM pakai `config.encryption.key`. Wrapper Prisma middleware untuk encrypt/decrypt otomatis field: `idNumber, taxId, bpjsKetenagakerjaan, bpjsKesehatan, bankAccount, bankAccountHolder, phone, address`. Migration backfill encrypt data existing | 0.1 | 24h | ☐ | SELECT langsung dari MySQL Workbench menampilkan ciphertext bukan NIK asli. API response return plaintext jika authorized. Semua query existing tidak broken | SEC-004, SEC-018 |
| 0.4 | **Payroll Data Encryption**: Sama seperti 0.3 tapi untuk `baseSalary, totalNetPay, amount` di tabel payslip & employee salary. Perlu encrypt DECIMAL → convert ke string dulu, encrypt, store ke kolom BLOB/VARCHAR baru atau existing dengan note backward compatibility | 0.3 | 16h | ☐ | PayrollDetail API return angka benar. DB show ciphertext untuk sensitive amount | SEC-005 |
| 0.5 | **Forgot Password Flow Lengkap**: (1) POST `/auth/forgot-password` generate random token 32 bytes, hash & simpan ke table (baru) `password_reset_tokens` dengan expiry 15m, kirim email link via Nodemailer. (2) GET `/auth/reset-password?token=` validate token exist & not expired & not used. (3) POST `/auth/reset-password` confirm new password bcrypt/argon, mark token used, logout all session | 0.1 | 12h | ☐ | Email reset password terkirim (Mailtrap/SMTP test). Token expired tidak bisa pakai 2x. Password baru berhasil login | FTR-001, SEC-007 |
| 0.6 | **Refresh Token Whitelist Enforcement**: Saat `POST /auth/refresh` → check refresh token signature exist di `RefreshToken` table AND not revoked. Saat `POST /auth/logout` → hard delete / soft revoke refresh token record DB. Blacklist access token logout via Redis TTL list (key pattern: `blacklist:access:<jti>`) | 0.1 | 12h | ☐ | Refresh token dihapus dari DB → `/auth/refresh` dapat 401. Logout → token tidak bisa dipakai lagi sisa TTL | SEC-008 |
| 0.7 | **DB Index Audit + Composite Indexes**: Buat migration tambah composite indexes: `employees(companyId, employmentStatus, departmentId, status)`, `attendances(companyId, employeeId, clock_in_date DESC)`, `payslips(payrollRunId, employeeId)`, `audit_logs(companyId, created_at DESC, resource, action)`. Drop unused single index | - | 8h | ☐ | `EXPLAIN` query employee list + attendance monthly → type=ref/eq_ref bukan ALL. Rows scanned < 10% dari total | PERF-001 |
| 0.8 | **Rate Limiter Redis-backed + Auth Endpoint Specific**: Ganti global limiter pakai `rate-limit-redis` store. Tambahkan specific rate limiter untuk `/auth/*`: 5 requests / 10m / IP + per-email lockout 15m setelah 3 failed login (sudah ada di auth.service tapi perlu dipasang di route level) | 0.1 | 6h | ☐ | Server 2 pod → hit endpoint 100x dari IP sama → 429 konsisten antar pod. Login salah 5x → lock account 15m dari IP mana pun | SEC-012, OPS-006 |
| 0.9 | **Setup Unit Test Foundation + CI**: Backend: 1 sample test untuk AuthService.login happy path & failed path (Jest). Frontend: 1 sample test render LoginPage component (Vitest). Setup GitHub Actions step: `lint`, `typecheck`, `test` BEFORE deploy step. Remove `--passWithNoTests` agar CI gagal jika test suite ada yang empty | - | 12h | ☐ | Push ke branch → GitHub Actions menjalankan semua check dan PASS. Edit kode buat test fail → job fail & deploy tertahan | QA-001, QA-002, QA-003, OPS-010 |
| 0.10 | **DB Backup + Restore Runbook Manual**: (1) Create S3-compatible bucket (MinIO/AWS S3). (2) Script `scripts/backup-db.sh` mysqldump full + encrypt + upload. (3) Script restore. (4) Prisma migration rollback strategy: tag setiap migration dengan git tag, step restore schema + data snapshot. (5) Verify restore berhasil dengan test query count employee | - | 8h | ☐ | Manual run backup → file muncul di S3 encrypted. Restore ke DB staging → data match. Document step by step runbook | OPS-001 |

### Fase 0 Exit Criteria
- [ ] Semua 14 CRITICAL gap di checklist di atas ter-close
- [ ] `npm test` pass (1 backend + 1 frontend minimal test)
- [ ] Security scan statis: ESLint security plugin pass, no hardcoded secret
- [ ] DB encryption active for PII fields, verified via MySQL CLI ciphertext check

---

## Fase 1: Week 1-3 - Security Hardening + Critical Validation (3 Minggu)

Target: Close semua **HIGH severity Security (SEC-006 s/d SEC-014)**, **HIGH severity Validation**, Payment & payroll data integrity.
Owner: Backend Team (2 orang)

| # | Task | Minggu ke- | Estimasi | Status | AC | Gap |
|---|------|------------|----------|--------|----|-----|
| 1.1 | **MFA TOTP Implementation**: Generate secret (speakeasy library), QR code PNG (qrcode) pada enable, verify TOTP code saat login step 2. Recovery codes (10 buah, bcrypt simpan 1x pakai). Force MFA untuk SUPER_ADMIN, HR_MANAGER role | 1 | 16h | 🔶 | User enable MFA → scan QR → input code → 2FA active. Next login: after password correct, prompt TOTP. Wrong code → error. Recovery code bisa dipakai 1x untuk bypass | SEC-006 |
| 1.2 | **File Upload Hardening**: (1) Magic byte validation (bukan cuma Content-Type). (2) ClamAV daemon scan async via BullMQ queue — block file sampai AV scan result clean. (3) SVG sanitize jika support nanti (current tidak allow SVG tapi future-proof). (4) Rename file upload ke UUID.random(), simpan original name di metadata column Document. (5) Limit 500KB untuk avatar, 10MB untuk dokumen | 1 | 20h | 🔶 | Upload EICAR test virus → di-reject dengan message AV detected. Upload file `virus.exe.png` (rename) → magic byte detect executable → reject. Dokumen confidential tidak bisa diakses tanpa login (next step: SEC-010 signed URL) | SEC-009, SEC-016 |
| 1.3 | **Signed URL untuk Dokumen Static**: Buat endpoint `GET /documents/:id/signed-url` dengan middleware authorize: check user punya permission document:read + ownership OR admin. Generate presigned URL TTL 15 menit dengan HMAC signature via Redis key or crypto. Ganti frontend `<iframe src=/uploads/...>` → ambil signed URL dulu | 1-2 | 16h | 🔶 | Buka URL file payslip secara langsung tanpa login → 403 (atau redirect login). Frontend tampilkan PDF dokumen via signed URL dengan expiry <15m → URL expired dapat error | SEC-010 |
| 1.4 | **Audit Log Before/After Snapshot**: Modify AuditLog middleware: on PATCH/PUT/DELETE → query existing record `before` via Prisma, JSON serialize only changed fields, log `before_payload` dan `after_payload`, mask PII encrypted (jangan log NIK asli tapi hash / last 4 digit) | 2 | 16h | ✅ | Edit employee phone → audit log record punya before: {phone: "0812xxx1234"}, after: {phone: "0857xxx5678"}. View AuditLog Detail page menampilkan XXHITXX
| 1.5 | **Hapus bcrypt, Migrate 100% ke Argon2id**: Audit PasswordHandler, pastikan hanya argon2.verify & argon.hash. Untuk existing user password bcrypt: saat login pertama sukses, re-hash password input pakai argon2 lalu update `passwordHash`. Tambah `passwordVersion` field user | 2 | 8h | 🔶 | Package.json hanya tersisa `argon2`, `bcryptjs` di-uninstall. User lama (created with bcrypt) login berhasil, passwordVersion auto upgrade ke 2 (argon2). Next login → tidak masuk rehash logic lagi | SEC-014 |
| 1.6 | **CSP Hardening + Nonce Pattern**: Generate per-request nonce crypto.randomBytes(16). Inject ke Helmet CSP `styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`]`. Embed nonce di SSR HTML head meta tag jika nanti support, atau untuk inline critical CSS yang tidak bisa dihindari | 2 | 6h | ✅ | Browser DevTools Console tidak ada CSP violation report. Hapus semua `'unsafe-inline'` dari CSP. `style-src-elem` strict | SEC-013 |
| 1.7 | **SameSite Cookie + Secure Flag**: `cookie-parser` setup untuk production: `secure: NODE_ENV===production`, `sameSite: 'lax'` atau 'strict', `httpOnly: true`. Jika ada refresh token di cookie (opsional: lebih aman dari localStorage), apply ke semua set-cookie | 2 | 4h | 🔶 | DevTools Application → Cookies → semua punya flags HttpOnly, Secure (production HTTPS), SameSite=Lax atau Strict | SEC-015 |
| 1.8 | **Validasi NIK KTP 16 Digit + Checksum**: Buat utility `validators/idNumber.ts`. Validasi: panjang harus 16, 2 digit pertama = kode provinsi valid (list BPS), 6 digit tengah = tanggal lahir (ddmmyy), bisa cek gender dari tanggal (DD > 40 = perempuan). `createEmployeeSchema.idNumber` pipe refine | 1 | 6h | ✅ | Input NIK `1122334455667788` → validation pass. Input `12345` → error "NIK harus 16 digit". Input `99xxxx` → error "Kode provinsi tidak valid" | VAL-003 |
| 1.9 | **Validasi NPWP, BPJS Jamsostek, BPJS Kesehatan**: Utility NPWP = 15 digit, format 9.999.999.9-999.999. BPJS Ketenagakerjaan = 11 digit, JKN = 13 digit. Semua refine di Zod schema DTO | 1 | 6h | ✅ | NPWP `01.234.567.8-999.999` → pass format & check digit. BPJS JHT salah 1 digit → error message | VAL-004, VAL-005 |
| 1.10 | **Phone E.164 Normalization + Validator**: Parse semua input phone → normalize ke E.164 (`+6281234567890`). Validasi panjang nomor Indonesia: prefix 08 → +62, panjang 11-13 digit. Block nomor awalan yang tidak valid (misal `+6200xxxx`) | 1 | 6h | ✅ | Input `0812 3456 7890` → DB simpan `+6281234567890`. Input `081-234` → error "Nomor HP tidak valid" | VAL-002, VAL-001 |
| 1.11 | **Bank Account Validator per Provider**: BNI 10 digit, BCA 10 digit, Mandiri 13 digit, BRI 15 digit. Validasi check digit Luhn jika provider mendukung. Simpan juga `bankCode` field | 3 | 8h | 🔶 | Bank BNI + no rekening 15 digit → error "Nomor rekening BNI maksimal 10 digit". Check digit salah → validation error | VAL-006 |
| 1.12 | **DB Unique Constraints Duplicate Check**: Prisma migration tambah `@@unique([companyId, idNumber])`, `@@unique([companyId, phone])` — dengan catatan: phone bisa null, NULL tidak dihitung duplicate MySQL, jadi hanya enforce jika phone/idNumber di-isi | 3 | 4h | ✅ | Insert 2 employee company sama dengan NIK sama → Prisma UniqueConstraintViolation → ConflictError handler return 409 "NIK sudah terdaftar di perusahaan ini" | VAL-008 |
| 1.13 | **Enum Constraint untuk Gender, Religion, MaritalStatus, BloodType**: Ganti `Employee.gender` dari String ke enum `GENDER = [MALE, FEMALE]`, `RELIGION = [ISLAM, KRISTEN_PROTESTAN, KRISTEN_KATOLIK, HINDU, BUDDHA, KONGHUCU, LAINNYA]`, `MARITAL_STATUS`, `BLOOD_TYPE` → Prisma enum + migration + DTO enum refine | 3 | 8h | ✅ | Input gender = "L" → error "must be MALE or FEMALE". DTO type safe, autocomplete di IDE | VAL-014, VAL-015 |
| 1.14 | **Relasi Logic Validasi di Service Layer**: (a) `joinDate > dateOfBirth + 15 tahun` (usia minimal kerja 15). (b) `resignationDate > joinDate`. (c) `careerTransaction effectiveDate` tidak overlap. (d) `loanStartDate > joinDate` | 3 | 8h | 🔶 | Create employee DOB 2020, joinDate 2025 → error "Usia minimal 15 tahun saat join". Promotion tgl sebelum join → reject | VAL-007 |
| 1.15 | **Leave Balance Race Condition Fix**: Bungkus `LeaveService.approve()` dalam `prisma.$transaction` isolation level SERIALIZABLE atau REPEATABLE READ + `SELECT ... FOR UPDATE` (prisma findUnique with `lock: t` via raw query). Pastikan approve paralel 2 request hasilnya balance TIDAK minus | 3 | 8h | ✅ | Artillery / k6 test hit approve leave 10 request concurrent dengan sisa balance 1 → hanya 1 yang SUCCESS (200), 9 gagal (400 "Leave balance tidak cukup"). Balance akhir 0. | VAL-011 |

### Fase 1 Exit Criteria
- [ ] 10/10 High Security gap close (SEC-006 s/d SEC-015)
- [ ] 8/8 High Validation close (VAL-002 s/d VAL-011)
- [ ] Scan OWASP ZAP baseline terhadap staging → no critical/high alerts
- [ ] Unit test coverage >= 40% untuk modules: auth, employee, leave, payroll

---

## Fase 2: Week 4-7 - Performance + Payroll Foundation (4 Minggu)

Target: Close HIGH severity Performance + Fitur Payroll/Performa critical.
Owner: Backend + QA (1 orang tambahan)

| # | Task | Minggu | Estimasi | Status | AC | Gap |
|---|------|--------|----------|--------|----|-----|
| 2.1 | **Service Layer Caching for Static Data**: Buat decorator `@Cached({ ttl: 300_000 })` atau utility wrapper untuk method findAll yang data jarang berubah: `RoleService.findAll`, `PermissionService`, `LeaveType`, `SalaryComponent`, `WorkCalendar`, `BenefitPlan`. Key pattern `hrms:cache:v1:<companyId>:<resource>:<hash>` | 4 | 16h | ☐ | Hit endpoint `/leave/types` 2x berturut — response pertama DB query ~50ms, kedua dari cache <5ms. Redis Monitor melihat GET/SET keys. Update salary component → `eventBus.publish` → subscriber invalidasi cache key company terkait | PERF-003, OPS-009 |
| 2.2 | **Prisma Query N+1 Audit & Fix**: Audit semua repository.findAll dengan Prisma `include` + `select` explicit. Lazy-load relations diganti eager-load 1 query dengan nested include. Case khusus: Employee detail 7 tab → conditional include per tab request query param | 4-5 | 24h | ✅ | Query employee list 50 rows + position + department → Prisma logs hanya 1 query findMany bukan 51 query. `prisma.$on('query')` count <3/page | PERF-002 |
| 2.3 | **Payroll Run Async via BullMQ Queue + Chunking**: Refactor `PayrollRun.create` → return payrollRunId status=PROCESSING, dispatch BullMQ job. Worker process chunk 50 employee/chunk, transaction per chunk. Progress update di PayrollRun.progressPercent via Redis counter. Frontend poll progress endpoint / websocket | 5-6 | 32h | ☐ | Trigger payroll run untuk 5000 employee via queue. Worker proses bertahap. Status → PROCESSING (10%) → 50% → COMPLETED. DB CPU <80% selama proses. Tidak ada timeout. Gagal 1 chunk → rollback chunk saja, tidak affect chunk lain. Log error chunk ke table payroll_run_errors | FTR-003, PERF-005 |
| 2.4 | **Attendance Monthly Report Materialized View / Pre-aggregation**: Buat stored procedure + event scheduler MySQL atau BullMQ schedule setiap malam (cron 01:00) — aggregate attendance summary per employee per bulan → insert ke table `attendance_monthly_summaries` (employeeId, month, presentDays, absent, leaveDays, overtimeHours). Report read dari summary table, bukan raw | 6 | 16h | ☐ | Generate report bulan berjalan untuk 10.000 employee → response <1s dari summary table. Manual trigger recalc jika ada perubahan data absensi retroactive | PERF-006 |
| 2.5 | **Employee CSV Import Transactional + Error Report**: Refactor import CSV → parse semua rows dulu, validasi 100% di-memory (zod schema + business check), collect errors. Jika 0 error → transaction insert all. Jika ada error → return structured error `{ totalRows, validCount, invalidCount, errors:[{row, col, value, message}] }` TANPA insert apapun. Frontend tampilkan report dengan highlight row error | 6 | 16h | ✅ | Import 1000 rows CSV dengan 1 row error (NIK kurang digit) → 999 rows TIDAK terinsert, response error report jelas row keberapa field apa error message apa. Import tanpa error → 1 transaction, 1000 rows inserted sukses | FTR-004 |
| 2.6 | **PPh 21 Pasal 21 Monthly Tax Calculation Engine**: Implementasi formula peraturan Menkeu terbaru: (1) Hitung gross per bulan, (2) Potongan BPJS non-taxable, (3) PTKP tergantung status (TK/0 = 54jt, K/0 = 58.5jt, K/I dll), (4) PKP = gross setahun * 12 - PTKP, (5) PPh 21 = tariff layer 5% 0-60jt, 15% 60-250jt, 25% 250-500jt, 30% >500jt. (6) Dibagi 12 bulanan. Unit test edge cases 10+ | 7 | 24h | 🔶 | 10 test case PPh21 dibanding kalkulator pajak online resmi → beda < Rp 100. Payroll preview component menampilkan breakdown PPh21 per employee | FTR-011 |
| 2.7 | **BPJS Tiered Deduction Engine**: BPJS Ketenagakerjaan: JKK (0.24-1.74% depending risk jenis industri), JKM 0.3%, JHT 3.7% (employer) + 2% (employee), JP 2% (employer) + 1% (employee). BPJS Kesehatan: 5% total upah (4% perusahaan + 1% karyawan), max cap upah 12jt. Configurable per company dalam CompanySetting | 7 | 16h | ✅ | Komponen payroll auto-deduct BPJS sesuai persentase. Kenaikan upah melebihi 12 juta untuk JKN → cap 12jt x5% calculation benar | FTR-012 |
| 2.8 | **Prisma Connection Pool Tuning**: `datasource db { url = env("DATABASE_URL")?connection_limit=40&pool_timeout=10&statement_timeout=30000 }`. Tambah `PrismaClient` `log: ['error', 'warn', 'info']` untuk slow query detection >2s, simpan ke file log | 4 | 4h | ✅ | Load test 100 concurrent payroll calc: connection pool >20 tapi <40, tidak ada "Timed out fetching a new connection from the pool". Query >30s auto kill → DB tidak hang | OPS-003 |
| 2.9 | **Prisma Read Replica Routing (readFromRepicas)**: Jika nanti AWS Aurora / replica DB ada — update Prisma Client option dengan `replicas: [new PrismaClient(readReplicaUrl)]`. Read operations `findMany/findUnique` route ke replica. Write transactional operations tetap ke primary | 4 | 8h | 🔶 | Config env READ_REPLICA_DATABASE_URL optional. Jika tidak ada fallback ke single primary. Jika ada → 60% read traffic ke replica, primary CPU menurun 40% saat payroll | OPS-004 |

---

## Fase 3: Week 8-10 - Workflow Integration + Feature Close (3 Minggu)

Target: Close HIGH severity fitur tersisa, integrate generic workflow + notification email.
Owner: Full Stack Team (2 Backend, 2 Frontend)

| # | Task | Minggu | Estimasi | Status | AC | Gap |
|---|------|--------|----------|--------|----|-----|
| 3.1 | **Generic Workflow Engine Integration**: Leave Request, Loan Request, Overtime, Permission Request, Shift Swap, Travel Advance, Expense Claim → semua approval flow pakai WorkflowEngine bukan hardcoded. Setiap company bisa custom stage approvals: (misal: Approval by Atasan → Dept Head → HR) | 8-9 | 40h | ☐ | Setting template leave approval 3 stages → submit leave → flow ke atasan → approve → flow ke Dept Head → approve → HR confirm → status APPROVED. Reject di stage manapun → status REJECTED dengan reason | FTR-007 |
| 3.2 | **Event-Driven Email Notification System**: Worker domain event handler → 18 template email: EmployeeCreated, PayslipPublished (attach PDF?), LeaveApproved/Rejected, LoanApproved, PerformanceResultPublished, InterviewScheduled, JobOfferSent, PasswordReset, AccountLocked, PasswordChanged, MFAEnabled. Pakai MJML responsive template + Nodemailer | 8 | 32h | ☐ | Approve leave → dalam <30s email masuk ke Mailtrap. Email responsive di mobile Gmail. Semua link email pakai signed URL / magic link JWT expiry | FTR-002 |
| 3.3 | **CompanyScope Middleware Audit + Auto-Apply**: Audit SEMUA routes (manual grep): endpoint dengan pattern `findAll`, `findById` yang parameter companyId optional WAJIB enforce company scope ke `req.user.companyScope`. Company ID dari param user ID bisa di-spoof → replace dengan scope. Tambahkan integration test: user COMPANY_ADMIN company A hit employee company B via ID → 403 bukan 404 leak exists | 8 | 16h | ☐ | Integration test 30+ endpoint all pass expected 403 on cross-company IDOR attempt. Burp active scan IDOR → no leak. Refactor ke Prisma middleware global agar otomatis inject where companyId IN scope tanpa manual di repo | FTR-008 |
| 3.4 | **Exit Clearance Workflow**: Submit resignation → auto-create ExitClearance items per PIC: IT (return laptop + badge + 2FA revoke), HR (return ID card + final salary calc), Finance (settle all unpaid loans + travel advances, BPJS penonaktifan). Each PIC approve item → ketika semua item CLOSED → HR bisa proses Final Payroll dan BPJS report | 9 | 16h | ☐ | Resignation submit → 3 exit clearance items ter-create dengan PIC masing-masing. IT approve → status COMPLETE. Finance reject "masih ada loan Rp 5jt" → item REJECTED, employee diberi notif untuk bayar dulu | FTR-006 |
| 3.5 | **Employee Loan Amortization Engine**: Loan create → hitung schedule cicilan per bulan: principal, bunga (flat/efektif dipilih), total cicilan, tanggal jatuh tempo, sisa pokok. Payroll run auto deduct cicilan yang due bulan itu + update loan remaining amount | 9 | 16h | ☐ | Loan Rp 10jt, tenor 10 bln, bunga 1% flat → schedule 10 row dengan cicilan tetap 1.100.000. Payroll bulan pertama → auto deduct, sisa loan jadi 9jt. Lunas → status CLOSED. | FTR-013 |
| 3.6 | **Performance Dispute SLA Auto-Escalation**: BullMQ cron job hourly check performance dispute records yang status=OPEN dan updated_at > 3 hari (configurable SLA). Auto-escalate: kirim notifikasi ke HR_MANAGER + CC previous responder, update escalation flag | 10 | 8h | ☐ | Create dispute open → fast-forward date 4 hari via cron job trigger manual → notification HR_MANAGER masuk, dispute.flag = ESCALATED | FTR-009 |
| 3.7 | **Company Switcher UI Frontend**: Zustand `company.store` action `setActiveCompany(companyId)`. Dropdown menu di TopNavigation menampilkan list `user.companyScope` dengan nama company dari lookup. Switch company → refetch semua current page data + invalidate React Query. `api.service.ts` otomatis inject `companyId` di query param / request body | 10 | 12h | ☐ | Login GROUP_ADMIN scope 5 company → dropdown muncul list 5 company. Pilih company B → list employee otomatis switch ke company B tanpa full page reload. API call query param companyId konsisten terisi | FTR-017 |
| 3.8 | **Report Module Export Endpoints**: Implementasi endpoint PDF + Excel untuk: Employee List (filtered by dept/position/status), Attendance Monthly Summary, Payroll Run Summary, Leave Balance Overview, Performance Rating Distribution, Headcount Turnover Report. Pakai csv-stringify untuk CSV, xlsx untuk Excel, jsPDF + HTML template untuk PDF | 10 | 20h | ☐ | Download payroll run report Excel via frontend → file terbuka di MS Excel, kolom sesuai, total match DB. PDF employee list → pagination, header per halaman, logo company | FTR-005 |

---

## Fase 4: Week 11-13 - Test Coverage + Performance Baseline (3 Minggu)

Target: Coverage test, load test, performance baseline, frontend UX quality.
Owner: QA + Frontend

| # | Task | Minggu | Estimasi | Status | AC | Gap |
|---|------|--------|----------|--------|----|-----|
| 4.1 | **Backend Unit Test Target >70% Critical Modules**: AuthService, EmployeeService, PayrollService, LeaveService, Auth middleware + authorize + company scope, Validator DTO, CryptoService, Tax calculation. Total 120+ test cases | 11-12 | 40h | ☐ | `npm run test:coverage` → coverage >70% lines, >80% functions untuk modules atas. Jest HTML report disimpan CI artifacts | QA-001, QA-003 |
| 4.2 | **Frontend Component & Utility Unit Tests >50%**: access-control.ts, auth.store.ts, company.store.ts, ProtectedRoute render test with mock user, 10+ form page validation error test (submit empty form → error fields muncul) | 12 | 24h | ☐ | Vitest coverage report >50% lines. Form employee create submit kosong → Zod errors muncul di semua field required | QA-005 |
| 4.3 | **Frontend Route-based Lazy Loading + Bundle Analyzer**: `React.lazy(() => import('./modules/.../Page'))` semua page-level components. Suspense fallback skeleton per page. Run `rollup-plugin-visualizer` — identify large chunks: xlsx, jspdf, recharts, lucide dynamic import only when needed | 11 | 12h | ☐ | First load JS bundle < 400KB gzip. Lighthouse LCP < 2.5s on 4G throttling. Route payroll → chunk 0.js (core) + payroll.js lazy load | PERF-008 |
| 4.4 | **Frontend TanStack Table Virtualization**: Employee list > 1000 rows enable virtualization (tanstack-virtual). Detail tabs attachment dengan images → lazy load images IntersectionObserver | 12 | 8h | ☐ | Render list 5000 employee → frame rate > 50fps. DOM node count hanya ~50 row rendered visible. Scroll smooth | PERF-007 |
| 4.5 | **Image Upload Resize Thumbnail**: Sharp library — on upload image, generate: original (compressed quality 80%, max 2048px), thumbnail 200px square, avatar 64px. Semua disimpan di uploads/ path, referensi di Document/Employee model multiple urls | 13 | 12h | ☐ | Upload foto KTP 10MB → server simpan 3 versi. Employee detail card menampilkan thumbnail 200px 15kb bukan 10MB. Page load 10 employee dengan foto → < 500KB total image transfer | PERF-009 |
| 4.6 | **E2E Playwright Test Happy Path Core 10 flows**: (1) Register company flow, (2) Create employee, (3) Clock in/out, (4) Submit leave + approve via manager login, (5) Create payroll period + run payroll, (6) Publish payslip + employee view own payslip, (7) Performance planning → self review → manager review → publish, (8) Apply loan → approval → payroll deduct, (9) Role create + assign permission, (10) Export report | 13 | 40h | ☐ | `npm run test:e2e` → 10/10 pass di headless Chrome & Firefox. CI run E2E saat PR ke main. Video artifact pada test failure | QA-002 |
| 4.7 | **Load Test k6 Critical Endpoints + Baseline**: Script k6 untuk: 500 concurrent users login 10x, 200 concurrent employee list paging, 50 concurrent clock-in simulation, 1 concurrent payroll run 1000 employee. Baseline response time <200ms p95 login/employee list, <10s untuk payroll run 1000 employee. Target RPS >100 | 13 | 16h | ☐ | Grafana k6 summary report disimpan di `.k6/reports/`. Tidak ada HTTP 5xx error. DB CPU max 80%. Redis hit rate cache >95%. Target SLA p95 < 500ms for all CRUD APIs | QA-006 |

---

## Fase 5: Week 14 - Polish + Production Readiness (1 Minggu)

Owner: Tim Semua (DevOps + Backend + Frontend + Tech Lead)

| # | Task | Estimasi | Status | AC | Gap |
|---|------|----------|--------|----|-----|
| 5.1 | **Sentry + APM Integration**: Install `@sentry/node`, `@sentry/tracing` backend capture errors + performance tracing (DB queries, http requests). Frontend `@sentry/react` sourcemap upload saat build. Sample rate 10% traces production, 100% dev | 8h | ☐ | Manual throw error → error muncul di Sentry dashboard dengan stacktrace, user context, breadcrumb. Trace view per request melihat 3 span: HTTP → Prisma Query → Redis | OPS-007 |
| 5.2 | **Dockerfile Security + Multi-stage Build**: (1) Stage 1: build TypeScript `node:20-alpine`. (2) Stage 2: runtime slim image, non-root user `node:20-slim` with USER app. (3) Install security packages hanya runtime. (4) `distroless` image option untuk production. Add Trivy scan step CI | 8h | ☐ | Docker image size < 300MB dari 1.2GB sekarang. Trivy scan → 0 CRITICAL, 0 HIGH vulnerabilities. Container jalan dengan UID 1000 bukan root. `docker exec whoami` = "node" bukan root | OPS-005 |
| 5.3 | **Soft Delete Cleanup Job + Data Retention Policy**: Prisma migration atau BullMQ cron mingguan midnight: (1) Permanently DELETE records with deletedAt > 30 days untuk non-financial data, >7 tahun untuk financial/audit data. (2) Clean audit logs > 1 tahun → archive ke S3. (3) Redis expired keys scan tiap minggu | 6h | ☐ | Manual test: soft delete employee → set deletedAt = 35 hari lalu → run cleanup job → record permanen hilang dari DB. Space usage berkurang | OPS-008 |
| 5.4 | **Frontend UX Polish Batch**: Skeleton per component (ganti spinner global), Optimistic UI update pada simple mutations, React Error Boundary per route, WCAG 2.1 AA audit focus ring, Mobile responsive sidebar collapsible, Empty state consistent dengan CTA, Print stylesheet untuk dokumen | 40h | ☐ | Lighthouse Accessibility score >= 95. iPhone SE viewport semua halaman bisa di-scroll horizontal overflow tidak ada, tombol cukup besar 44px. Print payslip browser → hasil bersih tanpa sidebar | UX-001 s/d UX-008 |
| 5.5 | **Production Checklist Final Walkthrough**: Checklist deploy: secrets di Vault/AWS Secret Manager bukan .env, DNS + CDN + WAF (Cloudflare), SSL certificate auto-renew Let's Encrypt, Backup schedule verified restore, Rate limit, WAF rules SQLi/XSS, Auto scaling group min 2 API + 2 worker, Health check + liveness/readiness probe Kubernetes, Runbook SOP production for on-call engineer | 16h | ☐ | Dokumen `runbook-production.md` lengkap. Simulasi incident: DB down selama 5 menit → auto reconnect, health check 503, alert Slack on-call. Manual failover DB primary → replica, aplikasi tetap berjalan setelah 30s reconn | SEMUA |
| 5.6 | **Go-Live Blue-Green atau Canary Release Strategy**: Deployment blue 100% traffic, green 0% → scale up green → smoke test → canary 5% traffic → 25% → 50% → 100%. Rollback trigger otomatis jika error rate >5% selama 2 menit | 12h | ☐ | Release v1.0 via blue-green → downtime 0 detik. Rollback ke blue jika green error → <30 detik traffic back ke blue, user tidak notice | - |

---

## Ringkasan Timeline per Minggu

| Minggu | Fase | Fokus | # Tasks |
|--------|------|-------|---------|
| 0 | Pre-Flight | Env + Security CRITICAL (10 tasks) | 10 |
| 1 | Hardening 1 | MFA, File Upload, Signed URL, NIK/Phone Validation | 8 |
| 2 | Hardening 2 | AuditLog diff, Argon migration, CSP nonce, Enum schema | 6 |
| 3 | Hardening 3 | Bank Validator, DB unique constraints, Leave race condition | 5 |
| 4 | Perf 1 | Service caching, N+1 query fix, Prisma pool tuning, read replica | 5 |
| 5 | Perf 2 | Payroll async queue phase 1 + chunking | 2 |
| 6 | Perf 3 | Payroll queue finish + Attendance pre-aggregation + CSV import transactional | 3 |
| 7 | Payroll Engine | PPh21 + BPJS calculation engine | 2 |
| 8 | Workflow 1 | Generic workflow integration, email template system, company scope audit + Prisma middleware | 5 |
| 9 | Workflow 2 | Exit clearance workflow, Loan amortization engine | 2 |
| 10 | Feature close | Performance dispute SLA, Company switcher UI, Report export endpoints | 3 |
| 11 | Test 1 | Backend unit tests phase 1, Frontend bundle lazy loading, image compression | 4 |
| 12 | Test 2 | Backend unit tests phase 2, Frontend unit tests, table virtualization | 3 |
| 13 | Test 3 | Playwright E2E 10 flows, k6 load test baseline, Lighthouse | 3 |
| 14 | Production | Sentry APM, Docker security, Cleanup job, UX polish, Go-live strategy | 6 |
| **TOTAL** | **14 Minggu** | | **~70 tasks** |

---

## Definition of Done (DoD) per Checklist Item

1. [ ] Kode di-branch feature/, PR dibuat, Code Review minimal 1 reviewer (diluar author)
2. [ ] Unit test ditambahkan untuk logic baru / yang berubah
3. [ ] Integration test jika flow lintas modul
4. [ ] ESLint + Prettier pass, TypeScript `tsc --noEmit` tidak ada error
5. [ ] Database migration ditambahkan jika ada schema change, idempotent
6. [ ] Seed data di-update jika ada new enum / new master data (e.g. religion enum)
7. [ ] Test di staging environment: QA manual UAT pass
8. [ ] Performance regression check: p95 API tidak naik >30% dari baseline
9. [ ] Security check: tidak ada secret hardcoded, Trivy/SonarQube scan no new critical
10. [ ] Dokumentasi update di `.docs/` terkait fitur/flow baru jika ada
