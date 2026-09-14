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

## Fix — functional guarantee (done, this branch)

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

This satisfies the acceptance criteria — **no mixed-tenant UI state, and an old request can't
overwrite the new company's state.**

## Remaining — consistency cleanup (Phase 2, not done)

Functionally correct now, but the checklist's single-source-of-truth items remain as hygiene:

- Make the store the ONLY read source: remove the ~25 pages that read `localStorage.getItem('companyId')`
  / `user.companyId` directly (list in the audit) and have them subscribe to `useCompanyStore`.
- Add central `companyId` transport in the `services/api.ts` request interceptor (inject from
  `useCompanyStore.getState().activeCompany?.id`) and drop the ~40 manual `?companyId=` args —
  careful to exclude non-tenant endpoints (company/group list, auth).
- Optional: clear the (currently unused) React Query cache and abort in-flight requests inside a
  single `switchCompany` action, as insurance for a future React Query adoption.
- A few pages still fire a first-paint request with an empty companyId before the mirror is
  populated (Leave, Payroll list/period, Asset, Offboarding, Benefit) — guard with `if (!id) return`.

## Deploy note

The frontend does **not** auto-deploy (its `dist/` is git-ignored and served statically by nginx).
This fix reaches production only after a manual frontend rebuild + deploy.
