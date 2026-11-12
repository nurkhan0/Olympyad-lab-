#!/bin/sh
# Full backup: PostgreSQL (custom format) + media archive + optional encryption.
#
# Usage (host side, against a running stack):
#   ./scripts/backup.sh                          # plain dump to ./backups/
#   ENCRYPT_PASSPHRASE=... ./scripts/backup.sh   # AES-256 encrypted .dump.enc
#   RETENTION_DAYS=14 ./scripts/backup.sh        # prune older files
#
# Secrets are read from the environment / .env.staging-style files — never
# hardcoded here. Restore with scripts/restore.sh.
set -eu

cd "$(cd "$(dirname "$0")/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# DB credentials come from the stack env file (values stay inside the file /
# container; they are passed to pg_dump through the container's environment).
for ENV_FILE in .env.staging .env.prod .env; do
  if [ -f "$ENV_FILE" ]; then
    POSTGRES_USER=$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)
    POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)
    break
  fi
done
: "${POSTGRES_USER:?POSTGRES_USER not found in env file}"
: "${POSTGRES_DB:?POSTGRES_DB not found in env file}"

mkdir -p "$BACKUP_DIR"

echo "[backup] 1/3 PostgreSQL (custom format, compressed)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "$BACKUP_DIR/db_${TIMESTAMP}.dump"
echo "[backup]    -> db_${TIMESTAMP}.dump ($(du -h "$BACKUP_DIR/db_${TIMESTAMP}.dump" | cut -f1))"

echo "[backup] 2/3 Media files..."
docker compose -f "$COMPOSE_FILE" exec -T django \
  sh -c 'cd /app/media && tar cz - . 2>/dev/null || tar czf - .' \
  > "$BACKUP_DIR/media_${TIMESTAMP}.tar.gz"
echo "[backup]    -> media_${TIMESTAMP}.tar.gz ($(du -h "$BACKUP_DIR/media_${TIMESTAMP}.tar.gz" | cut -f1))"

echo "[backup] 3/3 Optional encryption..."
if [ -n "${ENCRYPT_PASSPHRASE:-}" ]; then
  for f in "db_${TIMESTAMP}.dump" "media_${TIMESTAMP}.tar.gz"; do
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 \
      -in "$BACKUP_DIR/$f" -out "$BACKUP_DIR/$f.enc" -pass env:ENCRYPT_PASSPHRASE
    rm "$BACKUP_DIR/$f"
    echo "[backup]    -> $f.enc (AES-256-CBC, PBKDF2)"
  done
fi

echo "[backup] Off-site sync..."
# Optional hook: set OFFSITE_COMMAND to your sync tool, e.g.
#   OFFSITE_COMMAND="rclone copy $BACKUP_DIR remote:codearena-backups"
# Credentials belong to the sync tool's own configuration. Until an off-site
# target is configured and a restore from it has been tested, off-site
# readiness remains PENDING.
if [ -n "${OFFSITE_COMMAND:-}" ]; then
  sh -c "$OFFSITE_COMMAND" || echo "[backup] WARNING: off-site sync FAILED - local backup is untouched"
else
  echo "[backup]    OFFSITE_COMMAND not set - backups stay local (off-site readiness: PENDING)"
fi

echo "[backup] Retention: removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f \( -name 'db_*' -o -name 'media_*' \) \
  -mtime +"$RETENTION_DAYS" -print -delete

echo "[backup] Done. Files in $BACKUP_DIR"
