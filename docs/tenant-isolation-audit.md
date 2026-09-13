# Tenant Isolation Audit (Sprint 2 · item #8)

Systematic module-by-module verification of multi-company (tenant) isolation, done by
reading the code — not sampling. Verdicts below are grounded in `file:line` evidence.

## Mechanism (how isolation works today)

- **Context is server-derived.** `authenticate()` copies `companyId`/`companyScope`/`roles`
  from the verified JWT into an AsyncLocalStorage store (`Authenticate.ts`). A client-sent
  `companyId` is validated against the JWT's `allowedCompanyIds` and **overwritten** with the
  validated value by `requireCompanyAccess()` (`CompanyScope.ts`) — client input can *narrow*
  the tenant, never *forge* it.
- **DB layer enforces.** A Prisma `$use` middleware (`prisma.ts` → `tenant-scope.ts`) intersects
  every read on a `COMPANY_SCOPED_MODELS` model with `{ companyId: getCurrentCompanyId() }` and
  rejects writes that carry a different `companyId`. Fail-closed: a scoped query with no context
  **throws**, except for explicit `runInSystemContext()` (seeds/workers) and `SUPER_ADMIN`.
- **Structural weakness: it is an allowlist.** A model absent from `COMPANY_SCOPED_MODELS` (and
  from `PARENT_SCOPES`) gets **zero** middleware enforcement; its safety then rests entirely on
  every call site remembering to filter by hand. The middleware also does **not** recurse into
  nested `create`/`connect`, and never validates a client-supplied **scalar FK** (`employeeId`,
  `categoryId`) written into an otherwise-scoped row.

## What is solid (verified, no action)

- No cross-**company** escape via a client `companyId` — double backstop (validate-and-overwrite
  middleware + DB scoping) holds across every module checked, including modules without
  `requireCompanyAccess` (performance, work-calendar, company-settings, permission-request,
  audit-log, user) because backstop 2 still applies. `User`/`CompanySetting` compensate in-service.
- **No SQL injection.** Zero `$queryRawUnsafe`/`$executeRawUnsafe`; all raw SQL is parameterized.
- **Export / import / download / report surface is clean** — every payslip, document, private
  file, CSV export/import, and report query resolves through a tenant-scoped query, so guessing a
  foreign id yields 404, not data. CSV import validates all org FKs in-tenant.

## Findings (by tier)

### Tier 1 — real cross-company data exposure

| # | Site | Issue | Fix |
|---|------|-------|-----|
| T1.1 | `organization/repositories/branch.repository.ts:38,57` | `findAttendancePolicy`/`softDeleteAttendancePolicy` query `BranchAttendancePolicy` by **`branchId` only, no `companyId`**, and the model is **not in the allowlist** → a leaked/guessed `branchId` reads or soft-deletes another tenant's GPS geofence + attendance policy. | Add `BranchAttendancePolicy` to `COMPANY_SCOPED_MODELS`; add `companyId` to both queries. |
| T1.2 | `asset/asset.repository.ts:120` (svc `asset.service.ts:41`) | `assetAssignment.create` trusts client `employeeId` (asset checked in-tenant, employee not). `findAll`/`findById` `include: { employee }` → **cross-tenant employee PII** (name, number). | Validate `employeeId` belongs to the caller's company before create. |
| T1.3 | `training/training.repository.ts:67` (svc `training.service.ts:67`) | `trainingEnrollment.create` trusts client `employeeId`; `findAllEnrollments` includes employee name/number → cross-tenant PII. | Validate `employeeId` in-tenant before enroll. |
| T1.4 | `daily-activity/daily-activity.service.ts:77` | Elevated-role path uses manager-supplied `employeeId` unvalidated (branch checked, employee not) → activity row points at a foreign employee. | Validate `employeeId` in-tenant. |

### Tier 2 — defense-in-depth hardening (currently safe via hand-scoping, no middleware net)

