# Migration runbook (Sprint 2 · item #6 — rehearsal, backup/restore, recovery)

Deploy applies migrations via `scripts/server-deploy.sh` → `prisma migrate deploy`. This runbook
makes migrations repeatable, verifiable, and recoverable. **Never run a rehearsal or a `migrate
dev`/`reset` against production** — always a throwaway database.

## 1. Automated rehearsal (repeatable, deterministic)

`scripts/migration-rehearsal.sh` applies the full chain to a fresh DB, seeds synthetic
multi-tenant data, and asserts health (drift-free, no NULL `company_id`, tenant-critical
tables/indexes present, FKs enforced). CI already runs the empty-DB apply + drift check on every
push (`.github/workflows/ci.yml` → "Migration validation" job); the script adds the seed + data
assertions.

```bash
# throwaway DBs only
DATABASE_URL='mysql://root:root@127.0.0.1:3306/hris_rehearsal' \
SHADOW_DATABASE_URL='mysql://root:root@127.0.0.1:3306/hris_rehearsal_shadow' \
bash scripts/migration-rehearsal.sh
```

Covers checklist items: **empty-DB chain**, **no-NULL company_id backfill**, **index/FK
verification**, **deterministic re-run in a new environment**.

## 2. Rehearsal from an older / production-like snapshot

The empty-DB apply does not exercise the *backfill* branches of drift-reconcile migrations (there
is no legacy data to backfill). To exercise those:

- **Old snapshot (~30 commits back):** `git checkout <old-sha> -- backend/src/database/prisma`,
  `prisma migrate deploy` to a fresh DB, seed, then check out `main` again and
  `prisma migrate deploy` on the same DB. This replays "old DB → newest migrations".
- **Production-like snapshot:** restore an anonymized dump (see §6) into a throwaway DB, then
  `prisma migrate deploy`. This is the only test that exercises real backfill volume + shapes.
  Run `scripts/migration-rehearsal.sh` afterwards (it will re-`migrate deploy` as a no-op, seed is
  optional here — comment it out and run only the assertions against the restored data).

## 3. Preflight for NOT NULL / re-parenting migrations

Before a migration adds `NOT NULL` to a backfilled column or tightens a FK, run a **preflight**
against the target DB and abort if any orphan/NULL remains:

```sql
-- Example: before MODIFY company_id ... NOT NULL on a child table
SELECT COUNT(*) AS would_break
FROM child_table c
LEFT JOIN parent_table p ON p.id = c.parent_id
WHERE c.company_id IS NULL OR p.id IS NULL;   -- must be 0
```

The reconcile migration `20260912130000_reconcile_schema_drift` follows the safe pattern: add the
column **NULLABLE** → backfill from the parent → only then `MODIFY ... NOT NULL`. Any residual NULL
makes the `NOT NULL` step fail loudly (the migration aborts) rather than silently corrupting data.
Keep that ordering for every future backfill.

## 4. Post-migration data-integrity spot check

After migrating a restored snapshot, confirm core data was not altered unexpectedly — capture
before/after and diff:

```sql
SELECT 'employees' t, COUNT(*) n FROM employees
UNION ALL SELECT 'attendances', COUNT(*) FROM attendances
UNION ALL SELECT 'leave_requests', COUNT(*) FROM leave_requests
UNION ALL SELECT 'payroll_runs', COUNT(*) FROM payroll_runs
UNION ALL SELECT 'payslips', COUNT(*) FROM payslips
UNION ALL SELECT 'workflow_instances', COUNT(*) FROM workflow_instances
UNION ALL SELECT 'job_applications', COUNT(*) FROM job_applications;
```

Row counts must be stable across a pure migration (a migration that intentionally transforms data
is the exception — note the expected delta in that migration's rollback plan, §5).

## 5. Rollback / forward-fix plan (per new migration)

Prisma has no down-migrations here, so every new migration ships with a written plan:

- **Additive** (new nullable column / new table / new index): rollback = deploy the previous app
  commit; the extra column/table is inert. No DB action needed. This is the default and the safest.
- **Contracting** (drop/rename column, add NOT NULL, tighten FK): **forward-fix only**. The old app
  cannot run against the new schema, so do not code-roll-back past it (see the deploy rollback's
  code-only caveat, `docs/deploy-rollback.md`). If it must be undone, write and rehearse an explicit
  reversing migration before touching production.
- Follow **expand → migrate → contract** across releases so a code rollback is always safe between
  the expand and contract steps.

## 6. Backup + restore drill (synthetic / anonymized data)

Prove restore works before you need it:

```bash
# BACKUP (throwaway/anonymized source only)
mysqldump -h "$H" -u "$U" -p"$P" --single-transaction --routines --triggers "$DB" > backup.sql

# RESTORE into a fresh DB and verify
mysql -h "$H" -u "$U" -p"$P" -e "CREATE DATABASE hris_restore_test;"
mysql -h "$H" -u "$U" -p"$P" hris_restore_test < backup.sql
# then: prisma migrate deploy against hris_restore_test + run §4 spot check
```

Run this drill on a schedule with an anonymized production dump (scrub PII: names, NIK/NPWP, bank,
face embeddings) and record the date + result here each time — the acceptance is that the restore
was **actually performed**, not just documented.

## 7. "App rolled back but schema already changed" — recovery

The sharp edge. If a deploy migrated the DB, then the app is rolled back to an older commit:

- If the migration was **additive** → the old app ignores the new column/table; no action.
- If the migration was **contracting** → the old app will error against the new schema. Recovery:
  **fix forward** (re-deploy the newer, schema-compatible app) rather than roll the app back. Only
  if forward-fix is impossible, restore the pre-migration backup (§6) and replay from there.
- The deploy workflow's auto-rollback restores **code only** and deliberately never reverts
  migrations (`docs/deploy-rollback.md`), which is why the expand/contract discipline in §5 is
  mandatory.

## 8. Retire the temporary recovery scaffolding (after prod is stable)

`scripts/server-deploy.sh` carries one-off recovery for two migrations
(`recover-face-match-rate-limit-index.cjs` + the `20260809120000_attendance_policy_company_default`
sanitizer). Once production has those migrations confirmed applied and stable, remove the recovery
branches so they don't become a permanent crutch. This edits a protected deploy file — do it as a
separate, explicitly-approved change, and rehearse a clean deploy (§1) without them first.

## What still needs your infrastructure

- Restoring a real **anonymized production snapshot** (§2, §6) — needs prod dump access.
- Running the **backup-restore drill for real** and recording the result (§6).
- Retiring the recovery scripts (§8) — needs prod-stability confirmation + a protected-file change.
