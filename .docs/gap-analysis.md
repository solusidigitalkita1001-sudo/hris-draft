# Gap Analysis HRIS Enterprise

Klasifikasi: **CRITICAL | HIGH | MEDIUM | LOW**
Status: **OPEN | IN PROGRESS | CLOSED**

---

## 1. Keamanan (Security) - 19 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| SEC-001 | **CRITICAL** | Fallback JWT secrets di source code | `config/index.ts` line 142-143: `fallback-secret-not-secure` jika env tidak di-set → production bisa pakai hardcoded weak secret | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L142-L146) | Token signing compromise, full account takeover |
| SEC-002 | **CRITICAL** | Fallback session/CSRF/encryption keys | Line 186, 189, 192: hardcoded fallback keys `fallback-session-secret`, `fallback-csrf-secret`, `fallback-encryption-key-32chars!!` | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L186-L193) | Session hijacking, CSRF bypass, data decryption |
| SEC-003 | **CRITICAL** | CSRF middleware tidak di-apply | `csrf.secret` ada di config tapi di `app.ts` tidak ada `csurf` atau CSRF middleware terpasang. `X-CSRF-Token` ada di CORS allowedHeaders tapi tidak dicek | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L71-L81) | CSRF attack pada semua state-changing endpoints |
| SEC-004 | **CRITICAL** | Sensitive data PII tersimpan plaintext | `Employee` model: NIK KTP (`idNumber`), taxId (`NPWP`), `bpjsKetenagakerjaan`, `bpjsKesehatan`, bank account detail, address, phone — semuanya VARCHAR plaintext tanpa enkripsi at rest | [schema.prisma](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1878-L1900) | GDPR/PDP Law violation, data breach exposes 16 digit NIK, NPWP, rekening |
| SEC-005 | **CRITICAL** | Payroll salary data plaintext | `base_salary`, `amount` (payslip), `total_net_pay`, `employee_salaries` semua DECIMAL plaintext | [schema.prisma](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L323-L344) | Data gaji dan komponen gaji sensitive bocor |
| SEC-006 | **HIGH** | MFA schema ada tapi flow tidak diimplementasi | `User.twoFactorEnabled` dan `twoFactorSecret` field ada, tapi `AuthService` tidak ada logic untuk generate TOTP secret, verify TOTP, enable/disable MFA, enrollment flow | [schema.prisma](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1840-L1841) | Account takeover risk jika password bocor |
| SEC-007 | **HIGH** | Forgot password flow tidak ada (stub) | `auth.routes.ts` terdaftar tapi route POST `/auth/forgot-password`, `/auth/reset-password` — belum/tidak ada logic validasi token reset, expiry, link email | `modules/auth/` | User tidak bisa reset password mandiri |
| SEC-008 | **HIGH** | Token refresh tidak ada blacklist/revocation logic | `RefreshToken` model ada tapi tidak ada check apakah token ada di DB (whitelist) atau tidak saat refresh. Logout tidak menghapus refresh token dari DB | `modules/auth/auth.service.ts` | Stolen refresh token terus valid sampai 7 hari expiry |
| SEC-009 | **HIGH** | File upload: tidak ada antivirus scan, tidak ada MIME sniff, size limit lemah | `Multer` menerima allowedMimes jpeg/png/gif/pdf, tapi tidak ada: (1) ClamAV/online AV scan, (2) magic byte verification vs Content-Type, (3) extension spoofing protection. `maxFileSize` hanya 5MB → terlalu besar untuk avatar, terlalu kecil untuk dokumen | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L171-L180) | Remote code execution via polyglot file, XSS via SVG, malware upload |
| SEC-010 | **HIGH** | Uploads di `/uploads` static path tanpa signed URL / access control | Siapapun yang tahu URL file bisa akses. Dokumen gaji, slip gaji, kontrak karyawan — semua public static. Tidak ada middleware untuk check ownership/permission sebelum serve file | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L104) | Unauthorized access ke payslip.pdf, kontrak.pdf, dokumen confidential via IDOR / guessing URL |
| SEC-011 | **HIGH** | SQL injection risk via raw query (perlu audit) | Prisma parameterized query aman, tapi beberapa modul menggunakan `$queryRaw` atau dynamic where clauses tanpa prisma.raw tag → perlu audit | Semua `*.repository.ts` | DB compromise |
| SEC-012 | **HIGH** | Rate limiter global hanya 100 req/15m untuk semua kecuali auth | `AUTH_RATE_LIMIT_MAX` = 10, tapi rate limit ini tidak di-apply ke endpoint `/auth/*`. Rate limiter global skip saat `NODE_ENV=development` — config logic benar tapi endpoint auth tidak punya rate limiter khusus | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L83-L97) | Brute force login attack, credential stuffing |
| SEC-013 | **HIGH** | CSP policy tidak strict — `unsafe-inline` styleSrc | `styleSrc: ["'self'", "'unsafe-inline'"]` → XSS vector. Production harus nonce atau hash-based CSP | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L52-L65) | Stored XSS execution |
| SEC-014 | **HIGH** | Password hashing dual: BOTH bcryptjs + argon2 ter-install | `package.json` dependencies: BOTH `argon2 ^0.41.1` dan `bcryptjs ^2.4.3`. Need audit `PasswordHandler` menggunakan yang mana, apakah ada fallback bcrypt untuk user lama? Migrate 100% ke Argon2id | [package.json](file:///Users/f/Documents/sdk-project/hris-draft/backend/package.json#L32-L34) | Password hashing inconsistency, bcrypt weaker than Argon2 |
| SEC-015 | **MEDIUM** | SameSite cookie tidak di-set | Tidak ada `set-cookie` usage terlihat tapi `cookie-parser` terpasang. Default cookie tanpa SameSite=Lax/Strict | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L103) | CSRF via cookie |
| SEC-016 | **MEDIUM** | `uploads/` folder tidak dipisah dari disk server | Local filesystem upload path, tidak ada object storage (S3/GCS). Tidak ada backup policy, lifecycle, versioning | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L179) | Disk penuh, data hilang jika instance mati |
| SEC-017 | **MEDIUM** | Audit log tidak capture before/after snapshot semua mutation | `AuditLog` middleware tidak ada logic serialize before/after payload. Check implementasinya apakah menyimpan delta? | `shared/middleware/AuditLog.ts` | Tidak bisa forensik perubahan data |
| SEC-018 | **MEDIUM** | Encryption key ada tapi tidak dipakai | `config.encryption.key` ada, tapi tidak ada field-level encryption implementation di repository layer | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L191-L193) | Encryption utility tidak terpakai |
| SEC-019 | **LOW** | CORS `connectSrc` hanya `config.app.url` | Jika frontend deploy ke domain berbeda, CSP connectSrc akan block API calls. Production harus eksplisit whitelist | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L59) | Frontend production blocked |

