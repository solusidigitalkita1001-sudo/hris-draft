# Company switching — mixed-tenant hardening (Sprint 2 · item #10)

## Problem (audited)

The active company lives in a Zustand store (`stores/company.store.ts`) but is mirrored into
`localStorage`. About half the transactional modules (Leave, Loan, Benefit, Organization, Work
Calendar, Payroll lists, EWA, Offboarding, Daily Activity, Workflow, Asset, Travel) read the
`localStorage` mirror or `user.companyId` **non-reactively**, so switching companies updated the
store but never re-rendered or refetched those pages — they kept showing the previous tenant's
data until a manual refresh. There was no cache invalidation, no in-flight abort, and no remount
on switch. React Query is installed but unused; all fetching is manual `useEffect`+`useState`.
`auth.store` also rewrote the company mirror on every `window.focus`/`loadProfile`, which could
silently clobber an active switch.

## Fix — functional guarantee

The single highest-leverage guard, per the audit:

- **Remount routed content on switch.** `layouts/DashboardLayout.tsx` keys the `<Outlet>` subtree
  by `activeCompany.id`. Switching companies unmounts and remounts every page: all component
  state (lists, detail/modal ids, forms) is discarded and every data fetch re-runs under the new
  tenant. A slow company-A response then resolves into an *unmounted* instance and cannot
  overwrite company-B state — this closes both the stale-data and the last-writer-race hazards
  wholesale, even for pages that have no reactive company dependency.
- **Stop the mirror desync.** `stores/auth.store.ts` only SEEDS the company mirror when no
  company is active; it no longer overwrites an in-progress switch on `window.focus`/
  `loadProfile`. `reset()` now clears the active company so a previous user's tenant can't leak
  into the next session.
- **One authoritative ID.** `stores/company.store.ts` owns `activeCompanyId`; every page that
  previously read `localStorage.companyId` now subscribes to this value. The store alone owns
  the compatibility mirror in local storage.
- **One transport boundary.** `services/api.ts` injects the current company into every
  tenant-aware request and overwrites stale caller parameters. Auth, health, company-list, and
  group-list requests are explicitly company-independent. Backend `CompanyScope` validation
  remains authoritative.
- **Abort before switching.** The API layer assigns a shared company-generation abort signal to
  tenant requests. Changing `activeCompanyId` aborts all pending requests from the old tenant
  before a new request can be sent.
- **Tenant-aware cache lifecycle.** React Query keys are constructed with
  `companyQueryKey(activeCompanyId, ...)`; switching company cancels and removes every cache
  entry belonging to the previous tenant.

Together with the keyed routed subtree, these controls satisfy the functional criteria: no
mixed-tenant UI state, tenant-old selections/forms are discarded, stale requests cannot write
back, and cached data cannot be reused by a different company.

## Verification

- `frontend/src/stores/company-switching.integration.test.tsx` exercises A → B → A without a
  browser refresh in Payroll, Employee, and Asset.
- `frontend/src/services/api.test.ts` verifies stale company parameters are overwritten and a
  pending company-A request is aborted before company-B traffic starts.
- `frontend/src/lib/query-client.test.ts` verifies company IDs are embedded in tenant query keys
  and the old tenant cache is removed on switch.
- Repository grep permits `companyId` local-storage access only in
  `frontend/src/stores/company.store.ts`.

## Deploy note

The frontend does **not** auto-deploy (its `dist/` is git-ignored and served statically by nginx).
This fix reaches production only after a manual frontend rebuild + deploy.
