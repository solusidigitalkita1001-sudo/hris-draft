# Hardening Fase 0–1 — Branch Review & Apply Runbook

Branch: `feature/hardening-fase0` (12 commits, not pushed). Base: `main`.
All work verified: `tsc --noEmit` = 0 errors, `prisma validate` OK, per-task sanity checks passed.

## Status per task

| Task | Status | Notes |
|------|--------|-------|
| 0.1 Env validation (Zod, fail-fast) | ✅ | no more insecure fallbacks |
| 1.1 MFA TOTP + recovery codes | ✅ backend / 🔶 | force-MFA-by-role + frontend UI pending |
| 1.2 File upload magic-byte + UUID rename | 🔶 | ClamAV(daemon)/SVG/avatar-500KB deferred |
| 1.3 Signed document URLs | ✅ backend / 🔶 | frontend must fetch signed URL (raw `/uploads/documents` now 403) |
| 1.4 Audit before/after diff + PII mask | ✅ backend | frontend side-by-side view pending |
| 1.5 Argon2id migration | ✅ | bcryptjs kept for legacy verify until all `passwordVersion=2` |
| 1.6 CSP per-request nonce | ✅ | `unsafe-inline` removed |
| 1.7 Secure cookie flags | 🔶 | primitive ready; no cookies set yet (Bearer auth) |
| 1.8/1.9/1.10 NIK/NPWP/BPJS/phone validation | ✅ | |
| 1.11 Bank account validator + bankCode | 🔶 | Luhn intentionally skipped (not universal in ID) |
| 1.12 Composite unique constraints | ✅ | + P2002 → 409 handler |
| 1.13 Enum columns | ✅ | migration backfills legacy values first |
| 1.14 Relational date rules | 🔶 | age≥15 & resign>join done; career-overlap/loan deferred |
| 1.15 Leave balance race condition | ✅ | txn + `FOR UPDATE`; load-test proof pending |
| 0.2 CSRF | ⏭ skipped | moot — Bearer-header auth, not cookies |

## Migrations to apply (4, in this order)

1. `20260722000000_employee_enums_unique_constraints`
2. `20260722010000_user_password_version`
3. `20260722020000_employee_bank_code`
4. `20260722030000_user_mfa_recovery_codes`

Confirmed: these exactly equal the `main → HEAD` schema delta (no drift).

### Apply

```bash
cd backend
# review pending first
npx prisma migrate status
# apply
npx prisma migrate deploy
# regenerate client (already generated locally, safe to repeat)
npx prisma generate
```

### ⚠️ Pre-apply data risks

- **Unique indexes** `(company_id, id_number)` and `(company_id, phone)` will FAIL if
  existing rows already contain duplicates. Check first:
  ```sql
  SELECT company_id, id_number, COUNT(*) c FROM employees
    WHERE id_number IS NOT NULL GROUP BY company_id, id_number HAVING c > 1;
  SELECT company_id, phone, COUNT(*) c FROM employees
    WHERE phone IS NOT NULL GROUP BY company_id, phone HAVING c > 1;
  ```
  Dedupe/null-out before applying.
- **Enum columns**: migration 1 backfills `'Male'→MALE`, `'Islam'→ISLAM`,
  `'Kristen'→KRISTEN_PROTESTAN`, etc. before the type change. Any unmapped legacy
  value becomes `NULL` (won't error). Re-seed or spot-check after.

## Post-apply smoke checks

- `npm run dev` should now **exit 1** if any required secret is missing (0.1).
- Login still works; legacy bcrypt users auto-upgrade to argon2 on first login (1.5).
- Enable MFA: `POST /auth/mfa/setup` → scan QR → `POST /auth/mfa/enable {code}` →
  next login needs `totp` (1.1).
- Upload `virus.exe.png` to `POST /documents` → 400 rejected (1.2).
- `GET /uploads/documents/<file>` → 403; use `GET /documents/:id/signed-url` (1.3).

## Not yet done (needs deps/infra or frontend)

- ClamAV AV scanning (1.2), force-MFA-by-role + MFA frontend (1.1),
  signed-URL frontend + audit-diff viewer (1.3/1.4), leave concurrency load test (1.15).
