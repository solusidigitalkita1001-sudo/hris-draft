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
#   - Backup database sebelum perubahan skema
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
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
HTTPS_ENABLED="${HTTPS_ENABLED:-false}"
HTTPS_COMPOSE_FILE="${HTTPS_COMPOSE_FILE:-deploy/compose-https.override.yml}"
ENV_FILE="${ENV_FILE:-backend/.env}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-hris_backend}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

MAX_RETRY_WAIT_CONTAINER="${MAX_RETRY_WAIT_CONTAINER:-20}"
MAX_RETRY_WAIT_HEALTH="${MAX_RETRY_WAIT_HEALTH:-18}"

# Database backup before any schema change. Rollback of CODE exists
# (deploy.yml re-deploys the previous commit); rollback of DATA did not exist at
# all, so a migration that dropped or narrowed a column was unrecoverable.
DB_BACKUP_ENABLED="${DB_BACKUP_ENABLED:-true}"
DB_BACKUP_DIR="${DB_BACKUP_DIR:-$DEPLOY_DIR/backups}"
DB_BACKUP_KEEP="${DB_BACKUP_KEEP:-7}"
# The server is shared with other projects. Filling the disk would take them
# down too, so the dump refuses to start without room to land.
DB_BACKUP_MIN_FREE_MB="${DB_BACKUP_MIN_FREE_MB:-2048}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mysql-db}"

MIGRATION_SCHEMA="src/database/prisma/schema.prisma"

SPECIAL_MIGRATION="20260809120000_attendance_policy_company_default"
FACE_MATCH_MIGRATION="20260903090000_face_match_rate_limit_index"
FACE_MATCH_RECOVERY="$DEPLOY_DIR/scripts/migrations/recover-face-match-rate-limit-index.cjs"

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [ -n "$COMPOSE_ENV_FILE" ]; then
    COMPOSE_ARGS=(--env-file "$COMPOSE_ENV_FILE" "${COMPOSE_ARGS[@]}")
fi
if [ "$HTTPS_ENABLED" = "true" ]; then
    COMPOSE_ARGS+=( -f "$HTTPS_COMPOSE_FILE" )
fi

compose() {
    docker compose "${COMPOSE_ARGS[@]}" "$@"
}

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

recover_face_match_index() {
    docker exec -i "$BACKEND_CONTAINER" node - "$MIGRATION_SCHEMA" < "$FACE_MATCH_RECOVERY"
}

# =====================================================================
# DATABASE BACKUP
#
# Runs BEFORE the schema sanitizer, not merely before `migrate deploy`: the
# sanitizer in STEP 6 already issues DROP INDEX and MODIFY COLUMN, so a dump
# taken after it would not describe the database anybody would want back.
#
# Only this application's database is touched, by name, read from DATABASE_URL.
# mysql-db is shared with other projects, so nothing here writes to it and no
# other schema is named.
# =====================================================================

