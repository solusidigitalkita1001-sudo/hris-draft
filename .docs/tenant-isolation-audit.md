# Tenant Isolation Audit — Checklist #8

Audit date: 2026-09-23  
Scope: the 27 tenant/business modules under `backend/src/modules` (authentication is excluded
because it establishes identity/session context rather than operating on tenant domain data).

## Enforcement model

The request boundary is `authenticate` followed by `requireCompanyAccess()`. The latter accepts
a client-selected company only after checking the JWT-derived `companyScope`, overwrites any
client company field with the validated value, and carries it into `AsyncLocalStorage` for all
downstream calls. The database boundary independently scopes every model in
`COMPANY_SCOPED_MODELS`; child models without their own `companyId` are constrained through
`PARENT_SCOPES`. Employee visibility uses the server-derived predicate in
`employee-data-scope.ts`. Client `employeeId` values used as foreign keys are additionally
resolved against the active company before write.

Legend used below:

- Operations: `L` list/report, `R` detail/read, `C` create/import/upload, `U` update/action,
  `D` delete, `A` approve/reject/workflow, `X` export/download.
- `CTX` = authenticated company boundary; `DB` = Prisma company/parent scoping; `FK` = explicit
  tenant validation for scalar/nested foreign keys; `SELF` = owner/data-scope predicate.
- Every status is based on the current tree, not the historical review alone.

## Endpoint × operation × company-scope matrix

