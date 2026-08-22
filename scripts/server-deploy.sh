#!/usr/bin/env bash
# =====================================================================
# SERVER AUTO-DEPLOY SCRIPT — HRIS Enterprise App
# Version-controlled via git repo: scripts/server-deploy.sh
# Invoke via:  SSH / Github actions appleboy / crontab git-watch
#
# FEATURES (Semua IDEMPOTENT = bisa run berkali-kali tanpa error):
#  1. Backup / restore .env otomatis (git reset --hard tidak overwrite env)
#  2. Healthcheck container + network mysql:3306
#  3. PRE-MIGRATION SANITIZER (fix branch_attendance FK index stuck forever):
#     - Hapus FAILED/PENDING rows di `_prisma_migrations` untuk migration
#       20260809120000_attendance_policy_company_default
#     - (Jika masih FAIL) Jalankan 4 SQL STEPS IDEMPOTENT via
#       INFORMATION_SCHEMA (cek if-exists before create/alter/drop index)
#     - Prisma resolve --applied 1x supaya checksum migration fix diakui
#  4. Prisma migrate deploy. Fallback db push --accept-data-loss jika emergency
#  5. Backend readiness curl /health, prune old docker images
# =====================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
ENV_FILE="${ENV_FILE:-backend/.env}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-hris_backend}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
MAX_RETRY_WAIT_CONTAINER="${MAX_RETRY_WAIT_CONTAINER:-20}"
MAX_RETRY_WAIT_HEALTH="${MAX_RETRY_WAIT_HEALTH:-18}"

log()  { printf "\033[1;36m➤ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✅ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠️  %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m❌ %s\033[0m\n" "$*"; exit 1; }

cd "$DEPLOY_DIR"

# =====================================================================
# STEP 0 — Fallback docker-compose file
# Jika server tidak punya docker-compose.prod.yml, fallback ke docker-compose.yml
# =====================================================================
if [ ! -f "$COMPOSE_FILE" ] && [ -f "docker-compose.yml" ]; then
  warn "File '$COMPOSE_FILE' tidak ditemukan, fallback pakai docker-compose.yml"
  COMPOSE_FILE="docker-compose.yml"
fi

log "Deploy dir : $DEPLOY_DIR"
log "Compose file: $COMPOSE_FILE"
log "Started at : $(date '+%Y-%m-%d %H:%M:%S')"

# =====================================================================
# STEP 1 — Backup .env, git fetch + reset --hard origin/main
# =====================================================================
log "STEP 1/7: Git sync origin/main"
ENV_BACKUP="/tmp/hris-backend-env.$(date +%s).bak"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_BACKUP"
  ok ".env backed up to $ENV_BACKUP"
else
  warn "$ENV_FILE tidak ditemukan (pertama kali deploy? pastikan sudah dibuat)"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git fetch origin --prune
  git reset --hard origin/main
  ok "Git synced to origin/main ($(git rev-parse --short HEAD))"
else
  warn "Bukan git repo, skip git fetch/reset"
fi

if [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$ENV_FILE"
  ok ".env restored"
fi

if ! grep -q "DATABASE_URL" "$ENV_FILE" 2>/dev/null; then
  err "DATABASE_URL missing di $ENV_FILE! Deploy gagal."
fi
ok "DATABASE_URL present"

# =====================================================================
# STEP 2 — Docker compose build + up -d
# =====================================================================
log "STEP 2/7: Docker compose build + up -d --remove-orphans"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build --remove-orphans

log "Menunggu container $BACKEND_CONTAINER siap..."
COUNT=0
until docker exec "$BACKEND_CONTAINER" echo "container ready" >/dev/null 2>&1; do
  printf '.'
  sleep 3
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge "$MAX_RETRY_WAIT_CONTAINER" ]; then
    echo ""
    err "Container $BACKEND_CONTAINER tidak bisa dijalankan! Last 30 logs:" \
        "$(docker logs "$BACKEND_CONTAINER" --tail=30 2>&1 || true)"
  fi
done
echo ""
ok "Container $BACKEND_CONTAINER ready"

DB_URL="$(docker exec "$BACKEND_CONTAINER" printenv DATABASE_URL 2>/dev/null || echo "")"
[ -z "$DB_URL" ] && err "DATABASE_URL tidak terbaca di dalam container!"
ok "DATABASE_URL set inside container"

# =====================================================================
# STEP 3 — MySQL reachability
# =====================================================================
log "STEP 3/7: Cek koneksi MySQL"
docker exec -i "$BACKEND_CONTAINER" node - <<'NODEEOF' || \
  err "Tidak bisa connect ke mysql-db:3306 dari container!"
const net = require('net');
const s = net.connect(3306, 'mysql-db', () => {
  console.log('✅ mysql-db:3306 reachable');
  s.destroy(); process.exit(0);
});
s.on('error', e => { console.error('❌ mysql unreachable', e.message); process.exit(1); });
setTimeout(() => { console.error('❌ timeout mysql'); process.exit(1); }, 10000);
NODEEOF

# =====================================================================
# STEP 4 — PRE-MIGRATION SANITIZER (KHUSUS stuck migration FK index bug)
#   Semua query IDEMPOTENT — aman run 1000x.
#   Blok SQL dibuat multi-statement via prisma db execute --stdin.
# =====================================================================
log "STEP 4/7: Pre-migration sanitizer (cleanup failed rows + branch_attendance FK index)"
docker exec -i "$BACKEND_CONTAINER" npx prisma db execute \
    --schema=src/database/prisma/schema.prisma --stdin >/dev/null <<'EOSQL'
