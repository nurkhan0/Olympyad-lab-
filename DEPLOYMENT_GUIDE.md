# CodeArena — Deployment Guide

Operational guide for staging and production deployments. Commands were
executed and verified during the staging rehearsal documented in
[PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md).

> Never commit real secrets. `.env*` files (except `.env.example`) are
> gitignored. Never run migrations against an unknown or production database
> without a fresh backup.

---

## 1. Environment files

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.example` | Template with placeholders | ✅ |
| `.env` | Local development (compose dev stack) | ❌ |
| `.env.staging` | Staging rehearsal stack | ❌ |
| `.env.prod` | Production stack (referenced by `docker-compose.prod.yml`) | ❌ |

Required variables (all files, see `.env.example` for descriptions):

- `SECRET_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate:
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `REDIS_URL`
- `DEBUG`, `ALLOWED_HOSTS`
- Production-only toggles: `COOKIE_SECURE`, `SECURE_SSL_REDIRECT`,
  `SECURE_HSTS_SECONDS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- Frontend build-time: `VITE_WS_URL` (optional — see §4)

**Historical note:** the original `.env` files carried a UTF-8 BOM that made
python-decouple unable to read them (`SECRET_KEY not found`). Fixed on
2026-11-12; validated with a decouple parse check. If you ever recreate env
files, save them without BOM.

## 2. Topologies

### Development (repo root, `docker-compose.yml` + local processes)

- Vite dev server :5173 (proxies `/api` and `/ws` → Django :8000)
- Django `runserver` :8000 (ASGI/WS via daphne) against Postgres :5433 / Redis :6379
- Local Celery worker: `celery -A config worker --pool=solo --queues=default,judge,contests`

### Staging (`docker-compose.staging.yml`) — **verified**

- `postgres` (no host ports) + `redis` (no host ports), healthchecked
- `django`: entrypoint waits for DB → `migrate` → `collectstatic` → `daphne` (HTTP + WebSocket)
- `celery_worker`: **non-eager** judge worker, list-form command consuming
  `default,judge,contests` (queue names verified in the startup banner)
- `celery_beat`: DatabaseScheduler
- `nginx` on **:8080**: serves the production Vite build (`frontend/dist`), `/static`,
  `/media`, proxies `/api|/admin|/health` and `/ws` (Upgrade headers) to Django
- Health checks on every service; `depends_on` ordering

```bash
npm --prefix frontend run build
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml exec django python manage.py seed_e2e  # staging data
open http://localhost:8080
```

Teardown: `docker compose -f docker-compose.staging.yml down -v` (drops staging volumes).

### Production (`docker-compose.prod.yml`)

Same topology; TLS via certbot (`nginx/conf.d/ssl.conf.template`), secrets from
`.env.prod`, ports 80/443. Before first production run:
`cp .env.example .env.prod`, fill real secrets, set
`COOKIE_SECURE=True` (default via settings), `SECURE_SSL_REDIRECT=True`,
real `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` / `DOMAIN` / `SSL_EMAIL`.

## 3. First deployment checklist

1. `cp .env.example .env.prod` and fill secrets (no BOM, no quotes needed).
2. `docker compose -f docker-compose.prod.yml build`
3. `docker compose -f docker-compose.prod.yml up -d` — entrypoint runs
   `migrate` + `collectstatic` before starting Daphne.
4. Create a superuser:
   `docker compose -f docker-compose.prod.yml exec django python manage.py createsuperuser`
5. Review users: only admins may grant teacher/admin roles (`apps/users`).
6. Verify `https://<domain>/health/` returns `{"status": "ok", ...}`.
7. Load initial categories via admin or API (`POST /api/v1/education/categories/`).

## 4. WebSocket configuration

- **Frontend** (`frontend/src/hooks/useSubmissionStatus.ts`):
  origin = `VITE_WS_URL` (build-time override, `ws://`/`wss://…` or bare host)
  when set, otherwise the page origin (`wss://` on HTTPS pages, `ws://`
  otherwise, same host/port). No hardcoded localhost or port.