backup_database() {
    # Fail closed on a typo: an unrecognized value used to silently SKIP the
    # backup (treated as "not true"), so e.g. DB_BACKUP_ENABLED=flase would
    # quietly deploy with no dump instead of erroring. Only 'true'/'false' are
    # accepted now; anything else aborts the deploy before it can guess wrong.
    case "$DB_BACKUP_ENABLED" in
        true) ;;
        false)
            warn "DB_BACKUP_ENABLED=false — melewati backup database"
            return 0
            ;;
        *)
            error_message "DB_BACKUP_ENABLED='$DB_BACKUP_ENABLED' tidak valid (harus 'true' atau 'false'); migrasi dibatalkan sebelum menyentuh skema."
            return 1
            ;;
    esac

    # A non-numeric or zero DB_BACKUP_KEEP would otherwise either blow up the
    # retention arithmetic below or, with 0, delete the dump just taken on the
    # same run that created it (tail -n "+1" selects everything).
    case "$DB_BACKUP_KEEP" in
        '' | *[!0-9]*)
            warn "DB_BACKUP_KEEP='$DB_BACKUP_KEEP' tidak valid (harus bilangan >= 1); memakai default 7."
            DB_BACKUP_KEEP=7
            ;;
        0)
            warn "DB_BACKUP_KEEP=0 akan menghapus dump yang baru dibuat; dipaksa ke minimum 1."
            DB_BACKUP_KEEP=1
            ;;
    esac

    if ! docker exec "$MYSQL_CONTAINER" sh -c 'command -v mysqldump' >/dev/null 2>&1; then
        error_message "mysqldump tidak tersedia di container $MYSQL_CONTAINER; backup tidak bisa dibuat."
        return 1
    fi

    mkdir -p "$DB_BACKUP_DIR"

    # Refuse rather than fill a shared disk. NOTE: this preflights
    # DB_BACKUP_DIR only, not /tmp — which is why the credential file below is
    # created inside DB_BACKUP_DIR rather than a bare `mktemp`.
    local free_mb
    free_mb="$(df -Pm "$DB_BACKUP_DIR" | awk 'NR==2 {print $4}')"
    if [ -z "$free_mb" ]; then
        error_message "Tidak bisa membaca sisa kapasitas disk untuk $DB_BACKUP_DIR."
        return 1
    fi
    if [ "$free_mb" -lt "$DB_BACKUP_MIN_FREE_MB" ]; then
        error_message "Sisa disk ${free_mb}MB di bawah batas ${DB_BACKUP_MIN_FREE_MB}MB; backup dibatalkan sebelum migrasi."
        return 1
    fi

    # Credentials are read inside the container and never printed. Tab-separated
    # so a password containing spaces survives, and percent-decoded because a
    # DATABASE_URL encodes reserved characters.
    local creds
    creds="$(
        docker exec "$BACKEND_CONTAINER" node -e '
            const url = new URL(process.env.DATABASE_URL);
            const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
            if (!database) { process.stderr.write("DATABASE_URL has no database name\n"); process.exit(1); }
            process.stdout.write([
                decodeURIComponent(url.username),
                decodeURIComponent(url.password),
                database,
            ].join("\t"));
        '
    )" || {
        error_message "Gagal membaca DATABASE_URL dari container."
        return 1
    }

    local db_user db_pass db_name
    db_user="$(printf '%s' "$creds" | cut -f1)"
    db_pass="$(printf '%s' "$creds" | cut -f2)"
    db_name="$(printf '%s' "$creds" | cut -f3)"

    if [ -z "$db_name" ] || [ -z "$db_user" ]; then
        error_message "DATABASE_URL tidak lengkap; backup dibatalkan."
        return 1
    fi

    local stamp target
    stamp="$(date '+%Y%m%d-%H%M%S')"
    target="$DB_BACKUP_DIR/${db_name}-${stamp}-${DEPLOY_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}.sql.gz"

    log "Dumping database $db_name sebelum perubahan skema"

    # The password must not appear as a command argument anywhere it can be
    # read from a process list. `docker exec -e MYSQL_PWD=...` still puts the
    # secret in THIS HOST's `ps auxww` output for the `docker exec` process
    # itself (verified: the container-internal mysqldump process list is clean,
    # but the host, shared with four other projects, is not) — so the password
    # goes into a mode-600 file instead, read via `docker exec --env-file`, and
    # only its path reaches argv. Written inside DB_BACKUP_DIR (preflighted for
    # space above), not a bare `mktemp` under /tmp, which has no such check. A
    # stale file left by a previously killed run is swept first.
    rm -f "$DB_BACKUP_DIR"/.db-backup-pwd.*
    local pwd_file
    pwd_file="$(mktemp "$DB_BACKUP_DIR/.db-backup-pwd.XXXXXX")"
    chmod 600 "$pwd_file"
    printf 'MYSQL_PWD=%s\n' "$db_pass" > "$pwd_file"
    # Belt, not the guarantee — verified empirically that a RETURN trap does
    # NOT fire when a failing command further down is turned into `exit` by
    # the global ERR trap (errexit unwinding a nested function call skips
    # pending RETURN traps), nor on an external SIGTERM (e.g. the deploy
    # workflow's 35-minute command_timeout). The real guarantee is the
    # explicit `rm -f "$pwd_file"` right after dump_to's last use below, done
    # before the retention/prune code that follows — DB_BACKUP_KEEP arithmetic
    # and the prune loop's `rm` are exactly where those abort paths live, and
    # by then the password is no longer needed. TERM is trapped too, as a
    # best-effort second line of defense for a signal landing mid-dump; both
    # traps are cleared the moment the password file is gone.
    trap 'rm -f "$pwd_file"' RETURN
    trap 'rm -f "$pwd_file"; exit 143' TERM

    # --no-tablespaces: MySQL 8's --single-transaction otherwise also tries to
    # lock tablespaces, which hard-fails without the PROCESS privilege
    # app_user may not have — same privilege class as --routines/--triggers
    # below, but this one has no fallback form, so it must never be attempted.
    dump_to() {
        local err_file rc
        err_file="$(mktemp)"
        if docker exec -i --env-file "$pwd_file" "$MYSQL_CONTAINER" \
            mysqldump --user="$db_user" --single-transaction --quick --no-tablespaces \
                --default-character-set=utf8mb4 "$@" "$db_name" \
            2>"$err_file" | gzip -c > "$target"
        then
            rc=0
        else
            rc=$?
        fi
        cat "$err_file" >&2
        if [ "$rc" -eq 0 ]; then
            rm -f "$err_file"
            return 0
        fi
        # Only a grant problem is eligible for the no-routines/triggers retry
        # below; any other failure (network, disk, OOM, …) must fail the
        # deploy outright instead of quietly trying a different flag combo.
        if grep -Eqi 'access denied|process privilege' "$err_file"; then
            rm -f "$err_file"
            return 2
        fi
        rm -f "$err_file"
        return 1
    }

    # Routines and triggers need privileges beyond the table rights this user
    # certainly has. Attempted first, because a restore silently missing them
    # is a nasty surprise; but a user without those grants must not be the
    # reason a deploy cannot happen at all, so the plain dump is the fallback
    # — and only for that specific reason (see dump_to's grant check above).
    local dump_failed=0
    if dump_to --routines --triggers; then
        :
    else
        local rc=$?
        if [ "$rc" -eq 2 ]; then
            warn "mysqldump dengan --routines/--triggers gagal karena hak akses; mencoba tanpa keduanya."
            if dump_to; then
                warn "Backup tidak menyertakan stored routine dan trigger (hak akses kurang)."
            else
                dump_failed=1
            fi
        else
            warn "mysqldump gagal karena alasan selain hak akses; tidak mencoba ulang dengan opsi lain."
            dump_failed=1
        fi
    fi

    # pwd_file's job ends here — unlink now, before any of the code below that
    # can abort in ways the traps above do not catch (see the comment where
    # the traps were set).
    rm -f "$pwd_file"
    trap - RETURN
    trap - TERM

    if [ "$dump_failed" -ne 0 ]; then
        error_message "mysqldump gagal; migrasi dibatalkan sebelum menyentuh skema."
        rm -f "$target"
        return 1
    fi

    # A truncated dump is the dangerous failure: it restores cleanly and is
    # missing rows. mysqldump writes its trailer only after finishing, so the
    # trailer is the proof the dump is whole. Checked on an empty database too.
    if ! gzip -t "$target" 2>/dev/null; then
        error_message "Dump tidak lolos uji integritas gzip; migrasi dibatalkan."
        rm -f "$target"
        return 1
    fi
    if ! gzip -dc "$target" | tail -c 2048 | grep -q 'Dump completed'; then
        error_message "Dump terpotong (tidak ada penanda 'Dump completed'); migrasi dibatalkan."
        rm -f "$target"
        return 1
    fi

    ok "Backup database tersimpan: $target ($(du -h "$target" | cut -f1))"

    # Retention, newest kept. The glob names this database only, so nothing
    # belonging to another project can be removed. A plain loop on purpose:
    # this deletes files, and it should be obvious what it deletes.
    local removed=0 stale
    while IFS= read -r stale; do
        [ -n "$stale" ] || continue
        rm -f "$stale"
        removed=$((removed + 1))
    done <<EOF