---

## 2. Validasi Data (Validation) - 17 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| VAL-001 | **CRITICAL** | Email field Employee: unique nullable tapi tidak ada validation format ketat | `createEmployeeSchema.email` hanya `z.string().email().optional()` tapi jika diisi tidak ada check domain validity, disposable email filter (mailinator, dll) | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L12) | Data email tidak valid, bounce email notification |
| VAL-002 | **CRITICAL** | Phone number tidak ada format validation | `z.string().optional()` tanpa E.164 format, tanpa country code normalization. Tidak ada nomor HP validasi prefix operator Indonesia | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L13) | SMS/WA notifikasi gagal kirim |
| VAL-003 | **HIGH** | NIK KTP (idNumber) tidak ada validasi format | `idNumber` 16 digit untuk KTP Indonesia — tidak ada check: panjang, checksum, provinsi code | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L14) | NIK invalid masuk ke sistem (e.g. `123456`) |
| VAL-004 | **HIGH** | NPWP (taxId) tidak ada validasi format | Format NPWP 15 digit dengan pola tertentu — tidak ada validation | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L32) | NPWP salah → laporan pajak error |
| VAL-005 | **HIGH** | BPJS Ketenagakerjaan / Kesehatan tidak ada validasi | Nomor JHT/JKK/JKM 11 digit, JKN 13 digit — tidak ada validation format dan check digit | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L33-L34) | Klaim BPJS gagal, nomor palsu |
| VAL-006 | **HIGH** | Bank account number tidak ada validasi | Validasi panjang per bank, checksum (Luhn untuk kartu kredit) — tidak ada | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L30) | Gagal transfer payroll |
| VAL-007 | **HIGH** | Date of Birth vs Join Date tidak ada relasi validation | Tidak ada logic service layer check: `joinDate > dateOfBirth + 15 tahun` (usia minimal kerja) | `employee.service.ts` | Data tidak logis (anak SD bekerja) |
| VAL-008 | **HIGH** | Duplicate NIK / duplicate phone tidak ada DB unique constraint + service check | `@@unique` tidak ada di schema untuk `(companyId, idNumber)`, `(companyId, phone)`. Hanya email unique. Bisa insert employee dengan NIK sama 2x | [schema.prisma](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1976-L1982) | Duplicate data identitas, laporan pajak double |
| VAL-009 | **HIGH** | Payroll: salary component calculation tidak ada runtime validation | `calculationMethod = "FIXED"` atau percentage tapi tidak ada validasi amount vs ratePercent required. Payroll run bisa calculate dengan undefined | `payroll.service.ts` | Perhitungan gaji salah |
| VAL-010 | **HIGH** | Attendance: geofence radius check tidak ada validation | Belum ada logic: koordinat clock-in dalam radius branch (branch.latitude/longitude) | `attendance.service.ts` | Karyawan clock in dari rumah padahal WFO |
| VAL-011 | **HIGH** | Leave: balance deduction tidak atomic | `LeaveService.approve()` perlu transaction: kurangi leaveBalance atomik, cek sisa cukup atau tidak, handle concurrency (2 request approve paralel) | `leave.service.ts` | Leave balance minus, race condition |
| VAL-012 | **MEDIUM** | Performance: bobot komponen total harus 100% tidak ada enforcement | `PerformanceComponent.weight` dijumlah tidak ada validation total = 100 | `performance.service.ts` | Perhitungan skor salah |
| VAL-013 | **MEDIUM** | Recruitment: tanggal interview tidak bisa bentrok dengan interviewer lain | Tidak ada constraint scheduling conflict detection | `recruitment.service.ts` | Interviewer double-booked |
| VAL-014 | **MEDIUM** | `gender` string bebas tanpa enum | Schema Employee `gender String? @db.VarChar(20)` tidak ada enum. DTO `z.string().optional()` tanpa allowed values (L/P/MALE/FEMALE) | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L17) | Nilai tidak konsisten: `P`, `Perempuan`, `Female`, `wanita` |
| VAL-015 | **MEDIUM** | `religion`, `maritalStatus`, `bloodType` tidak ada enum | Semua free text → data kotor | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L18-L20) | Report susah di-filter |
| VAL-016 | **MEDIUM** | Date fields: shiftStartDate `@db.Date` tapi DTO `z.string().datetime()` (ISO datetime). Timezone tidak normalize | [schema.prisma](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/database/prisma/schema.prisma#L1894) → [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L28) mismatch format | Tanggal salah 1 hari karena timezone offset |
| VAL-017 | **LOW** | Zod schema `updateEmployeeSchema.partial()` — partial memungkinkan field required dikosongkan jika diset null. Harus `.deepPartial()` dengan guard | [employee.dto.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/modules/employee/employee.dto.ts#L37) | Update bisa wipe required field |

---

## 3. Fitur (Functionality) - 22 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| FTR-001 | **CRITICAL** | Forgot password + reset password tidak berfungsi | Endpoint ada di route tapi logic service tidak validasi token expiry, tidak kirim email, tidak update password | `auth.*` | Production blocker: user lupa password tidak bisa recovery |
| FTR-002 | **CRITICAL** | Notifikasi email tidak terintegrasi dengan event yang critical | Event `USER_CREATED`, `PAYSLIP_PUBLISHED`, `LEAVE_APPROVED`, `PERFORMANCE_RESULT_READY` — tidak ada handler kirim email | `worker.ts` | User tidak aware status perubahan |
| FTR-003 | **HIGH** | Tidak ada batch job payroll calculate untuk > 5000 employee | Payroll run generate payslip satu per satu secara sync. Untuk > 1000 employee, request akan timeout (504) | `payroll.service.ts` PayrollRun create | Timeout payroll process |
| FTR-004 | **HIGH** | Import CSV employee: handle error row tidak ada, partial rollback tidak ada | `employee.service.ts` import parse CSV — jika row ke-500 error, 499 row sudah ter-insert tanpa transaction | `employee.service.ts` | Data korup sebagian, tidak bisa retry clean |
| FTR-005 | **HIGH** | Tidak ada export data standard | Reports module ada tapi endpoint export PDF/Excel per modul (employee list, attendance monthly, payroll summary) — stub atau tidak ada | `reports.*` | User tidak bisa tarik laporan |
| FTR-006 | **HIGH** | Offboarding / resignation flow: exit clearance checklist tidak ada | `Resignation` model ada, `ExitClearance` ada, tapi service untuk check item per PIC (IT return laptop, HR return ID card, Finance settle loan) tidak ada workflow | `onboarding.*` | Exit process manual, ada aset tidak kembali |
| FTR-007 | **HIGH** | Workflow engine generic: tidak ada integration ke leave/loan/permission request | Workflow engine berdiri sendiri. Modul leave, loan, travel expense, overtime, shift swap approval hardcoded, tidak pakai generic workflow | `workflow-engine`, `leave`, `employee-loan` | Inconsistent approval logic, tidak bisa custom approval per company |
| FTR-008 | **HIGH** | CompanyScope middleware tidak dipasang di semua routes | Middleware ada tapi audit: setiap `GET /employees` tanpa companyId query tanpa enforce companyScope → bisa leak cross-company data jika authorize() check salah | `shared/middleware/CompanyScope.ts` × semua `*.routes.ts` | IDOR cross-tenant data leak |
| FTR-009 | **HIGH** | Performance: Dispute SLA auto-escalation tidak diimplementasi | Phase 5 publish dispute ada. SLA 3 hari auto-escalate ke HR manager jika tidak direspon — worker tidak ada logic ini | `performance.service.ts` | Dispute menggantung tidak dijawab |
| FTR-010 | **HIGH** | Attendance integration dengan fingerprint/face recognition tidak ada | Endpoint clock in/out hanya manual via web/mobile. Tidak ada SDK integration dengan mesin absensi (ZKTeco, dll) | `attendance.*` | Data absensi harus import manual harian |
| FTR-011 | **HIGH** | Tidak ada payroll tax calculation (PPh 21 Pasal 21) Indonesia | Payroll calculation service hanya jumlahkan components + kurangi benefit. Tidak ada: PKP, PTKP, PPh21 calculation formula bulanan, THR calculation, BPJS deduction tiered | `payroll.service.ts` | Payroll tidak legal-compliant, perhitungan pajak manual di Excel |
| FTR-012 | **HIGH** | Tidak ada JHT/JKK/JKM/JPN BPJS Ketenagakerjaan tier + BPJS Kesehatan calculation | Tidak ada auto-calculate iuran employer + employee sesuai persentase peraturan | `benefit.service.ts` | BPJS deduction manual, potongan salah |
| FTR-013 | **MEDIUM** | Employee loan amortization schedule auto-generate tidak ada | `Loan` create → hitung cicilan per bulan, bunga flat/efektif, jatuh tempo — tidak diimplementasi | `employee-loan.module` | Cicilan dihitung manual, payroll tidak auto deduct |
| FTR-014 | **MEDIUM** | Reimbursement limit per category, approval workflow tidak ada | `Reimbursement` model ada tapi endpoints/service CRUD belum terlihat ada di travel-expense module | `travel-expense.*` | User klaim lebih dari limit |
| FTR-015 | **MEDIUM** | Training certificate auto-generate PDF tidak ada | `TrainingEnrollment` complete → generate sertifikat PDF dengan template — tidak ada | `training.service.ts` | Training completion tidak ada bukti tertulis |
| FTR-016 | **MEDIUM** | Organization chart rendering frontend butuh data preprocessing | `OrganizationChartPage.tsx` ada tapi tree flatten tanpa build hierarchy children. Tidak ada expand/collapse per level | `frontend/.../OrganizationChartPage.tsx` | Org chart tidak berguna untuk > 100 employee |
| FTR-017 | **MEDIUM** | Frontend tidak ada company switcher | `auth.store` ada `companyScope[]` list company yang bisa diakses user. Tidak ada UI dropdown switch active companyId yang mempengaruhi semua API call query param | `frontend/stores/company.store.ts` | Multi-company user tidak bisa pindah konteks |
| FTR-018 | **MEDIUM** | i18n provider ada tapi translations dictionary kosong / stub | `i18n/translations.ts` tidak ada konten terjemahan. ID/EN toggle tidak fungsional | `frontend/i18n/translations.ts` | Bilingual tidak berjalan |
| FTR-019 | **MEDIUM** | Audit log viewer frontend tidak ada filter/facets | `AdminAuditLogPage.tsx` list flat, tidak bisa filter: actor, date range, action, resource, IP | `frontend/.../AdminAuditLogPage.tsx` | Forensik susah ketika data > 10k rows |
| FTR-020 | **LOW** | Notification push ke browser (Service Worker / FCM) tidak ada | `Notification` model hanya in-app read di halaman. Tidak ada web push | `notification.module` | User tidak real-time dapet notif |
| FTR-021 | **LOW** | Tidak ada dark mode toggle | Theme preset ada, tapi tidak ada dark mode. Sidebar/TopNavigation hanya light | `frontend/theme/theme-presets.ts` | UX tidak modern |
| FTR-022 | **LOW** | Import CSV validation report tidak ada UI feedback | Parse CSV → yang valid berapa, invalid row keberapa errornya apa — response tidak terstruktur, frontend tidak menampilkan report | `employee.service.ts` import | User bingung kenapa import gagal sebagian |

---

## 4. Performa (Performance) - 11 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| PERF-001 | **CRITICAL** | Tidak ada database indexing strategy yang komprehensif | Setiap tabel punya `@@index([companyId])` tapi query umum: `(companyId, departmentId, status, employmentStatus)` tidak ada composite index. Attendance query `(employeeId, date)` tanpa composite unique | Semua migration SQL | Full table scan. Query 10k+ employee timeout > 5s |
| PERF-002 | **CRITICAL** | Employee list query: Eager loading N+1 tidak dibungkus include/select | `employeeRepository.findAll` — cek apakah menggunakan Prisma `include` yang dalam vs findMany + loop findUnique (N+1). Performance planning assignments dengan include depth 4+ → Cartesian product | Semua `*.repository.ts` | Response lambat, DB CPU 100% |
| PERF-003 | **HIGH** | Tidak ada caching strategy di service layer | `RedisCache` abstraction ada tapi hampir tidak dipakai di modul (hanya rate limit + BullMQ). Data static lookup (role, permission, leave type, salary component, work calendar) TIDAK ada cache TTL 1-5m | Semua `*.service.ts` | DB read overload untuk data jarang berubah |
| PERF-004 | **HIGH** | Performance Result publish > 2000 employee single transaction | Publish semua hasil performance sekaligus di 1 transaksi → lock table lama, deadlock risk | `performance.service.ts` publish | DB deadlock, request timeout |
| PERF-005 | **HIGH** | Payroll run generate payslip synchronous tanpa chunking | Jika total employee 5000, loop generate 5000 payslip 1 request → 504 Gateway Timeout sebelum selesai. Belum pakai BullMQ queue | `payroll.service.ts` PayrollRun | Payroll tidak pernah selesai untuk enterprise |
| PERF-006 | **HIGH** | Attendance monthly report aggregate query tanpa pre-aggregation | Report summary per employee per bulan: hitung hari hadir, izin, sakit, alpa dari raw attendance rows → scan ribuan row per employee per bulan | `reports.service.ts` | Report >10s load |
| PERF-007 | **MEDIUM** | Frontend: React Query staleTime 5m gcTime 30m default. Daftar employee infinite scroll atau pagination tidak ada virtualization | `TanStack Table` tanpa virtual row → render DOM 500+ row employee sekaligus | `frontend/modules/employee/pages/EmployeeListPage.tsx` | UI freeze, lag scrolling |
| PERF-008 | **MEDIUM** | Frontend bundle size tidak di-optimize | `package.json` include `jspdf`, `xlsx`, `recharts`, `framer-motion` — semua eager load. Tidak ada route-based code splitting per module di React Router. Tidak ada lazy() wrap page components | `frontend/App.tsx`, routes | First load > 2MB, LCP >4s |
| PERF-009 | **MEDIUM** | Tidak ada image optimization | Employee avatar upload asli 5MB di-serve tanpa resize/thumbnail. Tidak ada sharp/image processor | Upload path + frontend image tag | Page load Detail 10 tab dengan foto family = 50MB+ download |
| PERF-010 | **LOW** | Logger Winston level debug di production default | `LOG_LEVEL=debug` → terlalu verbose, disk cepat penuh. Production harus `warn` atau `error` | [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts#L182) | Disk I/O tinggi, log biaya mahal |
| PERF-011 | **LOW** | Worker BullMQ `removeOnComplete: 1000` — menyimpan 1000 completed jobs. Jika peak traffic ribu jobs/hr → memory leak di Redis. Harus 50 atau lebih kecil | [QueueManager.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/infrastructure/queue/QueueManager.ts#L75-L76) | Redis memory penuh |

---

## 5. Test Coverage & QA - 8 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| QA-001 | **CRITICAL** | **ZERO automated test coverage.** Tidak ada satupun `*.test.ts` / `*.spec.ts` file di backend maupun frontend | `Glob **/*.test.{ts,tsx}` → 0 results | Regresi tak terdeteksi. Production deployment = gamble |
| QA-002 | **CRITICAL** | E2E test tidak ada. Playwright dependency ter-install tapi tidak ada test file | `frontend/package.json` `test:e2e: playwright test` — tidak ada file | Happy path tidak tervalidasi |
| QA-003 | **HIGH** | Jest config ada tapi tidak ada test files. `--passWithNoTests` supaya `npm test` tetap pass — coverage tool tidak terpakai | `backend/jest.config.ts`, `--passWithNoTests` di package.json script | False positive CI pass |
| QA-004 | **HIGH** | Tidak ada contract test antara frontend axios service dan backend route. Zod schema DTO backend tidak di-share ke frontend | `frontend/services/*.service.ts` hardcoded response type vs backend DTO | Frontend/backend schema drift → runtime error |
| QA-005 | **MEDIUM** | Vitest frontend ada tapi tidak ada unit test untuk: access-control.ts, auth.store.ts, zod form resolvers | `frontend/package.json` test script | Utility logic tidak tervalidasi |
| QA-006 | **MEDIUM** | Tidak ada load test script (k6/Artillery) untuk endpoint critical: login, employee list, payroll run, attendance clock-in | - | Tidak tahu sampai berapa concurrent user sistem bisa handle |
| QA-007 | **MEDIUM** | Tidak ada database seeding untuk load test dataset 10k employee. Test data hanya small sample | `seeds/05-test-data.seed.ts` | Performance issue baru ketemu production |
| QA-008 | **LOW** | Tidak ada visual regression test untuk UI components (Chromatic/Playwright screenshot) | - | Perubahan CSS secara tidak sengaja merusak layout |

---

## 6. Data Integrity & Ops (DevOps/DBA) - 10 Items

| ID | Severity | Gap | Deskripsi | Lokasi | Dampak |
|----|----------|-----|-----------|--------|--------|
| OPS-001 | **CRITICAL** | Tidak ada DB backup strategy di pipeline. Prisma migrate deploy tidak ada rollback plan | `.github/workflows/deploy.yml` | DB corrupt tidak bisa restore. Migration gagal tidak bisa rollback |
| OPS-002 | **CRITICAL** | Tidak ada environment variable validation saat startup. Jika DATABASE_URL kosong, app crash runtime tapi ada graceful check di worker, tidak di main index.ts | `config/index.ts` hanya getEnv fallback tapi tidak ada Zod schema validate | App start with wrong config → silent bug |
| OPS-003 | **HIGH** | Prisma connection pool tidak dikonfigurasi optimal. Default `connection_limit` kecil untuk production. Tidak ada `pool_timeout`, `statement_timeout` | `schema.prisma` datasource db | DB connection exhausted saat peak |
| OPS-004 | **HIGH** | Tidak ada database read replica routing. Semua query (read + write) ke primary DB | prisma.ts | Primary overload saat peak payroll |
| OPS-005 | **HIGH** | Dockerfile backend tidak include non-root user, tidak ada security scanning, layer cache tidak optimal | `backend/Dockerfile` | Container vulnerable, build lambat |
| OPS-006 | **HIGH** | Rate limiter in-memory single instance. Jika deploy > 1 pod, limit tidak shared. Harus Redis-backed rate limiter (express-rate-limit Redis store) | [app.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/app.ts#L83-L97) | Horizontal scale → rate limit tidak efektif |
| OPS-007 | **MEDIUM** | Tidak ada APM (Application Performance Monitoring) integration: New Relic, Datadog, Sentry error tracking | - | Production issue tidak bisa di-trace root cause |
| OPS-008 | **MEDIUM** | No database soft-delete cleanup job. `deletedAt` rows selamanya stay → DB grow, query slow, unique constraint leak (soft deleted code masih count sebagai exist?) | Semua repository softDelete | Unique code tidak bisa dipakai ulang meskipun sudah dihapus |
| OPS-009 | **MEDIUM** | Redis key TTL strategy tidak jelas. Tidak ada job untuk clear stale cache ketika data di update via mutation. Event bus publish TAPI tidak ada subscriber invalidasi cache | Semua service update | Cache stale, user lihat data lama |
| OPS-010 | **LOW** | GitHub Actions deploy workflow ada tapi tidak ada step: lint, typecheck, test, build before deploy | `.github/workflows/deploy.yml` | Bad code bisa ke production |

---

## 7. Frontend UX Quality - 8 Items

| ID | Severity | Gap | Deskripsi | Lokasi |
|----|----------|-----|-----------|--------|
| UX-001 | **HIGH** | Tidak ada loading skeleton state. Semua page baru Loading spinner senter saat data fetch. TanStack Query isLoading → Spinner global bukan per komponen | Semua page modules | UX terasa lambat, layout shift |
| UX-002 | **HIGH** | Optimistic UI update tidak ada. Submit form → disable button → await response success. Bisa update local state dulu, rollback jika error | Form pages | Submit terasa lambat |
| UX-003 | **HIGH** | Error boundary tidak ada di React tree. Satu komponen crash → blank page seluruh app | `App.tsx` | Isolasi error buruk |
| UX-004 | **MEDIUM** | Accessibility (a11y): Radix UI accessible tapi wrapper custom (input.tsx, button.tsx) cek: focus ring, aria-label, keyboard nav, form error announcer | `components/ui/*` | Tidak WCAG 2.1 AA compliant |
| UX-005 | **MEDIUM** | Form validation feedback: Zod error field message bahasa campuran ID/EN. Tidak ada error summary di atas form | Semua form pages | User bingung field mana yang salah |
| UX-006 | **MEDIUM** | Mobile responsive breakpoint: Sidebar collapse hamburger tidak ada. Table TanStack overflow-x belum tentu scroll friendly di mobile | `layouts/DashboardLayout.tsx` | HP tidak bisa pakai dashboard |
| UX-007 | **LOW** | Empty state placeholder tidak konsisten. List kosong hanya blank tanpa icon + CTA "Add Employee" | Semua list pages | Confusing untuk first-time user |
| UX-008 | **LOW** | Print stylesheet untuk dokumen (payslip PDF view, performance report, slip gaji, sertifikat training) tidak ada CSS `@media print` | `frontend/src/index.css` | Print browser rusak, banyak elemen UI tercetak |

---

## Ringkasan Jumlah Gap per Kategori Severity

| Kategori | CRITICAL | HIGH | MEDIUM | LOW | TOTAL |
|----------|----------|------|--------|-----|-------|
| Keamanan (SEC) | 4 | 10 | 4 | 1 | 19 |
| Validasi (VAL) | 2 | 8 | 5 | 2 | 17 |
| Fitur (FTR) | 2 | 11 | 7 | 2 | 22 |
| Performa (PERF) | 2 | 4 | 3 | 2 | 11 |
| QA & Test (QA) | 2 | 3 | 3 | 0 | 8 |
| Data & Ops (OPS) | 2 | 4 | 3 | 1 | 10 |
| UX Frontend (UX) | 0 | 3 | 3 | 2 | 8 |
| **TOTAL** | **14** | **43** | **28** | **10** | **95** |

---

## Prioritas Penyelesaian Berdasarkan Dampak

1. **Batch 0 - Go-Live Blocker (14 CRITICAL)**: Wajib selesai SEBELUM production. Terkait keamanan data PII, password flow, DB performance, dan test coverage.
2. **Batch 1 - Hardening (43 HIGH)**: 4 minggu pertama setelah go-live atau sebelum go-live jika sempat. Dampak besar ke user experience, integritas data, dan operasional payroll.
3. **Batch 2 - Improvement (28 MEDIUM)**: 8-12 minggu. Peningkatan kualitas, reporting, advanced features.
4. **Batch 3 - Polish (10 LOW)**: Backlog. Dikerjakan jika ada waktu luang / sprint filler.
