#!/usr/bin/env bash

set -Eeuo pipefail

# =====================================================================
# SERVER AUTO-DEPLOY SCRIPT — HRIS
#
# Tanggung jawab:
#   - Validasi environment
#   - Docker build/start
#   - Container readiness
#   - Database connectivity
#   - Recovery migration khusus sementara
#   - Prisma migrate deploy
#   - Backend health check
#   - Docker cleanup
#
# CATATAN:
# Git fetch/reset TIDAK dilakukan di script ini.
# Git sync dilakukan dari GitHub Actions sebelum script ini dijalankan.
# =====================================================================

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-backend/.env}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-hris_backend}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

MAX_RETRY_WAIT_CONTAINER="${MAX_RETRY_WAIT_CONTAINER:-20}"
MAX_RETRY_WAIT_HEALTH="${MAX_RETRY_WAIT_HEALTH:-18}"

MIGRATION_SCHEMA="src/database/prisma/schema.prisma"

SPECIAL_MIGRATION="20260809120000_attendance_policy_company_default"

# =====================================================================
# LOGGING
# =====================================================================

log() {
    printf "\n\033[1;36m➤ %s\033[0m\n" "$*"
}

ok() {
    printf "\033[1;32m✅ %s\033[0m\n" "$*"
}

warn() {
    printf "\033[1;33m⚠️  %s\033[0m\n" "$*"
}

error_message() {
    printf "\033[1;31m❌ %s\033[0m\n" "$*"
}

cd "$DEPLOY_DIR"

# =====================================================================
# ERROR HANDLER
# =====================================================================

on_error() {
    EXIT_CODE=$?

    echo ""
    echo "============================================================"
    echo "❌ HRIS DEPLOYMENT FAILED"
    echo "============================================================"

    echo "Exit code : $EXIT_CODE"
    echo "Commit    : ${DEPLOY_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"

    echo ""
    echo "🐳 Docker Compose status:"
    docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || true

    echo ""
    echo "📋 Backend logs:"
    docker logs "$BACKEND_CONTAINER" --tail=100 2>&1 || true

    echo ""

    exit "$EXIT_CODE"
}

trap on_error ERR

# =====================================================================
# DEPLOYMENT LOCK
# =====================================================================

exec 9>/tmp/hris-production-deploy.lock

if ! flock -n 9; then
    error_message "Deployment HRIS lain sedang berjalan."
    exit 1
fi

# =====================================================================
# START
# =====================================================================

log "HRIS deployment started"

echo "Deploy dir    : $DEPLOY_DIR"
echo "Compose file  : $COMPOSE_FILE"
echo "Backend       : $BACKEND_CONTAINER"
echo "Started       : $(date '+%Y-%m-%d %H:%M:%S')"
echo "Commit        : ${DEPLOY_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"

# =====================================================================
# STEP 1 — VALIDATION
# =====================================================================

log "STEP 1/8: Validate deployment environment"

if ! command -v docker >/dev/null 2>&1; then
    error_message "Docker tidak ditemukan."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    error_message "Docker Compose plugin tidak tersedia."
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    error_message "Compose file tidak ditemukan: $COMPOSE_FILE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    error_message "$ENV_FILE tidak ditemukan."
    exit 1
fi

if ! grep -qE '^DATABASE_URL=' "$ENV_FILE"; then
    error_message "DATABASE_URL missing di $ENV_FILE."
    exit 1
fi

if [ ! -f "backend/$MIGRATION_SCHEMA" ]; then
    error_message "Prisma schema tidak ditemukan: backend/$MIGRATION_SCHEMA"
    exit 1
fi

docker compose -f "$COMPOSE_FILE" config --quiet

ok "Deployment environment valid"

# =====================================================================
# STEP 2 — DOCKER BUILD + START
# =====================================================================

log "STEP 2/8: Docker compose build"

docker compose \
    -f "$COMPOSE_FILE" \
    build

log "Starting Docker services"

docker compose \
    -f "$COMPOSE_FILE" \
    up \
    -d \
    --remove-orphans

docker compose -f "$COMPOSE_FILE" ps

# =====================================================================
# STEP 3 — WAIT BACKEND CONTAINER
# =====================================================================

log "STEP 3/8: Waiting for $BACKEND_CONTAINER"

COUNT=0

