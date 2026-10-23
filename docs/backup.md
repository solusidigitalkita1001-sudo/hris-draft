# Backup & restore MySQL

Audit 16 Okt: nol backup otomatis dan drill restore belum pernah dijalankan —
blocker #1 kelayakan jual. Sisi repo sudah selesai; yang tersisa adalah dua
langkah pemasangan di server.

## Yang disediakan repo

- `scripts/backup-mysql.sh` — dump `--single-transaction` (konsisten, tanpa
  lock) via container mysql di network `database`, gzip, **verifikasi arsip**
  (`gunzip -t` + batas ukuran minimum), retensi default 14 hari. Kredensial
  dibaca dari `DATABASE_URL` di `backend/.env`; semua bisa di-override lewat
  environment (`BACKUP_DIR`, `RETENTION_DAYS`, `DB_*`).
- Volume produksi (`docker-compose.prod.yml`): `upload_data:/app/uploads`
  untuk backend+worker (lampiran payslip/cuti/kwitansi tidak lagi hilang tiap
  deploy) dan `redis_data:/data` (AOF BullMQ selamat dari penggantian
  container).

## Pemasangan di server (sekali, manual)

1. Cron harian:
   ```
   15 2 * * * /opt/hris/scripts/backup-mysql.sh >> /var/log/hris-backup.log 2>&1
   ```
2. Salin arsip keluar host (rclone/scp ke storage terpisah) — backup di disk
   yang sama dengan database bukan backup terhadap kegagalan disk.

## Drill restore — wajib dijalankan dan DICATAT

Backup yang tak pernah di-restore adalah harapan, bukan backup. Minimal
sekali (lalu berkala):

```bash
docker run --rm --network database mysql:8.0 \
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS hris_restore_drill;"
gunzip -c /var/backups/hris/hris-<stamp>.sql.gz \
  | docker run --rm -i --network database mysql:8.0 \
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" hris_restore_drill
# verifikasi kasar: jumlah tabel & baris karyawan masuk akal
docker run --rm --network database mysql:8.0 \
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
  -e "SELECT COUNT(*) tables_restored FROM information_schema.tables WHERE table_schema='hris_restore_drill'; SELECT COUNT(*) employees FROM hris_restore_drill.employees;"
```

Catat tanggal drill + hasilnya di `docs/PROGRESS.md`. File upload ikut
diamankan dengan mem-backup volume `upload_data`
(`docker run --rm -v hris_upload_data:/data -v /var/backups/hris:/out alpine tar czf /out/uploads-<stamp>.tar.gz -C /data .`).
