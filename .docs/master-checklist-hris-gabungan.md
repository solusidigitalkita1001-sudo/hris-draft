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

- [ ] Confirm the product decision before changing the existing behavior.
- [ ] Implement the selected explicit mode consistently.
- [ ] Verify denial for non-super-admin users and audit logging for global access.

Status: pending product confirmation. The current branch already contains a historical
read-only implicit global-mode implementation; this session will not silently treat that as the
requested product decision.

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