while true; do

    STATUS="$(
        docker inspect \
            --format '{{.State.Status}}' \
            "$BACKEND_CONTAINER" 2>/dev/null \
            || echo "missing"
    )"

    echo "Backend status: $STATUS"

    if [ "$STATUS" = "running" ]; then
        break
    fi

    if [ "$STATUS" = "exited" ] || [ "$STATUS" = "dead" ]; then
        error_message "$BACKEND_CONTAINER berhenti saat startup."
        docker logs "$BACKEND_CONTAINER" --tail=100 || true
        exit 1
    fi

    COUNT=$((COUNT + 1))

    if [ "$COUNT" -ge "$MAX_RETRY_WAIT_CONTAINER" ]; then
        error_message "Timeout menunggu $BACKEND_CONTAINER."
        exit 1
    fi

    sleep 3

done

ok "$BACKEND_CONTAINER running"

# =====================================================================
# DATABASE_URL CHECK
# =====================================================================

DB_URL="$(
    docker exec "$BACKEND_CONTAINER" \
        printenv DATABASE_URL 2>/dev/null \
        || true
)"

if [ -z "$DB_URL" ]; then
    error_message "DATABASE_URL tidak tersedia di dalam container."
    exit 1
fi

# Jangan echo DATABASE_URL karena mengandung credential database.

ok "DATABASE_URL tersedia di container"

# =====================================================================
# STEP 4 — MYSQL CONNECTIVITY
# =====================================================================

log "STEP 4/8: Test mysql-db:3306 connectivity"

docker exec -i "$BACKEND_CONTAINER" node - <<'NODEEOF'
const net = require('net');

const socket = net.connect(
    {
        host: 'mysql-db',
        port: 3306,
        timeout: 10000
    },
    () => {
        console.log('✅ mysql-db:3306 reachable');
        socket.destroy();
        process.exit(0);
    }
);

socket.on('error', (error) => {
    console.error(
        '❌ mysql-db unreachable:',
        error.message
    );

    process.exit(1);
});

socket.on('timeout', () => {
    console.error('❌ MySQL connection timeout');
    socket.destroy();
    process.exit(1);
});
NODEEOF

ok "MySQL reachable"

# =====================================================================
# STEP 5 — SPECIAL MIGRATION RECOVERY
#
# TODO:
# Hapus section ini setelah production database stabil dan migration
# 20260809120000_attendance_policy_company_default sudah confirmed applied.
# =====================================================================

log "STEP 5/8: Check special migration recovery"

docker exec -i "$BACKEND_CONTAINER" \
    npx prisma db execute \
    --schema="$MIGRATION_SCHEMA" \
    --stdin >/dev/null <<'EOSQL'

DELETE FROM `_prisma_migrations`
WHERE migration_name = '20260809120000_attendance_policy_company_default'
AND (
    rolled_back_at IS NOT NULL
    OR finished_at IS NULL
    OR checksum IS NULL
);

SET @table_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'branch_attendance_policies'
);

SET @noop = 'SELECT 1 AS skip_branch_attendance_sanitizer';

-- ----------------------------------------------------------
-- A. Ensure replacement branch_id index exists
-- ----------------------------------------------------------

