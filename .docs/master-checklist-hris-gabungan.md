# Master Checklist HRIS Gabungan — Session #8–#10

> The requested master-checklist file was not present in this repository when this session
> started. This scoped reconstruction records the three explicitly supplied checklist items
> without inventing status for unrelated work.

## #8 — Tenant isolation audit, module by module

- [x] Re-verify every backend module and document the endpoint × operation × company-scope
  matrix.
- [x] Inventory and justify every `runInSystemContext` boundary.
- [x] Add missing cross-company and export/import negative integration tests.
- [x] Fix small findings completely; record larger findings as prioritized follow-ups.

Status: ✅ complete and verified on commit `1f3b976`. The 27-module matrix and system-context
inventory are in `.docs/tenant-isolation-audit.md`. GitHub Actions run `35822381091` passed
backend type-check/build/lint, migrations, and **109 suites / 972 tests**.

## #9 — Explicit SUPER_ADMIN tenant mode

- [x] Confirm the product decision: option 1, mandatory active company for tenant endpoints.
- [x] Remove the implicit company-less global tenant mode at request, employee-scope, and Prisma
  boundaries.
- [x] Restrict the platform registry exception to group/company discovery/provisioning, with a
  masked company-list projection and entity-audited mutations.
- [x] Verify non-super-admin selection denial, company-less super-admin denial, selected-company
  propagation, and dedicated super-admin access auditing.

Status: ✅ complete and verified on commits `b8c8232` and `9055765`. GitHub Actions run
`35846232651` passed all jobs, including backend type-check/build/lint, migrations, and **110
suites / 979 tests**. The decision and exception boundary are documented in
`.docs/tenant-isolation-audit.md`.

## #10 — Centralized frontend company switching

- [x] One authoritative reactive `activeCompanyId` store.
- [x] No direct company-ID local-storage access outside that store.
- [x] One Axios transport boundary validates/injects the selected company context.
- [x] Tenant-aware query keys and old-tenant cache removal.
- [x] Pending old-tenant requests abort on switch.
- [x] Routed page state resets on switch.
- [x] A → B → A tests cover Payroll, Employee, and Asset.
- [x] Full frontend regression suite and delivery CI pass.

Evidence (2026-09-23): targeted frontend tests **4 files / 19 tests passed**; full frontend
Vitest **8 files / 36 tests passed**; GitHub Actions run `35820486074` passed all jobs on commit
`3993c95`. See `docs/company-switching.md` for the implementation map.

## Current-tree reconciliation (2026-09-24)

- The former six-router follow-up is closed: performance, work-calendar, company-settings,
  permission-request, notification, and audit-log all mount `requireCompanyAccess()` immediately
  after authentication, with a route-wiring regression contract.
- The former negative-test gaps are closed for BranchAttendancePolicy, foreign asset/training/
  daily-activity employee references, foreign approval delegates, and all six Leave raw locks.
- Checklist #9 does **not** retain a global read-only tenant mode. The final product decision is
  mandatory active-company mode for SUPER_ADMIN, with only the narrow platform registry outside
  tenant-domain scope.
- Checklist #10 is implemented and regression-tested; it is not pending.
- Firebase/APNs production credentials remain an external deployment-secret prerequisite. Push
  delivery code is complete and reports `BLOCKED_CONFIG` when provider credentials are absent.

## Remaining backlog after reconciliation

- [ ] **Retire the legacy migration-recovery scaffolding.** Remove
  `scripts/migrations/recover-face-match-rate-limit-index.cjs`, its dedicated check, and the
  recovery branches in `scripts/server-deploy.sh` only after production confirms both affected
  migrations are applied and stable. Because the deploy script is protected, this must be a
  separate explicitly authorized change followed by a clean migration rehearsal.
- [ ] **Broaden browser E2E coverage.** Extend beyond the current focused frontend integration
  tests to critical authenticated journeys against a stable staging environment.
- [ ] **Generate and enforce the OpenAPI contract.** Publish a machine-readable specification and
  add request/response contract checks for the remaining modules.
- [ ] **Measure face-recognition FAR/FRR.** Run the documented protocol with at least 30–50
  consented real-photo pairs across lighting/angle variation, then tune
  `DEFAULT_FACE_MATCH_THRESHOLD` from the measured result rather than synthetic fixtures.

The router-middleware and cross-company negative-test items are no longer backlog: they were
closed and verified by GitHub Actions run `35952397150` on commit `f29b4a3` (**111 suites / 990
tests passed**; 9 suites / 89 tests intentionally skipped).
