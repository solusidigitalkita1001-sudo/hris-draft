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