- **Development**: Vite proxies `/ws` with `ws: true` → Django :8000.
- **Staging/production**: nginx `location /ws/` sends
  `Upgrade`/`Connection "upgrade"` headers to Daphne.
- **Fallback**: one automatic reconnect attempt, then HTTP polling of
  `GET /api/v1/submissions/{id}/` every 2 s. A dead WebSocket never blocks
  verdict display.
- Verified: nginx logged `101 Switching Protocols` for `/ws/submissions/…`
  during the staging E2E run; Daphne logged `WSCONNECT`/`WSDISCONNECT`.

## 5. Cookie & security matrix (production)

| Setting | Value | Source |
|---|---|---|
| Refresh cookie | HttpOnly, SameSite=Lax, path `/api/v1/auth/` | `apps/users/serializers.py` |
| `COOKIE_SECURE` | True in production (default `not DEBUG`) | `config/settings/base.py` |
| `SECURE_SSL_REDIRECT` | True by default in production (env-overridable for HTTP staging) | `config/settings/production.py` |
| HSTS | 1 year, includeSubDomains, preload | `production.py` |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | True | `production.py` |
| `SECURE_PROXY_SSL_HEADER` | `X-Forwarded-Proto https` | `production.py` |
| CORS | env-driven (`CORS_ALLOWED_ORIGINS`), credentials allowed | `production.py` |
| CSRF trusted origins | env-driven (`CSRF_TRUSTED_ORIGINS`) | `production.py` |

## 6. Database migration procedure

1. **Backup first** (§7).
2. `docker compose -f docker-compose.prod.yml exec django python manage.py migrate --plan` — review.
3. `docker compose -f docker-compose.prod.yml exec django python manage.py migrate --noinput`
4. Health check + smoke: `curl https://<domain>/health/`, log in, submit code.
5. The Django container entrypoint also migrates on every restart
   (idempotent; no-op when up to date).

## 7. Backup & restore

**Backup** (host-side, already mounted at `./backups` in prod compose):
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backups/$(date +%F)_codearena.dump
```

**Restore** (maintenance window; stop workers first to avoid writes):
```bash
docker compose -f docker-compose.prod.yml stop celery_worker celery_beat django
cat backups/YYYY-MM-DD_codearena.dump | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
docker compose -f docker-compose.prod.yml start django celery_worker celery_beat
```

**Rollback of application code**: keep the previous image tag
(`docker compose ... build && docker tag`), then
`docker compose -f docker-compose.prod.yml up -d --no-deps django celery_worker celery_beat`
with the old image; migrations that are irreversible require the DB restore above.

## 8. Health & monitoring

- `GET /health/` — checks DB and Redis, returns 200/503.
- `docker compose ... ps` — every service carries a healthcheck
  (pg_isready / redis-cli ping / curl /health / celery inspect ping).
- Celery: `docker compose ... logs celery_worker` — queue banner must list
  `default`, `judge`, `contests` (a worker listening only on `celery` will
  strand submissions in `pending` — this exact failure was caught in staging).
- Flower (:5555) available in the dev/prod compose for queue introspection.

## 11. HTTPS / TLS

### Verified: local-CA TLS rehearsal (2026-11-12)

A full TLS-terminating deployment was executed and verified:

- `scripts/generate_dev_certs.sh` — creates a local root CA (10 years) and signs a server
  certificate for `localhost` / `127.0.0.1` (SAN-validated, RSA-2048) into `./certs/dev`
  (gitignored). Chain verified: `openssl verify -CAfile ca.crt fullchain.pem` → OK.
- `docker-compose.https.yml` — same services as staging, nginx terminates TLS on :8443
  (`nginx/https/app.conf.template`, rendered by the nginx image's envsubst with
  `DOMAIN` / `CERT_DIR` / `FRONTEND_ROOT` / `REDIRECT_PORT_SUFFIX`).
- **Verified over real TLS** (`curl --cacert certs/dev/ca.crt` — full chain validation):
  - `/health/` → 200 `{"status": "ok", ...}` (HTTP/2)
  - `http://localhost/…` → **301** → `https://localhost:8443/…`
  - Login `Set-Cookie: refresh_token=…; HttpOnly; Path=/api/v1/auth/; SameSite=Lax; Secure`
  - Logout clears the cookie with matching attributes (`Max-Age=0`, same path/flags)
  - WebSocket over TLS: nginx `101 Switching Protocols` for `/ws/…` + Daphne `WSCONNECT`
    (frontend derives `wss://` automatically on HTTPS pages)
  - **Full Playwright suite: 16/16 passed against `https://localhost:8443`**
