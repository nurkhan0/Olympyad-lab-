#!/bin/bash
set -e
echo "[entrypoint] Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q; do sleep 1; done
echo "[entrypoint] DB ready. Running migrations..."
python manage.py migrate --noinput
mkdir -p /app/staticfiles /app/media
chown -R appuser:appuser /app/staticfiles /app/media
python manage.py collectstatic --noinput --clear
chown -R appuser:appuser /app/staticfiles /app/media
echo "[entrypoint] Starting Gunicorn..."
exec su -s /bin/bash appuser -c "exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --worker-class sync \
  --timeout 120 \
  --log-level info \
  --access-logfile - \
  --error-logfile -"
