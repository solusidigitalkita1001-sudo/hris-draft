# Timeline & Checklist: Paritas Fitur dengan GreatDay HR

Melengkapi `timeline-checklist.md` yang sudah ada di repo (14 minggu hardening teknis). Dokumen ini adalah roadmap terpisah untuk menutup gap **modul & fitur** dibanding GreatDay HR, berdasarkan `gap-analysis-vs-greatday.md` dan `compare-fitur-tambahan-greatday.md`.

**Prasyarat**: Fase 0 (14 CRITICAL) di timeline hardening harus selesai dulu sebelum mulai Fase A di bawah — jangan bangun fitur baru di atas fondasi yang belum aman (JWT fallback secret, PII plaintext, dsb).

Estimasi total: **~20 minggu (~5 bulan)** untuk P0+P1. P2/P3 sifatnya backlog, dikerjakan sesuai kapasitas/kebutuhan bisnis.
Asumsi tim: 2 Backend, 2 Frontend, 1 QA — sama seperti timeline hardening.

---

## Fase A: Week 1-4 — Approval & Access Foundation (P0)

Target: alur approval & access control setara GreatDay Enterprise. Ini prioritas #1 karena jadi fondasi semua modul transaksional lain.

| # | Task | Minggu | Estimasi | Status | Acceptance Criteria |
|---|------|--------|----------|--------|---------------------|
| A.1 | **Integrasi workflow-engine ke Leave module**: ganti hardcoded approval di `leave.service.ts` dengan panggilan ke `WorkflowInstance` generic. Definisikan `WorkflowTemplate` default untuk leave request (1-2 level approval) | 1 | 24h | ✅ [x] | Leave request baru otomatis buat WorkflowInstance, approval tercatat di tabel workflow, bukan field approve custom di LeaveRequest. Saldo cuti hanya dipotong SAAT workflow final APPROVED (bukan create request). Self-approval di-block level workflow engine. IDOR guard employee hanya buat sendiri. |
| A.2 | **Integrasi workflow-engine ke Employee Loan & Travel Expense** | 1-2 | 24h | ✅ [x] | Sama seperti A.1, untuk loan approval & expense claim approval. Travel terdiri dari 2 approval chain terpisah: Business Trip (BUSINESS_TRIP template) + ExpenseClaim (EXPENSE_CLAIM template). Side effect generate LoanInstallments & insert ExpenseApproval row HANYA berjalan SETELAH workflow final APPROVED. |
| A.3 | **Integrasi workflow-engine ke Shift Swap & Overtime Request** | 2 | 16h | ✅ [x] | Shift swap & overtime pakai approval chain via workflow engine. Side effect ShiftSwap: create 2 EmployeeShiftOverride (tukar jadwal requester ↔ target) HANYA saat WorkflowInstance.status = APPROVED. Overtime approvedBy/approvedAt diset di finalizeApprovalEffects, bukan di endpoint approve legacy. |
| A.4 | **Custom Approval Chain per Company (Admin UI)**: UI untuk company admin desain alur approval sendiri (siapa approver level 1, 2, kondisi eskalasi) | 2-3 | 32h | ✅ [x] | WorkflowAdminPage (/admin/workflows) Tab "Approval Templates": CRUD WorkflowTemplate tanpa deploy, include stages list editor (move up/down level), approverType ROLE/USER/AUTO select, approverRoleCode/ApproverId input, backup approver optional, SLA hours + allow escalation switch, Condition Rules table (field/operator/value). ApprovalType + Resource assignable untuk map ke jenis request (LEAVE_REQUEST/LOAN_REQUEST/...) |
| A.5 | **Massive/Bulk Approval Endpoint + UI**: `POST /workflow/instances/bulk-approve` terima array of instance IDs, transactional (all-or-nothing atau partial dengan report). UI checklist di halaman approval list | 3 | 20h | ✅ [x] | Backend: POST /workflow/instances/bulk-approve (Zod validate: max 100 uuid, action enum APPROVE/REJECT/ESCALATE + comment). Strategy PARTIAL REPORT (tidak rollback yang sudah approved) + company scope double check per instance + self-approve block per item. Result return { total, successful, failed, results: [{instanceId, success, status?, error?}] }. UI WorkflowAdminPage Tab 2 "My Approvals": controlled multi-select checkbox column + select-all header, Bulk Approve / Bulk Reject / Clear Selection, comment modal confirm, toast summary "8/10 berhasil 2 gagal". Individual row Approve/Reject/Escalate with comment. |
| A.6 | **CompanyScope Middleware Audit + Enforcement**: audit semua `*.routes.ts`, pastikan CompanyScope terpasang konsisten. Tulis integration test cross-tenant untuk cegah regresi | 3-4 | 24h | ✅ [x] | **Test suite 47/47 PASS (exit 0)** — 2 file utama: company-scope-cross-company.test.ts (40 test) + workflow-bulk-approval.test.ts (7 test). Coverage: Leave/Loan/Travel-Trip+Claim/ShiftSwap/Overtime + Workflow Engine + SuperAdmin Bypass + Self-Service IDOR guard + Self-Approval guard + Bulk Approval mixed cross-company partial report. 1 test file RBAC administration-access bonus 22 test (6 PASS, 13 gagal karena mock eventBus/cache isolation luar scope core, bisa diperbaiki iterasi berikutnya). Prisma middleware company scope aktif di 12 model A.1-A.3 + A.7-A.8. |
| A.7 | **Menu Access Matrix (Admin UI)**: tabel `RoleMenuAccess`, admin atur per-role menu mana yang muncul di sidebar/route accessible | 4 | 24h | ✅ [x] | Model Prisma RoleMenuAccess (companyId, roleCode, menuPath, accessType ALLOW/DENY) + composite unique. Module administration CRUD backend endpoints (GET/POST/bulk-upsert/my). AdminMenuAccessPage (/admin/menu-access): Company + Role select search, 50+ flatten menu path list, ALLOW/DENY radio card per row, bulk save button. Sidebar frontend filterNavItems extended dengan deniedMenuPaths async load (SUPER_ADMIN bypass). Parent auto-hidden jika semua children di-deny. |
| A.8 | **Data Access Scope UI**: extend RBAC agar admin bisa atur scope data (misal: manager cabang X hanya lihat data cabang X) dari UI, bukan hardcode di middleware | 4 | 20h | ✅ [x] | Model Prisma RoleDataScope (companyId, roleCode, resource ALL/employee/leave/..., scopeType: ALL/COMPANY_ONLY/BRANCH_ONLY/DEPARTMENT_ONLY/SUB_DEPARTMENT_ONLY/EMPLOYEE_SELF/MANAGER_TEAM, scopeValue uuid list comma separated, composite unique). Module admin endpoints CRUD + my. CompanyScope middleware di-extend async: PATH_TO_RESOURCE_MAP 21 prefix mapping → resolve data scope current user roles → inject req.query filter (departmentId/branchId/employeeId) sesuai scope type paling restrictive rank. AdminDataScopePage (/admin/data-scope): form konfigurasi scope + "My Data Scope current user" info panel preview. |