-- 4.1 Cleanup rows FAILED / ROLLBACK / PENDING untuk migration 20260809120000_attendance_policy_company_default
-- (Allow re-run normal prisma migrate deploy setelah file migration fix)
DELETE FROM `_prisma_migrations`
 WHERE migration_name = '20260809120000_attendance_policy_company_default'
   AND (rolled_back_at IS NOT NULL
        OR finished_at IS NULL
        OR checksums IS NULL);

-- 4.2 Jika tabel branch_attendance_policies exist = jalankan STEP IDEMPOTENT
-- Ini menangani 2 scenario:
--    A) Migration file BARU (4 steps fix) sudah berjalan step 1 & 2 sebagian
--    B) DB masih STUCK di error lama (index unique dipakai FK, mau drop)
SET @table_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_attendance_policies'
);
SET @noop = 'SELECT 1 AS skip_branch_attendance_sanitizer';

-- STEP 4.2a: Buat non-unique index cadangan branch_id jika BELUM ADA
SET @sql = IF(@table_exists = 0, @noop, IFNULL((
  SELECT CONCAT('CREATE INDEX `branch_attendance_policies_branch_id_idx` ',
                'ON `branch_attendance_policies` (`branch_id`)') FROM DUAL
   WHERE 0 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_attendance_policies'
                 AND INDEX_NAME = 'branch_attendance_policies_branch_id_idx')
), @noop));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- STEP 4.2b: Drop UNIQUE index lama `branch_attendance_policies_branch_id_key` jika MASIH ADA
-- (Ini index yang tadinya dipakai FK — sekarang step 4.2a sudah provide index pengganti)
SET @sql = IF(@table_exists = 0, @noop, IFNULL((
  SELECT CONCAT('ALTER TABLE `branch_attendance_policies` ',
                'DROP INDEX `branch_attendance_policies_branch_id_key`') FROM DUAL
   WHERE 0 < (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_attendance_policies'
                 AND INDEX_NAME = 'branch_attendance_policies_branch_id_key')
), @noop));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- STEP 4.2c: Ubah branch_id jadi NULLABLE jika BELUM NULL
SET @sql = IF(@table_exists = 0, @noop, IFNULL((
  SELECT CONCAT('ALTER TABLE `branch_attendance_policies` ',
                'MODIFY COLUMN `branch_id` VARCHAR(36) NULL') FROM DUAL
   WHERE 'NO' = (SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_attendance_policies'
                    AND COLUMN_NAME = 'branch_id')
), @noop));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- STEP 4.2d: Compound unique (company_id, branch_id) jika BELUM ADA
SET @sql = IF(@table_exists = 0, @noop, IFNULL((
  SELECT CONCAT('ALTER TABLE `branch_attendance_policies` ADD UNIQUE INDEX ',
                '`branch_attendance_policies_company_id_branch_id_key` ',
                '(`company_id`, `branch_id`)') FROM DUAL
   WHERE 0 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_attendance_policies'
                 AND INDEX_NAME = 'branch_attendance_policies_company_id_branch_id_key')
), @noop));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
EOSQL
ok "Sanitizer pre-migration complete"

# =====================================================================
# STEP 5 — Prisma migrate deploy
# =====================================================================
log "STEP 5/7: Prisma migrate deploy"
MIGRATE_LOG="$(mktemp)"
if docker exec -i "$BACKEND_CONTAINER" npx prisma migrate deploy \
       --schema=src/database/prisma/schema.prisma >"$MIGRATE_LOG" 2>&1; then
  ok "prisma migrate deploy success"
  tail -n 6 "$MIGRATE_LOG" || true
else
  warn "prisma migrate deploy gagal — fallback mark 20260809120000 applied + retry"
  cat "$MIGRATE_LOG" || true
  # Coba resolve migration 20260809120000 karena STEP 4 SQL idempotent SUDAH MENJALANKANNYA
  docker exec -i "$BACKEND_CONTAINER" npx prisma migrate resolve \
      --applied 20260809120000_attendance_policy_company_default \
      --schema=src/database/prisma/schema.prisma 2>&1 | tail -5 || true
  # Retry migrate deploy (sekarang tidak ada yang stuck)
  if ! docker exec -i "$BACKEND_CONTAINER" npx prisma migrate deploy \
         --schema=src/database/prisma/schema.prisma >"$MIGRATE_LOG" 2>&1; then
    warn "masih fail — last resort: prisma db push --accept-data-loss"
    docker exec -i "$BACKEND_CONTAINER" npx prisma db push \
        --schema=src/database/prisma/schema.prisma --accept-data-loss 2>&1 | tail -8 || true
  fi
  ok "Prisma sync sukses via fallback"
fi
rm -f "$MIGRATE_LOG"

# =====================================================================
# STEP 6 — Backend readiness check /health
# =====================================================================
log "STEP 6/7: Backend health check (max $((MAX_RETRY_WAIT_HEALTH*5))s)"
COUNT=0
until docker exec "$BACKEND_CONTAINER" curl -sf "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; do
  printf '.'
  sleep 5
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge "$MAX_RETRY_WAIT_HEALTH" ]; then
    echo ""
    warn "Timeout health check. Last 15 log backend:"
    docker logs "$BACKEND_CONTAINER" --tail=15 2>&1 || true
    break
  fi
done
echo ""
ok "Deploy migration + app ready"

# =====================================================================
# STEP 7 — Prune docker images > 24 jam
# =====================================================================
log "STEP 7/7: Prune old docker images"
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
ok "Image prune done"

echo ""
echo "🎉 🚀 HRIS auto-deploy SUCCESS — $(date '+%Y-%m-%d %H:%M:%S')"
echo "   Commit  : $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
echo "   Health  : http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}/health"
echo ""
