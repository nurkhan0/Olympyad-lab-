#!/bin/sh
# Restore a database backup produced by scripts/backup.sh.
#
# Usage:
#   ./scripts/restore.sh backups/db_YYYYMMDD_HHMMSS.dump            # refuses live DB
#   RESTORE_DB=restore_test ./scripts/restore.sh backups/db_x.dump  # scratch DB verification
#   FORCE_RESTORE=live ./scripts/restore.sh backups/db_x.dump       # explicit live override
#
# STOP celery_worker/celery_beat/django before restoring into the live DB —
# concurrent writes during pg_restore corrupt data.
set -eu

cd "$(cd "$(dirname "$0")/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
BACKUP_FILE="${1:?usage: restore.sh <backup.dump>}"

# DB credentials from the stack env file (same discovery as backup.sh; values
# are only used for container-local psql/pg_restore invocations).
for ENV_FILE in .env.staging .env.prod .env; do
  if [ -f "$ENV_FILE" ]; then
    POSTGRES_USER=$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)
    POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)
    break
  fi
done
: "${POSTGRES_USER:?POSTGRES_USER not found in env file}"
: "${POSTGRES_DB:?POSTGRES_DB not found in env file}"

RESTORE_DB="${RESTORE_DB:-$POSTGRES_DB}"

if [ "$RESTORE_DB" = "$POSTGRES_DB" ] && [ "${FORCE_RESTORE:-}" != "live" ]; then
  echo "Refusing to overwrite the live database '$POSTGRES_DB' without FORCE_RESTORE=live."
  echo "Use RESTORE_DB=<scratch-db> for verification restores."
  exit 1
fi

echo "[restore] Target database: $RESTORE_DB"
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
  "createdb -U \$POSTGRES_USER ${RESTORE_DB} 2>/dev/null || true"

cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --no-owner --no-privileges

echo "[restore] Row counts in $RESTORE_DB:"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc "
  SELECT 'users: ' || count(*) FROM users_customuser
  UNION ALL SELECT 'problems: ' || count(*) FROM problems_problem
  UNION ALL SELECT 'courses: ' || count(*) FROM education_course
  UNION ALL SELECT 'submissions: ' || count(*) FROM submissions_submission;"

if [ "$RESTORE_DB" != "$POSTGRES_DB" ]; then
  echo "[restore] Scratch restore verified. Cleaning up $RESTORE_DB..."
  docker compose -f "$COMPOSE_FILE" exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$RESTORE_DB"
fi
echo "[restore] Done."