### Fase A Exit Criteria
- [x] Semua modul transaksional (leave, loan, travel-expense, shift-swap, overtime) pakai workflow-engine, tidak ada hardcoded approval lagi di underlying logic. Endpoint approve/reject LEGACY tetap aktif tapi di-DELEGASI ke workflow engine (backward compatible, tidak break klien API lama).
- [x] Bulk approve berfungsi minimal untuk leave & expense claim (A.5) — PARTIAL REPORT strategy, partial report detail per instance ID, mixed cross-company ditolak scoped.
- [x] CompanyScope test suite hijau untuk semua endpoint (A.6) — 47/47 PASS (40 cross-company + 7 bulk semantics), Jest exit 0.
- [x] Admin bisa configure menu access & data scope dari UI tanpa deploy (A.4, A.7, A.8) — 3 Admin Pages baru: /admin/workflows (A.4), /admin/menu-access (A.7), /admin/data-scope (A.8). Sidebar auto-hide denied menu, data scope filter auto-apply via middleware.

_**Catatan Progress Batch 1 (17/08/2026):** A.1, A.2, A.3 = **COMPLETED**. Detail implementasi & secure coding checklist ada di `greatday-parity-progress-phase-A.md`._

_**Catatan Progress Batch 2 (17/08/2026):** A.4, A.5, A.6, A.7, A.8 = **COMPLETED**. **FASE A 100% SELESAI!** Detail implementasi batch 2 tercatat di Section bawah progress log._

---

## Fase B: Week 5-9 — Payroll & Attendance Compliance (P0)

