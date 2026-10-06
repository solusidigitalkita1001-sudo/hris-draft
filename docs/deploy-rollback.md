# Deploy rollback (Sprint 1 · item #2)

The production deploy (`.github/workflows/deploy.yml`) SSHes to the server, resets the
repo to the target commit, and runs `scripts/server-deploy.sh` (build → migrate →
health check). Two rollback paths exist.

## Automatic rollback on a failed deploy

If `server-deploy.sh` exits non-zero (build error, migration failure, or the backend
never becomes healthy), the workflow automatically:

1. `git reset --hard` back to `PREVIOUS_COMMIT` (the commit that was live before this deploy),
2. restores `backend/.env`,
3. re-runs `server-deploy.sh` to rebuild and restart the **last known-good code**.

The workflow **still exits 1** afterwards, so a failed deploy always shows red in
Actions even when the rollback succeeded — that is your signal to investigate.

Auto-rollback is skipped when there is no distinct previous commit, or when the run is
itself a manual rollback (see below).

### Important: code only, not the database

Rollback restores **application code**, not schema. Prisma migrations applied by the
failed deploy are **not** reverted (Prisma has no automatic down-migrations here). This
is safe only when migrations are **backward-compatible** with the previous code —
follow expand/contract:

- **Expand** first (add nullable column / new table) in one release, deploy, backfill.
- **Contract** (drop/rename/enforce NOT NULL) only in a *later* release, once no running
  code depends on the old shape.

A migration that drops or renames a column in the same release as the code change cannot
be safely auto-rolled-back; treat those as forward-only and fix forward.

## Manual rollback to a specific commit or tag

Actions → **🚀 Deploy HRIS** → **Run workflow** → set **`rollback_ref`** to the commit
SHA or tag you want live, then run. The server checks out that ref and deploys it.

```bash
# CLI equivalent
gh workflow run "🚀 Deploy HRIS" -f rollback_ref=<commit-sha-or-tag>
```

Pick a `rollback_ref` whose schema expectations match the **current** database. Because
the DB is only ever migrated forward, rolling code back past a contracting migration will
break — roll back only to commits whose code is compatible with today's schema.

A manual rollback does **not** trigger the automatic rollback path: if the chosen ref also
fails to deploy, the workflow reports the failure and leaves the server as-is for manual
intervention.

## Database rollback

Code rollback above never touches data. The only thing that can undo a destructive
migration is a dump taken before it ran, so `scripts/server-deploy.sh` takes one in
STEP 5 — **before** the schema sanitizer in STEP 6, which itself issues `DROP INDEX`
and `MODIFY COLUMN`. The deploy aborts before any schema change if the dump cannot be
written, fails its gzip integrity check, or lacks mysqldump's `Dump completed`
trailer — a dump that restores cleanly while missing rows is the failure worth
preventing.

Dumps land in `backups/` inside the deploy directory, named
`<database>-<timestamp>-<commit>.sql.gz`, newest seven kept. They hold live employee
and payroll data: `backups/` is git-ignored and the directory should be treated as
confidential as `backend/.env`.

Knobs, all environment variables read by the script:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_BACKUP_ENABLED` | `true` | Set to anything else to skip the dump. The deploy warns rather than failing. |
| `DB_BACKUP_DIR` | `<deploy dir>/backups` | Where dumps are written. |
| `DB_BACKUP_KEEP` | `7` | How many of this database's dumps to keep. |
| `DB_BACKUP_MIN_FREE_MB` | `2048` | The deploy aborts rather than filling a disk shared with other projects. |
| `MYSQL_CONTAINER` | `mysql-db` | Where `mysqldump` runs. Only this application's database is named. |

### Restoring

Restore into a **new** database first and look at it. Never restore over the live one as
a first move — if the dump turns out to be the problem, overwriting is unrecoverable.

```bash
cd /root/projects/dev/hris-draft
DUMP=backups/<database>-<timestamp>-<commit>.sql.gz

# 1. Credentials, without printing them.
read -r DB_USER DB_PASS DB_NAME <<<"$(docker exec hris_backend node -e '
  const u = new URL(process.env.DATABASE_URL);
  console.log(decodeURIComponent(u.username), decodeURIComponent(u.password),
              decodeURIComponent(u.pathname.slice(1)));')"

# 2. Side-by-side restore.
docker exec -i -e MYSQL_PWD="$DB_PASS" mysql-db   mysql --user="$DB_USER" -e "CREATE DATABASE \`${DB_NAME}_restore\`"
gzip -dc "$DUMP" | docker exec -i -e MYSQL_PWD="$DB_PASS" mysql-db   mysql --user="$DB_USER" "${DB_NAME}_restore"

# 3. Prove it is the data you want BEFORE deciding anything.
docker exec -i -e MYSQL_PWD="$DB_PASS" mysql-db   mysql --user="$DB_USER" "${DB_NAME}_restore" -e   "SELECT COUNT(*) employees FROM employees;
   SELECT COUNT(*) payslips FROM payslips;
   SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

Then either point the application at the restored database, or swap the names during an
announced outage. Both are decisions for a human; neither is automated, deliberately.

### The drill is still outstanding

None of the above has been exercised against this server. `docs/migration-runbook.md` §6
describes the drill; until somebody runs it, treat database rollback as **written but
unproven** — the dump is created and verified complete on every deploy, but no restore
has been performed here.