$(ls -1t "$DB_BACKUP_DIR/${db_name}"-*.sql.gz 2>/dev/null | tail -n "+$((DB_BACKUP_KEEP + 1))")
EOF
    if [ "$removed" -gt 0 ]; then
        echo "Menghapus $removed backup lama (menyimpan $DB_BACKUP_KEEP terbaru)"
    fi
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
    compose ps 2>/dev/null || true

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
echo "HTTPS enabled : $HTTPS_ENABLED"
echo "Backend       : $BACKEND_CONTAINER"
echo "Started       : $(date '+%Y-%m-%d %H:%M:%S')"
echo "Commit        : ${DEPLOY_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"

# =====================================================================
# STEP 1 — VALIDATION
# =====================================================================

log "STEP 1/9: Validate deployment environment"

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

if [ -n "$COMPOSE_ENV_FILE" ] && [ ! -f "$COMPOSE_ENV_FILE" ]; then
    error_message "Compose env file tidak ditemukan: $COMPOSE_ENV_FILE"
    exit 1
fi

if [ "$HTTPS_ENABLED" = "true" ] && [ ! -f "$HTTPS_COMPOSE_FILE" ]; then
    error_message "HTTPS compose override tidak ditemukan: $HTTPS_COMPOSE_FILE"
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