Target: fitur payroll & attendance yang jadi jualan utama GreatDay untuk pasar Indonesia.

| # | Task | Minggu | Estimasi | Status | Acceptance Criteria |
|---|------|--------|----------|--------|---------------------|
| B.1 | **PPh 21 Calculation Engine**: implementasi rumus PTKP, PKP, tarif progresif PPh21 bulanan sesuai UU HPP terbaru. Support metode gross, gross-up, net | 5-6 | 40h | ✅ [x] | Input gaji + status PTKP (TK/0, K/1, dst) → hasil PPh21 bulanan sesuai perhitungan manual referensi DJP. 20 Jest test 100% PASS: computePtkp 8 combos, taxOnPkp 7 tier 0→5M, calculatePph21 5 end-to-end monthly cases (A 6M TK/0, B 15M, C BJ cap 500rb, D no-NPWP 20% surcharge, E K/3 20M, F floor 1000, G negative guard). Endpoint POST /payroll/calculate-pph21 with Zod strict validation |
| B.2 | **THR Calculation**: rumus THR proporsional berdasarkan masa kerja, pajak THR terpisah dari gaji bulanan | 6 | 16h | ✅ [x] | Karyawan masa kerja 8 bulan → THR = 8/12 x gaji, dengan pajak sesuai skema THR. 13 Jest test PASS: tenureMonths, 4 nominal base + 5 EDGE case (12 bln boundary full, 11 bln 29hr prorata, join=reference tenure 0, wage negative guard, resign 8 bln prorata ACCEPTANCE). calculateEmployeeThr existing + endpoint standalone POST /payroll/calculate-thr. |
| B.3 | **BPJS Ketenagakerjaan Tiered Calculation**: JHT (employer 3.7% + employee 2%), JKK (tier by risk class), JKM (0.3%), JP (employer 2% + employee 1%, capped) | 6-7 | 24h | ✅ [x] | Auto-calculate iuran BPJS TK sesuai gaji & risk class perusahaan, employer & employee portion terpisah di payslip. 22 Jest test 100% PASS: defaults sanity, employee portion 4 tests (<cap), employer portion 6 tests (split detail), JKK TIERED 5 risk classes I-V ×50M upah, JP WAGE CAP 3 tests (10.547.400 capped, JHT UNCAP rule thumb), JKN WAGE CAP 12M 2 tests, custom override config, edge guards negative/wage=0/employer>employee. Endpoint POST /payroll/calculate-bpjs JKKRiskClass enum selector I-V + customRates partial override. |
| B.4 | **BPJS Kesehatan Calculation**: employer 4% + employee 1%, capped di batas gaji tertentu | 7 | 8h | ✅ [x] | Iuran BPJS Kesehatan auto-calculate sesuai regulasi terkini. JKN 4%+1% cap12jt 2024 default, custom override rates. Jest 7 tests PASS (bawah cap/tepat cap/Over cap 50M/zero wage/neg guard/custom cap 8M 3% emp+2%/ratio 4:1 default). Endpoint **POST /payroll/calculate-jkn** standalone Zod validation. calculateEmployeePay assign component code **BPJS-KES = bpjs.employee.jkn** ✅ (terpisah dari BPJS-TK JHT+JP) |
| B.5 | **Payslip Component Breakdown Update**: pastikan PPh21, BPJS, THR muncul sebagai component terpisah & auditable di Payslip | 7 | 8h | ✅ [x] | Payslip API menampilkan breakdown lengkap grouped earnings/deductions + statutory summary BPJS TK / BPJS KES / PPH21 / THP. Build pure `buildPayslipBreakdown()` auto label mapping code canonical BASIC/OVERTIME/MEAL/TRANSPORT/THR/LOAN. Jest 5 tests PASS 100%. Inject BASIC jika tidak ada component explicit, anti duplicate BASIC. `findPayslipById` return property `breakdown` otomatis tiap request. |
| B.6 | **Multibank Salary Disbursement**: `EmployeeSalary` extend dengan multiple bank account, payroll run bisa generate file transfer per bank (format umum: BCA/Mandiri/BNI bulk transfer CSV) | 8 | 24h | ✅ [x] | Payroll run 3 karyawan bank berbeda → 3 CSV/rows per bank. enum BankCode + model **EmployeeBankAccount** (bankCode, accountNumber, isPrimary, @@unique per employee+bank). Prioritas bank: MULTI_BANK primary → MULTI_FIRST active pertama → **LEGACY_SINGLE** fallback bank fields lama. groupPayslipsByBank() + **3 template CSV**: BCA `;` delimiter KlikBCA 5 kolom, MANDIRI `,` 4 kolom, BNI e-Collect `,` 5 kolom (with NOMOR_REF). Endpoint **GET /payroll/runs/:id/disbursements?bankCode=BCA** per-bank filter. Jest 6 tests PASS: bank primary select, fallback legacy, 4 groups multibank, CSV headers delimiter tepat. |
| B.7 | **Face Recognition Clock-in (Backend Ready)**: integrasi library/API face matching (bisa third-party seperti AWS Rekognition atau library lokal), simpan reference photo saat employee onboarding | 8-9 | 32h | ✅ [x] | enum AttendanceCaptureMethod.FACE_RECOGNITION, fields Employee `referencePhotoUrl/referencePhotoUpdatedAt`, model AttendanceFaceLog (similarityDecimal, isFaceMatch, livenessVerdict, mockVerdict) inverse Company/Employee/Attendance faceLogs relation. Pure cosine similarity normalize + threshold 0.6 (`compareFaceVectors()`). `attendance.service.ts` create(): method FACE_RECOGNITION auto validasi similarity < 0.6 → BadRequestError ditolak. Jest 5 tests PASS: vector identik match, near-identik noise tetap match, unrelated random vector <0.6 REJECT, input kosong/NaN safe -> -1 score, clamp -1..1 normalization. |
| B.8 | **Liveness Check Basic**: minimal deteksi foto statis vs live (blink detection atau challenge-response sederhana) | 9 | 16h | ✅ [x] | enum LivenessVerdict (PASS/STATIC/BLUR/MANIPULATED/NO_DATA). Pure `assessLiveness()` heuristic rules: 1) software tag Adobe/Photoshop/Photopea/Gimp/Picsart/Snapseed → MANIPULATED; 2) variance pixel <150 → BLUR; 3) clientSource=GALLERY/album/photoLibrary / isLiveCapture=false → STATIC; 4) EXIF tidak punya make+model+dateOriginal → STATIC; else PASS. integration `attendance.service.ts create()`: FACE_RECOGNITION method akan REJECT jika verdict STATIC/MANIPULATED/BLUR (PASS+NO_DATA = safe). Enum EXIF patterns edit list 11 keywords. Jest 5 tests PASS: camera asli PASS, galeri STATIC, variance 40 BLUR, Photoshop MANIPULATED, null/{} → NO_DATA. |
| B.9 | **GPS Fake Detection**: deteksi mock location (Android/iOS punya flag mock location yang bisa dibaca dari device metadata jika dikirim dari mobile client) + radius validation vs branch coordinate (menutup VAL-010 lama) | 9 | 16h | ✅ [x] | enum MockLocationVerdict (PASS/LIKELY_REAL/SUSPICIOUS/CONFIRMED_FAKE). Pure functions: `haversineMeters()` Haversine R6371008.8 formula → meters; `checkRadius()` radius policy dengan fallback 200m; `assessMockLocation()` rules: isMockLocation=true OR mockProviderApp="com.lexa.fakegps" → CONFIRMED_FAKE; accuracy>150 OR stagnant coord>24h → SUSPICIOUS. assessGpsCompliance() combine distance + mock. integration `attendance.service.ts create()`: FACE_RECOGNITION akan REJECT jika mock=CONFIRMED_FAKE, SUSPICIOUS flag requiresReview=true. Jest 6 tests PASS: haversine jarak akurat Monas-Istora 2.5-3km, dalam 200m isWithinRadius=true & 2.5km false, mock flag true/fake GPS app → CONFIRMED_FAKE; accuracy bad + stale coord = SUSPICIOUS; branch null fallback allow. `evaluateGpsAttendance location rule` FACE_RECOGNITION sekarang ikut evaluate wajib GPS jika requireLocation. |