| # | Site | Issue | Fix |
|---|------|-------|-----|
| T2.1 | `prisma.ts` allowlist | `RoleDataScope`, `RoleMenuAccess`, `ApprovalDelegation` carry a real `companyId` but sit **outside** the allowlist; the first two are the RBAC access config itself. Safe only while `administration.repository.ts` keeps hand-filtering. | Add all three to `COMPANY_SCOPED_MODELS`. |
| T2.2 | `workflow-engine.repository.ts:230` | `createDelegation` looks up `delegateId` **globally** (any active user) → a delegate from another company can be attached. | Validate `delegateId` is in the caller's company. |
| T2.3 | `tenant-scope.ts` `PARENT_SCOPES` | ~13 child tables (DocumentSignature, DocumentAccessLog, Survey{Question,Response,Answer}, Review{Section,Score}, GoalUpdate, TrainingMaterial, TrainingAttendance, ShiftFormulaDay, PerformanceGradeRange, AnnouncementRead) are absent → safe only while reached via a scoped-parent `include`; any future direct query is cross-tenant. | Add each to `PARENT_SCOPES`. |
| T2.4 | `leave.service.ts:190,194,225,243`, `leave.repository.ts:130,180` | Six raw `SELECT … FOR UPDATE` on `leave_requests`/`leave_balances` keyed by `id`/`employee_id` with **no `company_id`**; `finalizeApprovalEffects` (`:225`) then mutates. Upstream scoped fetch is disabled in system/SUPER_ADMIN context. | Add an explicit `company_id` predicate to each raw statement. |
| T2.5 | `organization/org-integrity.ts:59` | `org-cycle-walk` reads a parent-pointer row by `id` with no `companyId`, inconsistent with every sibling lookup in the same file. Low impact (returns only a parent id). | Add `companyId` to match siblings. |

### Tier 3 — within-company, employee-level IDOR (needs a product decision)

Cross-company is blocked here; the gap is **fine-grained `DataAccessScope` (OWN_BRANCH / OWN_DEPARTMENT / …)** being bypassable *inside* a company.

| # | Site | Issue |
|---|------|-------|
| T3.1 | `CompanyScope.ts` `applyParsedFilterToQuery` (systemic) | OWN_* enforcement forces `employeeId` **only into `req.query`**, never `req.params`. So any fetch-by-path (`req.params.employeeId` / `:id`) bypasses the fine-grained scope and is governed only by the coarse `resource:read` grant. Concrete: **`payroll.controller.ts:102` `GET /employees/:employeeId/thr`** discloses a colleague's salary-derived THR; by extension payslip/salary/calendar fetch-by-id. |
| T3.2 | `work-calendar.controller.ts:283` | `getTeamCalendar` passes `req.params.managerId` unvalidated → a `work-calendar:read` user views any manager's team calendar (within company). |
| T3.3 | `attendance.controller.ts:28` | The "pure employee" self-only guard (forces `employeeId` from token) uses a **hardcoded elevated-role allow-list**; a custom role not on the list could set an arbitrary `req.body.employeeId` (clock-in / overtime on behalf of a colleague). A capability check would be safer than a name list. |

**NEEDS-REVIEW class:** many list endpoints accept a `req.query.employeeId` filter (attendance, leave balances, payroll salaries, EWA, benefit, training, onboarding, performance). Cross-company is blocked; within-company they are protected *only if* the caller has an OWN_* scope configured. This is by-design for HR roles but becomes a disclosure risk if `resource:read` is over-granted without a matching scope.

## Test coverage

Existing DB integration tests cover cross-company IDOR for: cross-company (general), employee,
payroll, attendance, organization, financial, leave/perf/audit. **Gaps to add** (no cross-company
negative test today): BranchAttendancePolicy, asset assignment (foreign employee), training
enrollment (foreign employee), daily-activity (foreign employee), approval delegation
(foreign delegate), and the leave raw-SQL `company_id` predicate.

## Status

- **Tier 1 — DONE** (this branch). BranchAttendancePolicy added to the tenant middleware
  allowlist (closes the branchId-only read/soft-delete escape); asset-assign, training-enroll,
  and daily-activity now validate the client `employeeId` against the caller's company before
  write. Cross-company negative tests added (`company-scope-sprint2-gaps.test.ts`).
- **Tier 2 — DONE** (this branch). RoleDataScope/RoleMenuAccess/ApprovalDelegation added to the
  allowlist; 13 child tables added to `PARENT_SCOPES`; `createDelegation` validates the delegate
  is an employee in the caller's company; the six leave raw `FOR UPDATE` statements now carry an
  explicit `company_id` predicate and `finalizeApprovalEffects` requires its scoped fetch to
  resolve before mutating; the org cycle-walk is scoped by `companyId`. All verified green in CI
  (type-check + build + 863-test suite + migrations).
- **Tier 3 — DONE** (this branch; product decision: enforce the fine-grained scope on all
  accesses). `assertEmployeeInScope()` enforces the caller's DataAccessScope on fetch-by-path/
  by-id reads (payroll THR, work-calendar employee calendar); `getTeamCalendar` requires the
  requested manager to be in scope; attendance clock-in and overtime creation switched from a
  "pure EMPLOYEE" denylist to a positive elevated-capability gate so custom roles can no longer
  set an arbitrary employeeId. The enforcement is a no-op for SUPER_ADMIN/system and for
  ALL/COMPANY_ONLY scopes — only already-restricted users are tightened. Verified green in CI.