SET @sql = IF(
    @table_exists = 0,
    @noop,
    IFNULL(
        (
            SELECT CONCAT(
                'CREATE INDEX `branch_attendance_policies_branch_id_idx` ',
                'ON `branch_attendance_policies` (`branch_id`)'
            )
            FROM DUAL
            WHERE 0 = (
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'branch_attendance_policies'
                  AND INDEX_NAME = 'branch_attendance_policies_branch_id_idx'
            )
        ),
        @noop
    )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------
-- B. Drop old unique branch_id index
-- ----------------------------------------------------------

SET @sql = IF(
    @table_exists = 0,
    @noop,
    IFNULL(
        (
            SELECT CONCAT(
                'ALTER TABLE `branch_attendance_policies` ',
                'DROP INDEX `branch_attendance_policies_branch_id_key`'
            )
            FROM DUAL
            WHERE 0 < (
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'branch_attendance_policies'
                  AND INDEX_NAME = 'branch_attendance_policies_branch_id_key'
            )
        ),
        @noop
    )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------
-- C. branch_id nullable
-- ----------------------------------------------------------

SET @sql = IF(
    @table_exists = 0,
    @noop,
    IFNULL(
        (
            SELECT CONCAT(
                'ALTER TABLE `branch_attendance_policies` ',
                'MODIFY COLUMN `branch_id` VARCHAR(36) NULL'
            )
            FROM DUAL
            WHERE 'NO' = (
                SELECT IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'branch_attendance_policies'
                  AND COLUMN_NAME = 'branch_id'
            )
        ),
        @noop
    )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------
-- D. compound unique company_id + branch_id
-- ----------------------------------------------------------

SET @sql = IF(
    @table_exists = 0,
    @noop,
    IFNULL(
        (
            SELECT CONCAT(
                'ALTER TABLE `branch_attendance_policies` ',
                'ADD UNIQUE INDEX ',
                '`branch_attendance_policies_company_id_branch_id_key` ',
                '(`company_id`, `branch_id`)'
            )
            FROM DUAL
            WHERE 0 = (
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'branch_attendance_policies'
                  AND INDEX_NAME = 'branch_attendance_policies_company_id_branch_id_key'
            )
        ),
        @noop
    )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

EOSQL

ok "Special migration sanitizer complete"

# =====================================================================
# STEP 6 — PRISMA MIGRATION
# =====================================================================

log "STEP 6/8: Prisma migrate deploy"

MIGRATE_LOG="$(mktemp)"

cleanup_migration_log() {
    rm -f "$MIGRATE_LOG"
}

trap cleanup_migration_log EXIT

if docker exec -i "$BACKEND_CONTAINER" \
    npx prisma migrate deploy \
    --schema="$MIGRATION_SCHEMA" \
    >"$MIGRATE_LOG" 2>&1
then

    cat "$MIGRATE_LOG"

    ok "Prisma migrate deploy success"

else

    cat "$MIGRATE_LOG"

    warn "Prisma migrate deploy gagal."

    if grep -q "$SPECIAL_MIGRATION" "$MIGRATE_LOG"; then

        warn "Detected failed special migration: $SPECIAL_MIGRATION"

        docker exec -i "$BACKEND_CONTAINER" \
            npx prisma migrate resolve \
            --applied "$SPECIAL_MIGRATION" \
            --schema="$MIGRATION_SCHEMA"

        log "Retry Prisma migrate deploy"

        docker exec -i "$BACKEND_CONTAINER" \
            npx prisma migrate deploy \
            --schema="$MIGRATION_SCHEMA"

        ok "Prisma migration recovered"

    else

        error_message "Prisma migration gagal dan bukan migration recovery yang dikenal."
        exit 1

    fi

fi

# =====================================================================
# STEP 7 — BACKEND HEALTH CHECK
# =====================================================================

log "STEP 7/8: Backend health check"

COUNT=0

while true; do

    if docker exec "$BACKEND_CONTAINER" node - <<NODEEOF
const http = require('http');

const request = http.get(
    'http://127.0.0.1:${BACKEND_PORT}/health',
    {
        timeout: 5000
    },
    response => {

        response.resume();

        if (
            response.statusCode >= 200 &&
            response.statusCode < 300
        ) {
            console.log(
                '✅ Health HTTP',
                response.statusCode
            );

            process.exit(0);
        }

        console.error(
            '❌ Health HTTP',
            response.statusCode
        );

        process.exit(1);
    }
);

request.on('timeout', () => {
    request.destroy();
    process.exit(1);
});

request.on('error', (error) => {
    console.error(
        '❌ Health request error:',
        error.message
    );

    process.exit(1);
});
NODEEOF

    then
        break
    fi

    COUNT=$((COUNT + 1))

    echo "⏳ Backend belum healthy ($COUNT/$MAX_RETRY_WAIT_HEALTH)"

    if [ "$COUNT" -ge "$MAX_RETRY_WAIT_HEALTH" ]; then

        error_message "Backend health check timeout."

        docker logs \
            "$BACKEND_CONTAINER" \
            --tail=100 || true

        exit 1

    fi

    sleep 5

done

ok "Backend healthy"

# =====================================================================
# STEP 8 — CLEANUP
# =====================================================================

log "STEP 8/8: Docker cleanup"

docker image prune \
    -f \
    --filter "until=24h" \
    >/dev/null 2>&1 \
    || true

ok "Docker image prune done"

# =====================================================================
# SUCCESS
# =====================================================================

echo ""
echo "============================================================"
echo "🎉 HRIS AUTO-DEPLOY SUCCESS"
echo "============================================================"
echo "Finished : $(date '+%Y-%m-%d %H:%M:%S')"
echo "Commit   : $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "============================================================"
echo ""
