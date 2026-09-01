# System Hardening Implementation — 2026-08-31

This document records the implementation performed after the full-system audit. It is intentionally separate from existing review/progress documents that already had uncommitted edits.

## Completed

- EWA and Daily Activity routers now authenticate and establish company context before authorization.
- Cookie-authenticated mutations use a signed double-submit CSRF token. Bearer-only native/API clients remain compatible.
- Tenant-scoped Prisma operations fail closed without tenant context. Trusted seed, scheduler, and worker operations require a named system context.
- Payroll disbursement rejects the user who approved the same payroll run.
- Successful authenticated mutations without entity-specific audit middleware receive a generic, PII-safe audit entry.
- Backend security regression tests cover router middleware order and CSRF behavior.
- Frontend access-control tests establish a working Vitest baseline.
- Shared controls have larger touch targets, visible focus states, reduced-motion behavior, and accessible labels.
- Heavy performance, workflow, attendance, self-service, and work-calendar pages use route-level lazy loading.
- A production Compose configuration requires secrets, isolates stateful services, and avoids publishing database/cache/broker ports.
- The backend container runs as the non-root `node` user.
- EWA creation is serialized with a per-employee MySQL advisory lock. Pending,
  approved, and paid requests all reserve the employee's current-period limit.
- Audit hash-chain appends are serialized per company and the previous-hash
  read plus insert now execute in one transaction.
- A public safe-method CSRF bootstrap endpoint allows sessions created before
  the CSRF rollout to refresh without weakening mutation validation.
- Face-recognition decisions fail closed: client-supplied reference vectors and
  similarity verdicts are rejected, and heuristic histogram vectors are not
  accepted as biometric proof. FACE_RECOGNITION currently returns 503 until a
  trusted server-side reference-photo retrieval pipeline is implemented.
- Frontend face recognition, router, and transitive packages are lockfile-pinned.
  Unused vulnerable `jspdf` and `xlsx` dependencies were removed.
- Backend dependency cleanup removed unused `nodemailer`, replaced `uuid` with
  Node's `crypto.randomUUID`, and replaced vulnerable `file-type` with a small
  allowlisted JPEG/PNG/GIF/PDF signature check covered by regression tests.
- Redis, RabbitMQ, and BullMQ are disabled automatically under `NODE_ENV=test`,
  keeping unit/integration tests isolated from local infrastructure.
- An opt-in real-MySQL advisory-lock test now verifies that two concurrent
  operations with the same key cannot overlap (`RUN_DB_INTEGRATION=1`). It
  does not write application tables.
- CSRF now has an HTTP-level regression test covering token bootstrap, cookie
  transport, a valid cookie-authenticated mutation, and a missing-header 403.
- Face payloads are rejected when smuggled through non-face attendance methods.
  Client-generated selfie/reference vectors, storage URLs, reference images,
  similarity scores, and match verdicts are rejected before any attendance row
  or face log can be written; the old client-verdict fallback code was removed.

## Verification

- Backend TypeScript: pass (`tsc --noEmit`).
- Backend targeted EWA/security tests: 18/18 pass.
- Backend full Jest suite: 49/49 suites, 405/405 tests pass after test isolation
  and stale RBAC repository mocks were corrected.
- Frontend tests: 3/3 pass.
- Production Compose validation: pass.
- Frontend production build: pass with esbuild minification. The previous Terser configuration transformed all modules but made minification impractically slow; the production default now uses esbuild and still drops console/debugger statements.
- Frontend dependency audit, including dev toolchain: 0 vulnerabilities
  (`npm audit`). Vite/Vitest, the React plugin, and React Router were upgraded
  to patched major versions and verified by build/tests.
- Backend dependency audit, including dev toolchain: 0 vulnerabilities.

### Follow-up batch environment status (2026-09-01)

- The real-MySQL advisory-lock test is present but could not be executed in this
  workspace because the OrbStack/Docker socket is unavailable and local MySQL
  on port 3307 is not running.
- The new targeted Jest run and a fresh `tsc --noEmit` invocation could not
  complete because the current local Node toolchain stalls while cold-loading
  dependencies (the captured Jest stack was inside the CommonJS loader under
  `pkg-dir/locate-path`). The processes were stopped cleanly; no test assertion
  or compiler diagnostic was reported. Changed TypeScript files separately
  passed syntax transpilation.
- `git diff --check` passes for all files changed in this follow-up batch.

## Follow-up verification before go-live

- Run the opt-in database-backed advisory-lock test against the same MySQL
  version used in production with `RUN_DB_INTEGRATION=1` enabled (target:
  `src/shared/database/advisory-lock.mysql.test.ts`).
- Run browser E2E tests for login/refresh/logout CSRF behavior, company switching, payroll maker-checker, EWA, and Daily Activity.
- Run a formal SAST/dependency scan and authenticated DAST against staging.
- Exercise Docker image startup with production secrets and verify upload-volume ownership.
- Perform real-device accessibility/responsive checks on iOS, Android, tablet, and keyboard-only desktop.
- Implement trusted face-reference enrollment/storage retrieval and server-side
  image decoding before re-enabling FACE_RECOGNITION attendance.
