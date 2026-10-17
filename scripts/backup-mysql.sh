#!/usr/bin/env bash
# Backup harian MySQL HRIS — dump konsisten + retensi + verifikasi arsip.
#
# Dirancang untuk server yang menjalankan docker-compose.prod.yml, di mana
# MySQL hidup di network eksternal `database`. Kredensial dibaca dari
# DATABASE_URL di backend/.env (atau override lewat environment).
#
# Pasang di server (crontab root), contoh tiap jam 02:15:
#   15 2 * * * /opt/hris/scripts/backup-mysql.sh >> /var/log/hris-backup.log 2>&1
#
# Restore drill (jalankan BERKALA, catat hasilnya — backup yang tak pernah
# di-restore adalah harapan, bukan backup):
#   gunzip -c /var/backups/hris/hris-YYYYmmdd-HHMMSS.sql.gz \
#     | docker run --rm -i --network database mysql:8.0 \
#       mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" hris_restore_drill
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/backend/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hris}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DOCKER_NETWORK="${DOCKER_NETWORK:-database}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"

# DATABASE_URL=mysql://user:pass@host:port/dbname?params
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi
[[ -n "$DATABASE_URL" ]] || { echo "DATABASE_URL tidak ditemukan ($ENV_FILE)"; exit 1; }

url_no_scheme="${DATABASE_URL#mysql://}"
creds="${url_no_scheme%%@*}"
rest="${url_no_scheme#*@}"
DB_USER="${DB_USER:-${creds%%:*}}"
DB_PASSWORD="${DB_PASSWORD:-${creds#*:}}"
hostport="${rest%%/*}"
DB_HOST="${DB_HOST:-${hostport%%:*}}"
DB_PORT="${DB_PORT:-${hostport##*:}}"
dbname_q="${rest#*/}"
DB_NAME="${DB_NAME:-${dbname_q%%\?*}}"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/hris-$stamp.sql.gz"

# --single-transaction: dump konsisten tanpa mengunci tabel InnoDB.
# --routines --triggers: jangan tinggalkan logika DB di luar arsip.
docker run --rm --network "$DOCKER_NETWORK" "$MYSQL_IMAGE" \
  mysqldump \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction --routines --triggers --no-tablespaces \
    "$DB_NAME" \
  | gzip > "$out"

# Arsip kosong/korup harus gagal SEKARANG, bukan saat restore darurat.
gunzip -t "$out"
size_bytes=$(wc -c < "$out")
[[ "$size_bytes" -gt 10240 ]] || { echo "Backup mencurigakan: hanya ${size_bytes}B — periksa kredensial/DB"; exit 1; }

find "$BACKUP_DIR" -name 'hris-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "OK $out ($(numfmt --to=iec "$size_bytes" 2>/dev/null || echo "${size_bytes}B")), retensi ${RETENTION_DAYS} hari"