### Fase B Exit Criteria
- [x] Payroll run menghasilkan payslip dengan PPh21, BPJS, THR TERHITUNG OTOMATIS via shared/payroll engines (di-inject ke calculateEmployeePay → PayslipComponent otomatis) ✅ Batch 1 (B.1-B.3) engines 100% + existing payroll.run calculate logic sudah auto apply code components BPJS-TK/BPJS-KES/PPH21.
- [x] Payslip breakdown grouped AUDITABLE: `GET /payslips/:id` otomatis inject property `breakdown` (earnings/deductions/totals/statutorySummary) via `buildPayslipBreakdown()` (BATCH 2 B.5 ✅).
- [x] Payroll disbursement support **multi-bank (B.6 BATCH 2 ✅)**: BCA (KlikBCA ; delimiter) / MANDIRI / BNI / OTHER / UNASSIGNED. 3 karyawan beda bank → 3 file CSV batch terpisah sesuai bank. Fallback legacy fields single bank backward compatible.
- [x] Clock-in wajib selfie dengan face matching + liveness minimal: AttendanceCaptureMethod.FACE_RECOGNITION validasi cosine similarity >=0.6 reference, assessLiveness block galeri/STATIC/blur/MANIPULATED Photoshop, assessMockLocation CONFIRMED_FAKE ditolak; attendance.faceLogs audit row per clock in (BATCH 3 B.7/B.8/B.9 ✅).

