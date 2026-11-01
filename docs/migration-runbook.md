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

This section is the **rehearsal** drill: throwaway or anonymized data only, run by hand, whenever
you want confidence the restore mechanics work. It used to be the only backup/restore path this
repo had. It no longer is — **§6a below is the automated production path**, taken unattended on
every deploy. Keep running this drill anyway: it is the only place that exercises `prisma migrate
deploy` against *restored* data end-to-end (§6a never does — it only takes the dump).

Prove restore works before you need it:

```bash
# BACKUP (throwaway/anonymized source only)
mysqldump -h "$H" -u "$U" -p"$P" --single-transaction --routines --triggers "$DB" > backup.sql

# RESTORE into a fresh DB and verify
mysql -h "$H" -u "$U" -p"$P" -e "CREATE DATABASE hris_restore_test;"
mysql -h "$H" -u "$U" -p"$P" hris_restore_test < backup.sql
# then: prisma migrate deploy against hris_restore_test + run §4 spot check
```

`-p"$P"` above is fine only because the source is throwaway/anonymized and run by hand off the
shared server. Never use that form against the real database on the shared host — see §6a's note
on credential handling for why.

Run this drill on a schedule with an anonymized production dump (scrub PII: names, NIK/NPWP, bank,
face embeddings) and record the date + result here each time — the acceptance is that the restore
was **actually performed**, not just documented.

## 6a. Automated pre-migration backup (production)

Added for finding I-H4: 85 migrations had been applied against the real database with no dump
ever taken, and code rollback (`docs/deploy-rollback.md`) only ever undid the app, never the
schema. `scripts/server-deploy.sh` now takes one automatically, every deploy, before anything
touches the schema.

**Where it runs, and why the order matters:** STEP 5/9 of `server-deploy.sh`, before STEP 6/9 (the
`_prisma_migrations` sanitizer, which already issues `CREATE INDEX`/`ALTER TABLE ... MODIFY
COLUMN`) and before STEP 7/9 (`prisma migrate deploy`). A dump taken after either would not
describe the database anybody would want back. If the dump cannot be written, fails `gzip -t`, or
is missing mysqldump's `Dump completed` trailer (a truncated dump — the dangerous case, since it
restores cleanly while missing rows), the deploy **aborts before the sanitizer runs** — no schema
change happens on a deploy without a verified backup.

**Where dumps land:** `backups/<database>-<timestamp>-<commit>.sql.gz` inside the deploy
directory, newest `DB_BACKUP_KEEP` kept (default 7, env-overridable). `backups/` is git-ignored;
treat it as confidential as `backend/.env` — it holds live employee and payroll data.

**Env knobs** (full table in `docs/deploy-rollback.md` § Database rollback): `DB_BACKUP_ENABLED`
(default `true`), `DB_BACKUP_DIR`, `DB_BACKUP_KEEP` (default `7`), `DB_BACKUP_MIN_FREE_MB`
(default `2048`), `MYSQL_CONTAINER`.

**Credential handling:** the password reaches `mysqldump` through a mode-600 `--env-file` passed
to `docker exec` (`MYSQL_PWD=...`), never as a command argument — this host is shared with four
other projects, and `docker exec -e MYSQL_PWD=...` would put the password in that shared host's
own `ps auxww` output for the `docker exec` process itself, not just inside the container. The
temp file is removed as soon as the dump function returns, success or failure.

### Restoring the automated backup (production)

Same side-by-side-first discipline as `docs/deploy-rollback.md` § Restoring — full command listing
lives there, this is the order of operations:

1. **Stop writes first.** Put the app in maintenance or stop the backend container
   (`docker compose stop hris_backend` or equivalent) — do not restore into a database the
   application is actively writing to.
2. **Locate the dump**: `backups/<database>-<timestamp>-<commit>.sql.gz` on the deploy host,
   named for the commit that was about to deploy when it was taken.
3. **Restore side-by-side, not over the live database**: `gunzip`-pipe the dump into a freshly
   created `<database>_restore` database and run the row-count + `_prisma_migrations` spot check
   from `docs/deploy-rollback.md` § Restoring — never overwrite the live database as a first move.
4. **Decide, as a human, what "restored" means here** — this is where it rejoins §7 below:
   - If the bad migration was **additive**, you likely don't need the data restore at all; fix
     forward per §7.
   - If it was **contracting** and forward-fix is impossible, this is the "restore the
     pre-migration backup and replay from there" step §7 refers to: point the app at the restored
     database (rename/swap during an announced outage), then `checkout` the commit whose schema
     matches it and redeploy, per the rollback_ref flow in `docs/deploy-rollback.md`.
5. **Resume writes** only after the application is confirmed pointed at the correct database and
   schema/code are back in agreement.

**Status: written but unproven.** The dump is created and verified on every deploy; the restore
steps above have not been exercised against the real server (no SSH reaches it from where this
was written). Treat §6a as "ready to use, not yet battle-tested" until someone runs it for real —
the §6 drill above is the closest rehearsal available today, but it exercises the *mechanism*
(mysqldump → gunzip → mysql), not this exact restore-into-`_restore`-then-swap procedure.

## 7. "App rolled back but schema already changed" — recovery

The sharp edge. If a deploy migrated the DB, then the app is rolled back to an older commit:

- If the migration was **additive** → the old app ignores the new column/table; no action.
- If the migration was **contracting** → the old app will error against the new schema. Recovery:
  **fix forward** (re-deploy the newer, schema-compatible app) rather than roll the app back. Only
  if forward-fix is impossible, restore the pre-migration backup and replay from there — on
  production this is the automated STEP 5 dump, restored per §6a; against a rehearsal/anonymized
  copy it is the §6 drill.
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
- Exercising the **automated production restore** (§6a) against the real server at least once —
  currently written but unproven, same caveat as `docs/deploy-rollback.md`.
- Retiring the recovery scripts (§8) — needs prod-stability confirmation + a protected-file change.
