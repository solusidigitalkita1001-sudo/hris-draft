# Payroll Correction Run — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay a registered correction amount against an already-paid payslip through a `CORRECTION` payroll run (GAP-14/21b), per the approved spec `docs/superpowers/specs/2026-10-08-payroll-correction-run-design.md`.

**Architecture:** Copy two proven patterns: `PayrollArrears` (status-ful item list claimed by a run) and `calculateThrPayroll` (self-contained non-regular run calculation invoked from `calculatePayroll`). Tax on the correction earning is the marginal increment in the paying period via `calculateThrTax` (TER or ANNUALIZED, the same helper both methods already share).

**Tech Stack:** Express + Zod DTOs, Prisma (MySQL), jest with inline config (see memory note: `npx jest --config '{"preset":"ts-jest","testEnvironment":"node","moduleNameMapper":{"^@/(.*)$":"<rootDir>/src/$1"},"roots":["<rootDir>/src"],"testMatch":["**/*.test.ts"]}' <file>`).

---

### Task 1: Schema — `PayrollCorrection` model + migration + tenant allowlist

**Files:**
- Modify: `backend/src/database/prisma/schema.prisma` (model + enum verbatim from spec §1; add back-relations `corrections PayrollCorrection[]` on Company and Employee, `correctionSources PayrollCorrection[] @relation("CorrectionSource")` on Payslip)
- Create: `backend/src/database/prisma/migrations/20261011090000_payroll_corrections/migration.sql` (idempotent `information_schema` guard style, like `20261006160000_fixed_allowance_flag`)
- Modify: `backend/src/shared/database/prisma.ts` — add `'PayrollCorrection'` to `COMPANY_SCOPED_MODELS` (next to `'PayrollArrears'`)

- [x] Step 1: Add model/enum to schema, run `npx prisma generate`
- [x] Step 2: Write migration SQL (CREATE TABLE guarded on table absence; FKs to companies/employees/payslips; indexes from spec)
- [x] Step 3: Allowlist the model; `tenant-scope-coverage.test.ts` must stay green
- [x] Step 4: Commit `feat(payroll): PayrollCorrection model, migration, tenant scoping`

### Task 2: Permission `payroll:correct`

**Files:**
- Modify: `backend/src/database/seeds/modules/01-permissions.seed.ts` — `{ resource: 'payroll', action: 'correct', name: 'Register Payroll Correction', module: 'payroll', code: 'payroll:correct' }`
- Modify: `backend/src/database/seeds/modules/03-role-permissions.seed.ts` — grant to the same roles that hold `payroll:process` (check `money-path-roles.test.ts` expectations)

- [x] Step 1: Add permission + role grants; adjust `money-path-roles.test.ts` if it enumerates payroll codes
- [x] Step 2: Commit `feat(payroll): payroll:correct permission`

### Task 3: Correction register/list/cancel (service + DTO + controller + routes)

**Files:**
- Create: `backend/src/modules/payroll/payroll-correction.service.ts`
- Create: `backend/src/modules/payroll/payroll-correction.dto.ts`
- Modify: `backend/src/modules/payroll/payroll.controller.ts` (three handlers, mirror arrears block)
- Modify: `backend/src/modules/payroll/payroll.routes.ts` (GET/POST `/corrections`, POST `/corrections/:id/cancel`; add `/corrections` to the `requireCompanyPayrollAccess` prefix list at line ~37)
- Test: `payroll-correction.dto.test.ts`, `payroll-correction.service.test.ts`

DTO (spec §2): `sourcePayslipId` uuid, `amount` number ≠ 0, `reason` trimmed min 10. Query schema: `status`, `employeeId` optional. No `companyId` from client.

Service `register(companyId, input)` validation order (spec §2):
1. payslip exists, in company, `status === 'FINAL'` (else 409 pointing at void when run COMPLETED / 400 otherwise)
2. owning run status `APPROVED` or `DISBURSED` (payslip include `payrollRun { status, periodId }`)
3. `assertEmployeeInScope(sourcePayslip.employeeId, 'payroll')`
4. no other `PENDING` correction for that payslip → 400
Create row with `remainingAmount = amount`, `registeredBy = getCurrentUser()?.id`.
`list(companyId, { status?, employeeId? })` and `cancel(companyId, id)` mirror arrears (conditional `updateMany` on PENDING).
Also `pendingByEmployee(companyId, tx)` (include `sourcePayslip: { select: { payrollRun: { select: { periodId: true } } } }`) and `claim(companyId, runId, rows, tx)` that conditionally updates `remainingAmount`/status and throws on `count !== 1`.

