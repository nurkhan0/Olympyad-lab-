#!/bin/bash
set -e
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/polympiad_${TIMESTAMP}.sql.gz"
echo "[backup] Creating backup: $FILENAME"
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILENAME"
echo "[backup] Done."