| # | Module / endpoint families | Operations | Isolation evidence | Status |
|---:|---|---|---|---|
| 1 | administration — `/role-menu-access/*`, `/role-data-scope/*` | L/R/C/U | CTX per route; DB on RoleMenuAccess/RoleDataScope; role/company checked in service | ✅ Verified |
| 2 | announcement — `/`, `/unread-count`, `/:id`, `/:id/read` | L/R/U | CTX; DB permits active-company plus read-only platform announcements; read child parent-scoped | ✅ Verified |
| 3 | asset — `/my`, `/`, `/:id`, `/:id/depreciation`, `/:id/assign`, `/:id/return` | L/R/C/U | CTX + DB; assignment employee FK is resolved in active company | ✅ Fixed + regression covered |
| 4 | attendance — `/me/*`, `/overtime/*`, `/context`, `/summary`, `/report`, `/:id`; correction router | L/R/C/U/D/A | CTX + DB; SELF for mobile paths; employee FK/capability checks; workflow reference scoped | ✅ Verified |
| 5 | audit-log — `/`, `/:id`, `/verify-integrity`, `/export` | L/R/X | CTX + DB; audit chain queries carry company; export uses same scoped repository | ✅ Fixed router boundary |
| 6 | benefit — `/plans/*`, `/enrollments/*` | L/R/C/U/D | CTX + DB; enrollment employee/plan relations resolve in tenant | ✅ Verified |
| 7 | company-settings — `/`, `/:key`, `/bulk` | L/R/C/U/D | CTX + DB; setting keys are company-qualified | ✅ Fixed router boundary |
| 8 | daily-activity — `/my`, `/`, `/:id`, `/:id/complete` | L/R/C/U/D | CTX + DB + SELF; elevated employee FK is resolved in active company | ✅ Fixed + regression covered |
| 9 | document-management — `/categories`, `/`, `/:id`, `/:id/file`, `/:id/signed-url`, `/:id/download` | L/R/C/X | CTX + DB/PARENT; service intersects guessed IDs with company and owner/access grants before storage access | ✅ Verified |
| 10 | employee — `/`, `/:id`, nested profile/sub-entities, `/import`, `/export` | L/R/C/U/D/A/X | CTX + DB/PARENT + server data-scope; org FKs validated; multipart import has post-parse company guard | ✅ Verified; export/import negative tests added |
| 11 | employee-loan — `/types`, `/my`, `/`, `/:id`, installments/amortization/workflow | L/R/C/U/A | CTX + DB/PARENT + SELF; workflow lookup scoped | ✅ Verified |
| 12 | EWA — `/my`, `/my/limit`, `/`, `/:id`, action endpoints | L/R/C/U/A | CTX + DB + SELF; employee and payroll-period references resolved server-side | ✅ Verified |
| 13 | leave — `/types`, `/balances/*`, `/`, `/:id`, workflow/action endpoints | L/R/C/U/A | CTX + DB; raw locking SQL includes `company_id`; employee/type/workflow references scoped | ✅ Fixed + regression covered |
| 14 | notification — `/`, `/unread-count`, `/read*`, `/:id`, `/device-tokens` | L/R/C/U/D | CTX + DB; user ID is session-derived; global token rebind is narrowly justified below | ✅ Verified |
| 15 | onboarding — `/checklists/*`, `/resignations/*`, `/clearances/*` | L/R/C/U/A | CTX + DB/PARENT; employee/resignation/clearance relations scoped | ✅ Verified |
| 16 | organization — groups/companies/branches/divisions/departments/positions and attendance policies | L/R/C/U/D | group endpoints use group guard; tenant endpoints CTX + DB; every graph hop/FK validates company and cycle bounds | ✅ Fixed + regression covered |
| 17 | payroll — components/salaries/periods/runs/payslips/formulas/payment batches | L/R/C/U/D/A/X | CTX + DB/PARENT + employee payroll scope; raw locks carry company; exports/downloads re-fetch scoped parents | ✅ Verified |
| 18 | performance — methods/formulas/indicators/grades/periods/planning/execution/results/calibration/reviews/goals/feedback | L/R/C/U/D/A | CTX + DB/PARENT + employee data-scope; uploads attach only after scoped parent lookup | ✅ Fixed router boundary |
| 19 | permission-request — `/my`, `/`, `/:id`, cancel/approve/reject/workflow | L/R/C/U/A | CTX + DB + SELF; approver and workflow paths re-fetch scoped request | ✅ Fixed router boundary |
| 20 | RBAC — `/permissions/all`, roles, role permissions | L/R/C/U/D | permission catalog is global reference data; Role/RoleMenuAccess are DB scoped; assignment authority guards target company and priority | ✅ Verified |
| 21 | recruitment — postings/candidates/applications/offers/interviews/feedback | L/R/C/U/A | CTX + DB/PARENT; application/offer/interview FKs remain under scoped parents | ✅ Verified |
| 22 | reports — `/summary`, `/headcount`, `/attendance`, `/leave`, `/payroll`, `/turnover`, `/recruitment` | L/X | CTX; all source queries use scoped models; payroll report additionally audited | ✅ Verified |
| 23 | training — categories/courses/sessions/enrollments | L/R/C/U | CTX + DB/PARENT; enrollment employee FK validated in active company | ✅ Fixed + regression covered |
| 24 | travel-expense — categories/trips/advances/claims/receipts/reimbursements/workflow | L/R/C/U/A | CTX + DB/PARENT + SELF; receipt path is owner-derived; employee/workflow relations scoped | ✅ Verified |
| 25 | user — users, roles, company-access grants | L/R/C/U/D | global User rows are filtered by `user-access-guard`; target employee/company memberships and role authority are server-validated | ✅ Verified (manual global-model guard) |
| 26 | work-calendar — calendars/days/formulas/holidays/shift swaps/employee/team | L/R/C/U/D/A | CTX + DB/PARENT; employee/team path IDs pass `assertEmployeeInScope`; manager traversal is bounded and tenant-filtered | ✅ Fixed router boundary |
| 27 | workflow-engine — templates/instances/actions/bulk approvals/delegations | L/R/C/U/D/A | CTX + DB/PARENT; delegate must be an employee in active company; references and approvers scoped | ✅ Fixed + regression covered |

## Findings and disposition

The current tree already contained the complete fixes for the earlier Tier 1–3 findings recorded
in `docs/tenant-isolation-audit.md`: attendance policy scoping, asset/training/daily-activity FK
validation, RBAC/delegation model coverage, parent scopes, leave raw-SQL company predicates,
organization cycle scoping, and employee-level path guards.

This re-audit found one remaining small, systemic gap:

| ID | Finding | Risk | Disposition |
|---|---|---|---|
| T2.6 | Five tenant routers authenticated users but did not run `requireCompanyAccess()`. Their Prisma calls still used the JWT default company, so cross-company leakage was blocked, but a validated active-company selection could be ignored and fine-grained request data scope was not injected. | Medium correctness / defense in depth | ✅ Fixed for audit-log, company-settings, performance, permission-request, and work-calendar. Notification had already been fixed. A route-wiring contract test prevents regression. |

No new open cross-company leak remains from this pass. `User` stays a deliberate global model
with explicit membership/employee authority guards, while the global permission catalog remains
tenant-neutral reference data.

## Nested writes, scalar foreign keys, and raw SQL