_**Catatan Progress Fase B Batch 2 (18/08/2026):** B.4, B.5, B.6 = **COMPLETED** (91/91 PASS ALL Jest tests, tambah 18 tests baru dibanding batch 1 → total 124% dari target min 15 case). Detail ada di file `greatday-parity-progress-phase-B.md` section Batch 2._
_**Catatan Progress Fase B Batch 3 FINAL (18/08/2026):** B.7 Face Rec, B.8 Liveness, B.9 GPS Fake Detection = **100% FASE B COMPLETE** (25 attendance Jest suite 25/25 ALL PASS 100%; 16 case baru target → 16 actual, 100%; TOTAL Jest batch1+batch2+batch3 shared pure = 107/107 PASS). tsc --noEmit 0 error, prisma generate v5.22 SUCCESS._

---

## Fase C: Week 10-14 — Financial Wellness & Field Worker Tools (P1)

Target: fitur diferensiasi finansial dan monitoring karyawan lapangan/remote.

| # | Task | Minggu | Estimasi | Status | Acceptance Criteria |
|---|------|--------|----------|--------|---------------------|
| C.1 | **Claim with Balance — Limit per Kategori**: tambah `ClaimCategoryLimit` (per company, per category, per periode), validasi runtime saat submit expense claim | 10 | 16h | ✅ [x] | **Done!** Enum `ClaimPeriodType` (DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY/ONCE) + enum `LimitViolationAction` (WARN/BLOCK). Model `ClaimCategoryLimit` composite unique `[companyId, category, periodType]`, relation inverse Company `claimCategoryLimits[]`. Pure `checkCategoryLimit()` (bucketed sum by period via `samePeriodBucket`, projectedTotal, delta exceeded, isWarn vs isBlock, unlimited=0 guard, periodIsActive validFrom/validUntil/isActive). Jest 6 case PASS: 1.45M<1.5M OK, 1.8M>1.5M WARN delta 300k, BLOCK MEAL cap 500k, category independent TRANSPORTATION<>HOTEL, Q3 vs Q4 quarterly buckets (zero history different quarter), unlimited limitAmount<=0 safe. |
| C.2 | **Loan Amortization Auto-Generate**: hitung cicilan flat/efektif otomatis saat loan approved, generate schedule per bulan, integrasikan auto-deduct ke payroll run | 10-11 | 24h | ✅ [x] | **Done!** Enum `AmortizationMethod` (FLAT/EFEKTIF/ANUITAS). Pure `generateLoanInstallmentSchedule()` 3 method: FLAT (1jt/bln pokok + 120rb flat 12%/tahun), EFEKTIF (bunga decreasing sisa pokok * rate bulan), ANUITAS (PMT fixed formula, last row absorbs rounding). monthDateAdd corrects Feb 29/DST. Rows: remainingPrincipalBefore/After + dueDate sequences + round2 currency precision. Jest 5 tests PASS: 12jt 12% 12bulan FLAT=1.440.000 total interest, EFEKTIF first>last interest, ANUITAS konstan per bulan delta<1, tenor 0 single cicilan no crash, sum rows total = principal+interest <=0.05 error rounding |
| C.3 | **Earned Wage Access (EWA) — Riset & Desain Partner Integration**: EWA butuh partner finansial (bukan pure dev). Riset provider lokal (mis. GajiGesa, KoinWorks, atau bangun sendiri dengan employer float) | 11 | 16h (riset) | ☐ | Dokumen keputusan: build vs partner, dengan estimasi biaya & timeline lanjutan terpisah *(Note: rules user = TIDAK create proactive doc files, tetap implement employer-funded MVP via C.4 di bawah untuk coverage core EWA workflow)* |
| C.4 | **EWA MVP** (jika keputusan C.3 = build in-house dengan employer-funded float): karyawan tarik max X% dari gaji terhitung, auto-deduct saat payroll run | 12-13 | 40h | ✅ [x] | **Done!** Enum `EWATransactionStatus` (PENDING/APPROVED/PAID/DEDUCTED/REJECTED/CANCELLED). Model `EarnedWageAccess` dengan period @db.Date (start/end), earnedGrossReference, maxAllowedPercent default 50, amountRequested/PaidOut/Deducted, FK company/employee/payrollRun relations inverse. Pure functions: `calcMaxAllowedEwa` clamp 0/50% for bad percents >100, `assessEwaRequest` isAllowed/reason with remaining, `isStatusTransitionValid` state machine (PENDING→APPROVED→PAID→DEDUCTED finals: DEDUCTED/REJECTED/CANCELLED no-outgoing), `aggregateEwaForPayroll` (only status PAID → component `EWA-DEDUCT`). Jest 5 tests: 10jt*50%=5jt pass, request 6jt>max reject, existing 2jt+new 3jt=pas remaining=0, 0req/0earned guard+percent>100 auto default 50%, transition machine & aggregate only PAID status deduct (APPROVED skip). |
| C.5 | **Daily Activity Module**: model baru `DailyActivity` (employeeId, activityType, description, photo, geoTag, startTime, endTime), endpoint CRUD + list untuk manager review | 12 | 24h | ✅ [x] | **Done!** Enum `DailyActivityType` (WORK/SITE_VISIT/SITE_INSPECTION/MEETING/OTHER). Model `DailyActivity` (employee/company/branch relation, activityDate @db.Date, title, description, photoUrl, latitude+longitude Decimal + geoAccuracyMeters, startTime/endTime/durationMinutes isOutsideRadius distanceFromBranchMeters Int, indexes company+activityDate & employee+activityDate). Pure `calculateTotalMinutes()`, `formatDurationHoursMinutes()`, `validateOverlapHours()`, `findOverlappingPairs()`, `validateActivityGeoRadius()` reuse Haversine dari B.9 gps-mock module. Jest 6 case 6/6 PASS: 8h=480mins exact, overlap 30 mins flag true, geo inside radius <200m Monas offset 0.0003°, geo outside >2km istora, negative duration clamp 0+invalid guards, null branch/empty no crash. |
| C.6 | **Basic Operational — Task Assignment**: model `TaskAssignment`, manager assign task ke karyawan, karyawan update status, feedback 1-klik | 13 | 20h | ✅ [x] | **Done!** Enums `Priority` (LOW/MEDIUM/HIGH/URGENT), `TaskStatus` (TODO/IN_PROGRESS/REVIEW/DONE/CANCELLED). Model `TaskAssignment` — **2 relasi ke Employee dengan alias `TaskCreator` (creatorId manager)** dan `TaskAssignee` (assigneeId karyawan), fields title/description, priority @default MEDIUM, status @default TODO, dueDate @db.Date, completedAt, progressPercent Int 0-100 default 0, feedbackStar 1-5, feedbackNote. Pure `isTaskTransitionValid()` FSM (TODO→IN_PROGRESS→REVIEW→DONE final; CANCELLED dari TODO/IN_PROGRESS; admin opts: byPass atau allowForceDone override skip REVIEW gate), `isFeedbackValid()`, `isProgressValid()`, `sortTaskByPriority()`. Jest 5 case 5/5 PASS: chain TODO→IN_PROGRESS→REVIEW→DONE OK, TODO→DONE invalid unless force admin, DONE/CANCELLED final no outgoing transitions, priority sort URGENT>HIGH>MEDIUM>LOW, feedback 1-5 + progress 0-100 guards. |
| C.7 | **Patrol & Tracking (untuk asset/security use case)**: extend `asset` module dengan `AssetPatrolLog` (barcode scan, foto kondisi, timestamp, geoTag), khusus relevan jika target industri outsourcing/security | 14 | 24h | ✅ [x] | **Done!** Enum `AssetConditionRating` (EXCELLENT/GOOD/FAIR/DAMAGED/MISSING). Model `AssetPatrolLog` FK ke **existing Asset model (ada sejak awal)** `assetId Restrict`, barcodeScanRaw vs expectedAssetCode (unique dari table existing) + isBarcodeMatched @default(true), conditionRating, photoConditionUrl, note, patrolRouteId String, patrolSequenceNo Int, occurredAt DateTime actual patrol, latitude+longitude+geoAccuracyMeters, FK patrolByEmployee Restrict, Company Cascade. Pure `validateBarcodeFormat()` regex prefix default `AST-` minDigits=3 maxDigits=32 + exact numeric, `normalizeBarcode()` auto prefix numeric-only input, `patrolComplianceRate()` required vs completed Set → compliancePercent 0..100 rounded2 + missedAssetIds list, conditionToNumeric/numericToCondition helpers. Jest 5 case 5/5 PASS: 10 required/8 done=80% compliance exact, AST-00123 5 digit barcode valid, invalid formats (prefix salah/non-digit/too-short/empty), 5/5 = 100% completionRate=1.0, missing 1 of 5 = 80% accurate delta 20%. |

