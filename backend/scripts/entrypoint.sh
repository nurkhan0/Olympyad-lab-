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
echo "[entrypoint] Starting Daphne (HTTP + WebSocket)..."
exec su -s /bin/bash appuser -c "exec daphne -b 0.0.0.0 -p 8000 config.asgi:application"