if [ ! -f "$FACE_MATCH_RECOVERY" ]; then
    error_message "Migration recovery script tidak ditemukan: $FACE_MATCH_RECOVERY"
    exit 1
fi

compose config --quiet

ok "Deployment environment valid"

# =====================================================================
# STEP 2 — DOCKER BUILD + START
# =====================================================================

log "STEP 2/9: Docker compose build"

compose build

log "Starting Docker services"

compose up \
    -d \
    --remove-orphans

compose ps

# =====================================================================
# STEP 3 — WAIT BACKEND CONTAINER
# =====================================================================

log "STEP 3/9: Waiting for $BACKEND_CONTAINER"

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

log "STEP 4/9: Test mysql-db:3306 connectivity"

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
# STEP 5 — DATABASE BACKUP
# =====================================================================

log "STEP 5/9: Backup database before schema changes"

backup_database

# =====================================================================
# STEP 6 — SPECIAL MIGRATION RECOVERY
#
# TODO:
# Hapus section ini setelah production database stabil dan migration
# 20260809120000_attendance_policy_company_default sudah confirmed applied.
# =====================================================================

log "STEP 6/9: Check special migration recovery"

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

# Recover a known failed single-index migration before Prisma's P3009 guard.
# This checks the real index and preserves history using migrate resolve.
log "Check failed face-match rate-limit index migration"
recover_face_match_index

# =====================================================================
# STEP 7 — PRISMA MIGRATION
# =====================================================================

log "STEP 7/9: Prisma migrate deploy"

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

    if grep -Fq "$FACE_MATCH_MIGRATION" "$MIGRATE_LOG" && grep -Eq 'P3009|P3018' "$MIGRATE_LOG"; then

        # A first attempt can fail with P3018 when the index was installed by
        # an earlier hotfix. Verify it before resolving and retry only once.
        warn "Detected failed face-match index migration: $FACE_MATCH_MIGRATION"
        recover_face_match_index

        log "Retry Prisma migrate deploy after verified index recovery"
        docker exec -i "$BACKEND_CONTAINER" \
            npx prisma migrate deploy \
            --schema="$MIGRATION_SCHEMA"

        ok "Face-match index migration recovered"

    elif grep -q "$SPECIAL_MIGRATION" "$MIGRATE_LOG"; then

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
# STEP 8 — BACKEND HEALTH CHECK
# =====================================================================

log "STEP 8/9: Backend health check"

COUNT=0

while true; do

    if docker exec -i "$BACKEND_CONTAINER" node - <<NODEEOF
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
# STEP 9 — CLEANUP
# =====================================================================

log "STEP 9/9: Docker cleanup"

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