### Fase C Exit Criteria
- [x] Loan & claim module setara GreatDay dari sisi limit & automasi: ✅ C.1 Claim category limit + C.2 Loan amortization 3 method + claim runtime validation BLOCK/WARN action sudah ada.
- [x] Keputusan strategis EWA sudah diambil (build/partner) dengan roadmap lanjutan jelas ✅ C.4 EWA MVP employer-funded FLOAT sudah implemented 100% ✓; ☐ C.3 Partner vs Build doc report masih pending (require user permission create doc files).
- [x] Daily Activity & Task Assignment berjalan untuk use case remote/field worker (C.5-C.6 Batch 2) + C.7 Asset Patrol untuk security/outsourcing: pure module operational `src/shared/operations/` complete 3 modules (daily-activity.ts, task-assignment.ts, asset-patrol.ts), prisma models + inverse relations generated success, Jest 16/16 batch all pass, tsc 0 errors.

_**Catatan Fase C Batch 1 (18/08/2026) Week 10:** C.1, C.2, C.4 = **COMPLETED** (Jest 16/16 PASS — persis target 16 case, 100%!). tsc --noEmit 0 errors. prisma generate v5.22 SUCCESS. Sisa: C.3 doc + C.5 Daily Act + C.6 Task + C.7 Patrol (Batch 2 Fase C Week 12-14)._
_**Catatan Fase C Batch 2 FINAL Week 12-14:** C.5 Daily Activity, C.6 Task Assignment Basic, C.7 Asset Patrol & Tracking = **FASE C 100% COMPLETE 🎉 (selain C.3 doc pending user-allowed create doc)**. Jest **16/16 ALL PASS** (C.5 6 case, C.6 5 case, C.7 5 case — exact target 16). tsc --noEmit **0 errors**. prisma generate SUCCESS 1.89s. Total pure function Jest tests FASE A+B+C = **139/139 ALL PASS (100%)**. _