- `COMPANY_SCOPED_MODELS` covers tenant roots; `PARENT_SCOPES` covers child rows including
  workflow steps/logs/rules, payslip components, document access/signatures, survey/review/goal
  children, training children, shift-formula days, grade ranges, and announcement reads.
- Scalar employee/delegate FKs that previously bypassed middleware are explicitly checked for
  asset assignment, training enrollment, daily activity, and workflow delegation.
- Organization and employee org-unit FKs use explicit `{ id, companyId, deletedAt: null }`
  checks. Hierarchy walks are capped at 50 hops with a visited/frontier guard.
- All application `$queryRaw` statements are parameterized. Tenant-domain row locks in Leave,
  EWA, and Payroll include an explicit company predicate or lock a company row already resolved
  from a scoped record. No `$queryRawUnsafe`/`$executeRawUnsafe` is present.
- Employee CSV import validates org references against the selected company before its single
  transaction; export calls the same scoped list path. Document/payslip/payment downloads resolve
  the scoped database record before returning storage or bank data.

## `runInSystemContext` inventory

System context is a privileged cross-tenant bypass. Every production call site is listed here;
the operation is bounded to its callback and has a non-empty audit reason.

| Area / reason | Why cross-tenant access is needed | Boundary / compensating constraint | Verdict |
|---|---|---|---|
| database seed — `database-seed` | seed owns multi-company bootstrap | wraps only `seedAll`; not request reachable | ✅ justified |
| worker — `domain-event-notification` | consumes events for every tenant | one validated queue event per callback | ✅ justified |
| worker — performance/workflow-SLA/career/offboarding/retention/leave automation | scheduled platform jobs scan due work across companies | one job handler per callback; services retain record/company predicates | ✅ justified |
| worker — six `*-scheduler-bootstrap` reasons | registers global recurring schedules | bootstrap only; no request input | ✅ justified |
| push — `push-delivery-sweep` | bounded fan-out/retry across tenants | batches of 200 notifications / 100 deliveries; joins company+user for registrations | ✅ justified |
| push — `rebind-mobile-push-token` | a globally unique provider token must be detached from an old account | exact SHA-256 token hash; atomic delete+upsert; new row uses authenticated company/user | ✅ justified |
| employee — `employee-org-ref-validation`, `employee-import-org-validation` | multi-company admin may target a selected tenant different from default | every lookup includes explicit selected `companyId` and active-row predicate | ✅ justified |
| organization — `org-integrity-lookup`, `org-cycle-walk`, `org-delete-dependency-check` | validate target graph independently of caller default tenant | target row is first scoped; graph hops use company or globally unique anchored FK; 50-hop cap | ✅ justified |
| security — `manager-team-resolve` | hierarchy traversal needs several scoped models | every hop includes `companyId`; depth 50; empty result fails closed | ✅ justified |
| security/middleware — `own-scope-org-lookup` | resolve requester org unit before injecting OWN_* scope | exact authenticated employee plus selected `companyId` | ✅ justified |
| audit — `audit-log-append` | audit append must survive tenant-scoped mutation context and serialize one chain | single append under advisory lock; company comes from authenticated/audited request | ✅ justified |
| announcement — `increment validated platform announcement view` | platform announcement has `companyId = null` | only after scoped candidate validation; exact announcement ID + null company | ✅ justified |
| user — `user-employee-link-scope-check` | User is global and may link an employee from an administered company | reads only target company ID, then checks JWT-derived allowed company set | ✅ justified |

## Test evidence

New/updated tests in this pass:

- `CompanyScope.test.ts`: the selected, validated company is visible in downstream server
  context (not merely rewritten in query/body).
- `tenant-route-scope.test.ts`: every router fixed by T2.6 mounts the company boundary directly
  after authentication.
- `employee.import-export-scope.test.ts`: foreign-company export is denied before reading rows;
  foreign-company multipart import is denied before parsing/inserting rows.
- Existing `company-scope-sprint2-gaps.test.ts`: asset, training, daily-activity, delegation, and
  custom-role overtime negative cases.

Execution status: targeted and full-suite results will be recorded here after the current changes
finish verification.

## Checklist #9 hand-off

The code currently contains a historical **implicit global read-only** mode for a company-less
SUPER_ADMIN. This audit records it as current behavior only; it does not treat that historical
choice as the product confirmation required by checklist #9. No Task #9 behavior is changed until
the product owner chooses between mandatory active-company mode and an explicit audited global
mode.