- Production Django defaults re-verified after a real config bug was caught and fixed
  (`COOKIE_SECURE` was derived from a development `DEBUG=True` inherited through the
  dev `.env`; production now hard-defaults it to `True`).

Trust note: Chromium/Playwright accepted the chain with `ignoreHTTPSErrors` for the suite
(the cryptographic chain is separately verified with openssl as above). For interactive
browser use, trust the CA once:
`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/dev/ca.crt`.

### Prepared: Let's Encrypt on a real domain (NOT yet verified)

The same `nginx/https/app.conf.template` serves certbot: mount
`/etc/letsencrypt/live/$DOMAIN` instead of `./certs/dev`, keep the
`/.well-known/acme-challenge/` webroot (already routed), run the certbot renewal loop
from `docker-compose.prod.yml`. A public certificate REQUIRES a real DNS name — until a
domain is configured this remains an operational task; do not represent the local-CA
rehearsal as a public-CA verification.

### HSTS policy

HSTS is deliberately `0` in the rehearsal (both in nginx template and via
`SECURE_HSTS_SECONDS=0`) per the "enable HSTS only after HTTPS is verified" rule.
Enable `SECURE_HSTS_SECONDS=31536000` (and the nginx header) on the real domain after
the first successful certificate issuance.

## 12. Backup & restore — verified

`scripts/backup.sh` and `scripts/restore.sh` (execute from repo root):

```bash
COMPOSE_FILE=docker-compose.https.yml ./scripts/backup.sh                      # plain
COMPOSE_FILE=docker-compose.https.yml ENCRYPT_PASSPHRASE=… ./scripts/backup.sh # AES-256
COMPOSE_FILE=docker-compose.https.yml RESTORE_DB=restore_test ./scripts/restore.sh backups/db_….dump
```

Verified 2026-11-12 against the HTTPS stack:
- `db_*.dump` (pg_dump custom format, 196K) + `media_*.tar.gz`
- Encryption: AES-256-CBC/PBKDF2(200k); encrypted dump decrypts to a valid `PGDMP` header
- Round-trip: `RESTORE_DB=restore_test` restored **users=5, problems=10, courses=16,
  submissions=12** — exactly matching the live DB; scratch DB dropped afterwards
- Retention: files older than `RETENTION_DAYS` (default 7) are pruned
- `restore.sh` refuses to overwrite the live database without `FORCE_RESTORE=live`

## 9. Staging rehearsal results (2026-11-12)

- Stack: `docker-compose.staging.yml` (6 services, all healthy).
- Full Playwright suite against `http://localhost:8080`: **16/16 passed**
  (after fixing the worker queue routing; first staging run caught the
  worker listening on the wrong queue — submissions stuck `pending`).
- WebSocket: `101 Switching Protocols` in nginx logs; `WSCONNECT` in Daphne.
- Dev suite re-run after the WS change: **16/16 passed**.
- Backend regression: 172 passed; `check`/`makemigrations --check`/`migrate --plan` clean.

## 10. Remaining operational requirements (not yet verified)

- **Live TLS**: staging ran plain HTTP on :8080. Production HTTPS (certbot +
  `ssl.conf.template`) is configured but not yet exercised against a real
  domain — cookie `Secure`, HSTS and `X-Forwarded-Proto` must be re-verified
  in that path.
- **External DNS / real domain** — required for certbot issuance.
- Persistent off-host backups (the `backups/` volume is host-local).