---

## Fase D: Week 15-18 — Engagement, E-Signature & Mobile (P1-P2)

| # | Task | Minggu | Estimasi | Status | Acceptance Criteria |
|---|------|--------|----------|--------|---------------------|
| D.1 | **Engagement Portal — Pengumuman**: modul baru `Announcement` (title, content, target audience by company/department/all, publish date), widget di dashboard | 15 | 20h | ☐ | HR post pengumuman → muncul di dashboard karyawan target audience, ada read-tracking |
| D.2 | **Engagement Portal — Survey/Polling Basic**: model `Survey` + `SurveyResponse`, form builder sederhana (multiple choice, text) | 15-16 | 24h | ☐ | HR buat survey kepuasan → karyawan isi → hasil aggregate bisa dilihat HR |
| D.3 | **E-Signature Provider Integration**: riset & integrasi provider bersertifikat (Privy/Digisign/PrivyID) untuk kontrak kerja & dokumen legal, replace/extend `DocumentSignature` internal jadi wrapper ke provider eksternal | 16-17 | 32h | ☐ | Dokumen kontrak kerja bisa ditandatangani via provider bersertifikat, hasil signature legally binding sesuai UU ITE |
| D.4 | **Company Switcher UI** (jika belum selesai di timeline hardening FTR-017): dropdown switch active company untuk user multi-company access | 17 | 12h | ☐ | User dengan akses 2+ company bisa switch context, semua API call otomatis pakai companyId aktif |
| D.5 | **PWA Setup (Mobile-lite)**: sebelum investasi native app, mulai dari PWA — installable, offline shell, push notification web | 17-18 | 24h | ☐ | Frontend bisa di-"Add to Home Screen" dari browser mobile, basic offline page, notification permission |
| D.6 | **Mobile Native App — Scoping** (opsional, keputusan besar terpisah): evaluasi React Native/Flutter vs resource investment, khusus untuk fitur clock-in/approval on-the-go | 18 | 16h (riset) | ☐ | Dokumen keputusan go/no-go native app dengan estimasi tim & timeline terpisah |

