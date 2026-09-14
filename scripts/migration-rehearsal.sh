#!/usr/bin/env bash
#
# Migration rehearsal (checklist #6) — deterministic, repeatable migration drill.
#
# Applies the full Prisma migration chain to the database at $DATABASE_URL, seeds
# synthetic multi-tenant data, and asserts post-migration health:
#   - the chain applies cleanly (prisma migrate deploy)
#   - schema matches the datamodel with no drift (prisma migrate diff)
#   - no scoped row is left with a NULL company_id after seed (backfill invariant)
#   - the tenant-critical tables / indexes created by recent migrations exist
#
# Usage (fresh throwaway DB — NEVER point at production):
#   DATABASE_URL='mysql://root:root@127.0.0.1:3306/hris_rehearsal' \
#   SHADOW_DATABASE_URL='mysql://root:root@127.0.0.1:3306/hris_rehearsal_shadow' \
#   bash scripts/migration-rehearsal.sh
#
# Exit code is non-zero on the first failed assertion.

set -Eeuo pipefail

cd "$(dirname "$0")/.."/backend

: "${DATABASE_URL:?set DATABASE_URL to a throwaway rehearsal database}"
SCHEMA="src/database/prisma/schema.prisma"

# Parse mysql connection params out of DATABASE_URL for the assertion queries.
proto_stripped="${DATABASE_URL#*://}"
creds="${proto_stripped%%@*}"
hostportdb="${proto_stripped#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
hostport="${hostportdb%%/*}"
DB_NAME="${hostportdb##*/}"; DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306

mysql_q() { mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -N -B "$DB_NAME" -e "$1"; }

log()  { printf '\n\033[1;36m➤ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✅ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m❌ %s\033[0m\n' "$*"; exit 1; }

log "STEP 1/4 — Apply full migration chain (prisma migrate deploy)"
npx prisma migrate deploy --schema="$SCHEMA"
ok "Migration chain applied"

log "STEP 2/4 — Drift check (schema datamodel vs migrations)"
if [ -n "${SHADOW_DATABASE_URL:-}" ]; then
  npx prisma migrate diff \
    --from-migrations src/database/prisma/migrations \
    --to-schema-datamodel "$SCHEMA" \
    --shadow-database-url "$SHADOW_DATABASE_URL" \
    --exit-code && ok "No drift" || fail "Schema drift detected (migrations do not reproduce the datamodel)"
else
  echo "SHADOW_DATABASE_URL not set — skipping drift check"
fi

log "STEP 3/4 — Seed synthetic multi-tenant data"
npm run prisma:seed
ok "Seed complete"

log "STEP 4/4 — Post-migration assertions"

# 4a. No scoped row left with a NULL company_id after seed+backfill.
CORE_SCOPED_TABLES="employees attendances leave_requests leave_balances payroll_runs payslips assets branches departments positions overtime_requests benefit_enrollments daily_activities audit_logs"
for t in $CORE_SCOPED_TABLES; do
  exists=$(mysql_q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$t';")
  [ "$exists" = "1" ] || fail "expected table '$t' is missing after migration"
  nulls=$(mysql_q "SELECT COUNT(*) FROM \`$t\` WHERE company_id IS NULL;")
  [ "$nulls" = "0" ] || fail "$t has $nulls row(s) with NULL company_id"
done
ok "No NULL company_id in core scoped tables"

# 4b. Tenant-critical tables / indexes from recent migrations exist.
assert_table() {
  local n; n=$(mysql_q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$1';")
  [ "$n" = "1" ] || fail "missing table: $1"
}
assert_index() {
  local n; n=$(mysql_q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='$DB_NAME' AND table_name='$1' AND index_name='$2';")
  [ "$n" -ge "1" ] || fail "missing index $2 on $1"
}
assert_table role_data_scopes
assert_table role_menu_accesses
assert_table branch_attendance_policies
assert_index branch_attendance_policies branch_attendance_policies_company_id_branch_id_key
ok "Tenant-critical tables and indexes present"

# 4c. No foreign-key is orphaned (MySQL enforces FKs, so a successful seed already
# proves referential integrity; report the FK count for the runbook record).
fk_count=$(mysql_q "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema='$DB_NAME' AND constraint_type='FOREIGN KEY';")
ok "Foreign keys present: $fk_count"

printf '\n\033[1;32m🎉 Migration rehearsal PASSED\033[0m\n'
