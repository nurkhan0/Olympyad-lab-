#!/bin/bash
set -e

# Container role: "web" (default) runs migrations + daphne; "worker" runs the
# Celery worker (with embedded beat). "all" runs both in one container for
# Render free web service (no separate worker, no Blueprint).
ROLE="${ROLE:-web}"

echo "[entrypoint] Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q; do sleep 1; done
echo "[entrypoint] DB ready."

if [ "$ROLE" = "web" ]; then
    echo "[entrypoint] Running migrations..."
    python manage.py migrate --noinput
    mkdir -p /app/staticfiles /app/media
    chown -R appuser:appuser /app/staticfiles /app/media
    python manage.py collectstatic --noinput --clear
    chown -R appuser:appuser /app/staticfiles /app/media
    echo "[entrypoint] Starting Daphne (HTTP + WebSocket) on port ${PORT:-8000}..."
    exec su -s /bin/bash appuser -c "exec daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"
elif [ "$ROLE" = "worker" ]; then
    echo "[entrypoint] Starting Celery worker (queues: default,judge,contests) with embedded beat..."
    # Migrations/collectstatic are NOT run here: the web service owns schema
    # and static files. Worker only waits for the DB to be reachable.
    # DatabaseScheduler removed: it polls the DB and would keep Neon awake 24/7.
    # Static CELERY_BEAT_SCHEDULE in settings/base.py works with default scheduler (-B).
    exec su -s /bin/bash appuser -c "exec celery -A config worker --loglevel=info --pool=solo --queues=default,judge,contests -B"
elif [ "$ROLE" = "all" ]; then
    echo "[entrypoint] Running migrations..."
    python manage.py migrate --noinput
    mkdir -p /app/staticfiles /app/media
    chown -R appuser:appuser /app/staticfiles /app/media
    python manage.py collectstatic --noinput --clear
    chown -R appuser:appuser /app/staticfiles /app/media

    # Start Celery worker in background (NO -B: beat would poll DB and keep Neon awake)
    echo "[entrypoint] Starting Celery worker (queues: default,judge,contests) in background..."
    su -s /bin/bash appuser -c "exec celery -A config worker --loglevel=info --pool=solo --queues=default,judge,contests" &
    CELERY_PID=$!

    # Start Daphne in background
    echo "[entrypoint] Starting Daphne (HTTP + WebSocket) on port ${PORT:-8000}..."
    su -s /bin/bash appuser -c "exec daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application" &
    DAPHNE_PID=$!

    # Wait for either process to exit; if one dies, kill the other and exit non-zero
    wait -n $CELERY_PID $DAPHNE_PID
    EXIT_CODE=$?
    echo "[entrypoint] One process exited (code $EXIT_CODE), terminating the other..."
    kill $CELERY_PID $DAPHNE_PID 2>/dev/null || true
    wait $CELERY_PID $DAPHNE_PID 2>/dev/null || true
    exit $EXIT_CODE
else
    echo "[entrypoint] ERROR: unknown ROLE='$ROLE' (expected 'web', 'worker', or 'all')" >&2
    exit 1
fi