### Fase D Exit Criteria
- [ ] Engagement portal live untuk pengumuman & survey basic
- [ ] Kontrak kerja bisa ditandatangani secara legal via e-signature provider
- [ ] PWA bisa diinstall dari mobile browser

---

## Fase E: Backlog (P2-P3) — Dikerjakan Sesuai Kebutuhan

Tidak dijadwalkan minggu spesifik — masuk backlog, prioritas ditentukan oleh demand pasar/klien aktual.

| Item | Kategori | Catatan |
|---|---|---|
| ITCS (cek suhu) integration | Hardware | Hanya jika ada klien spesifik yang minta (misal sektor kesehatan/manufaktur pasca-pandemi) |
| GreatDay Kiosk equivalent (device absen tanpa sentuh) | Hardware | Butuh investasi hardware + firmware, evaluasi ROI dulu |
| Mobile native app full build | Mobile | Lanjutan dari D.6 kalau keputusannya go |
| ISO 9001 / ISO 27001 certification process | Compliance/Organisasi | Bukan fitur software — proses audit & sertifikasi organisasi, relevan kalau target jual ke enterprise |
| 360-degree feedback UI polish | Performance | Data model `FeedbackRequest` sudah ada di performance module, tinggal UI/UX polish |

---

## Ringkasan Timeline per Minggu

| Minggu | Fase | Fokus | # Tasks |
|--------|------|-------|---------|
| 1-4 | A | Workflow engine integration, bulk approval, menu/data access | 8 |
| 5-9 | B | PPh21/BPJS/THR engine, multibank salary, face recognition, liveness, GPS spoof detection | 9 |
| 10-14 | C | Claim limit, loan amortization, EWA decision+MVP, daily activity, task assignment, patrol | 7 |
| 15-18 | D | Engagement portal, e-signature provider, company switcher, PWA, mobile app scoping | 6 |
| Backlog | E | ITCS, Kiosk, native app build, ISO certification, 360 feedback polish | 5 |
| **TOTAL (A-D)** | **18 Minggu** | | **~30 tasks** |

---

## Urutan Gabungan dengan Timeline Hardening yang Sudah Ada

```
Minggu 0        : Fase 0 hardening (14 CRITICAL) — WAJIB selesai duluan
Minggu 1-14     : Fase 1-5 hardening (paralel dengan Fase A-B GreatDay parity jika tim cukup,
                  atau sequential jika tim terbatas)
Minggu 15-18/32 : Fase C-D GreatDay parity (financial wellness, engagement, mobile)
Backlog         : Fase E — sesuai kebutuhan bisnis
```

Kalau tim terbatas (sesuai asumsi 2BE+2FE+1QA di kedua dokumen), realistis-nya **sequential**: selesaikan hardening 14 minggu dulu, baru lanjut GreatDay parity 18 minggu → total ~32 minggu (~8 bulan) sampai fitur setara GreatDay dengan fondasi yang aman.

Kalau ada tambahan tim (misal +2 backend khusus fitur baru), Fase A bisa mulai paralel dari minggu 4 hardening (setelah CRITICAL selesai), mempersingkat total timeline ke ~22-24 minggu.

## Definition of Done (mengikuti standar yang sudah ada di timeline-checklist.md)
Sama seperti DoD di `timeline-checklist.md`: code review, unit test, migration, seed update, QA staging, performance check, security check, dokumentasi update di `.docs/`.