- [x] Step 1: Write DTO test (amount 0 rejected, reason <10 rejected, happy path) → fail → implement DTO → pass
- [x] Step 2: Write service unit test (mocked prisma, arrears-test style): validation order, duplicate-PENDING rejection, 409 for COMPLETED run, cancel race → fail → implement service → pass
- [x] Step 3: Controller + routes (authorize `payroll:correct` for POST/cancel, `payroll:read` for GET; `auditLog({ action: 'CREATE', entity: 'PayrollCorrection' })` / `CANCEL`)
- [x] Step 4: `npx tsc --noEmit -p backend/tsconfig.json` clean
- [x] Step 5: Commit `feat(payroll): register, list and cancel payroll corrections`

### Task 4: `calculateCorrectionPayroll`

**Files:**
- Modify: `backend/src/modules/payroll/payroll.service.ts`
  - branch in `calculatePayroll` (spec §3): THR → CORRECTION → reject others
  - new private `calculateCorrectionPayroll(runId, database)` after `calculateThrPayroll`
  - new `ensureCorrectionEarningComponent` / `ensureCorrectionDeductionComponent` (`CORRECTION_EARNING_AUTO` ALLOWANCE isTaxable:true, `CORRECTION_DEDUCTION_AUTO` DEDUCTION isTaxable:false, sortOrder 997)
- Test: `payroll-correction-calc.test.ts` (unit, mocked repo/prisma) + reuse `run-type-guards.test.ts` source assertions if they pin the rejection message

Algorithm (spec §3): period ACTIVE else 409; pending corrections else 409; any correction whose `sourcePayslip.payrollRun.periodId === run.periodId` → 409 whole run. Group per employee: `earning = Σ positive remaining`, `deduction = Σ |negative remaining|`, `appliedDeduction = min(deduction, earning)`; `earning === 0` → skip employee (stays PENDING, listed in notes); tax = `calculateThrTax({ monthlyGross: asOfBaseSalary ?? 0, thrAmount: earning, method, ... })` requiring PPH21 component like THR; netPay = earning − appliedDeduction − tax ≥ 0 else reduce applied deduction never below 0 — **no**: spec fixes netPay = earning − appliedDeduction − tax; tax ≤ earning by construction, deduction capped at earning − 0… cap `appliedDeduction = min(deduction, earning - tax)` so net never negative. Partial negative rows: reduce `remainingAmount` oldest-first, stay PENDING; fully-consumed rows → APPLIED with payslipId/appliedRunId/appliedAt. Payslip: baseSalary 0, zero attendance fields, snapshot with correction basis; components: earning, deduction (if >0), PPH21 (if >0). Finish with `updatePayrollRunTotals` + status COMPLETED + notes naming applied/skipped counts.

- [x] Step 1: Write failing unit test for grouping/caps/partial-remaining/skipped
- [x] Step 2: Implement; run test → pass
- [x] Step 3: `tsc --noEmit` clean; run `run-type-guards.test.ts`, `thr-tax-wiring.test.ts` still green
- [x] Step 4: Commit `feat(payroll): CORRECTION run pays registered corrections`

### Task 5: Real-DB test + docs

**Files:**
- Create: `backend/src/modules/payroll/payroll-correction.mysql.test.ts` (register → CORRECTION run → approve → disburse; negative-over-earning case) — follow `payroll-calculation.mysql.test.ts` gating pattern
- Create: `docs/payroll-corrections.md` (endpoint doc incl. the paying-period tax note from spec risk #3)
- Modify: `docs/PROGRESS.md` (append entry), `docs/gap-analysis-vs-greatday.md` (GAP-14/21b partial → closed with file:line evidence)

- [x] Step 1: Write mysql test (skips without DB env like existing suite)
- [x] Step 2: Docs + progress + gap closure
- [x] Step 3: Commit `feat(payroll): correction run real-DB test + docs` and push

## Self-review notes
- Spec coverage: §1 Task 1, §2 Task 3, §3–§5 Task 4, §6 Tasks 3–5, audit/permission Task 2. Out-of-scope items untouched.
- Deviation from spec §6 file names: repository logic lives in the service (arrears precedent has no separate repository file); mysql + dto test names kept.
- Tax detail the spec leaves open: standalone run needs a monthly gross for the marginal computation — use as-of base salary like THR, 0 when the employee no longer has one.
