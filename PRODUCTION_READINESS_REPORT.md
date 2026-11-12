# CodeArena — Production Readiness Report

Date: 2026-11-12
Scope: authentication state lifecycle, refresh-cookie security, full E2E verification of teacher / student / judge / olympiad / analytics workflows, backend & frontend regression.

All results below come from commands actually executed on this machine. Nothing is projected or assumed.

---

## 1. Executive summary

| Area | Status | Evidence |
|------|--------|----------|
| Backend test suite | ✅ PASS | `pytest apps/` — **172 passed** |
| Django system check | ✅ PASS | `manage.py check` — no issues (0 silenced) |
| Missing migrations | ✅ NONE | `makemigrations --check --dry-run` — no changes detected |
| Pending migrations | ✅ NONE | `migrate --plan` — no planned operations |
| Frontend typecheck | ✅ PASS | `tsc --noEmit` — 0 errors |
| Frontend build | ✅ PASS | `npm run build` — built in 2.25s (chunk-size warning only) |
| Playwright integration suite | ✅ PASS ×2 | `npx playwright test e2e/integration.spec.ts --reporter=list --workers=1` — **16 passed, twice consecutively** |
| Real judge verdicts | ✅ VERIFIED | Celery worker executed submissions (`WA`, `CE`, `AC` recorded in DB) |
| Olympiad round-trip | ✅ VERIFIED | UI contest creation → problem add → publish → student UI registration → arena submission → standings score |
| HTTPS production rehearsal | ⚠️ NOT RUN | No local TLS certificate; cookie `Secure` verified via settings review only |

## 2. Authentication diagnosis (root cause chain)

The reported symptom — `listCourses()` receiving HTTP 401 after successful login — was reproduced in a real browser and traced to **two independent root causes plus several supporting bugs**:

### 2.1 Backend: refresh rejected its own stale token

`BearerTokenAuthentication.authenticate()` raised `AuthenticationFailed` on invalid/expired tokens. DRF executes authentication even on `AllowAny` views, so the refresh endpoint rejected requests that carried the (expired) `Authorization` header attached by the frontend interceptor. Result: every session past the 15-minute access-token lifetime died.

**Fix** (`backend/apps/users/authentication.py`): invalid/expired/malformed tokens are treated as anonymous (`return None`); credential enforcement stays with permission classes on protected views.

### 2.2 Frontend: StrictMode double-init destroyed valid sessions

`initializeAuth()` lacked a single-flight guard. React 18 StrictMode double-invokes the App effect; two concurrent refresh calls raced the **rotating** refresh token (the first revokes the old jti), the loser received 401 and its `catch` cleared the store — wiping a session the other call had just restored. Every reload in development killed the session.

**Fixes**:
- `frontend/src/store/authStore.ts` — module-level `initPromise` (init runs exactly once); explicit error taxonomy (`classifyInitError`): definitive 401/403 clears auth, network/429/5xx exposes `initError` and **keeps the cookie**.
- `frontend/src/api/session.ts` (new) — one single-flight `refreshSession()` promise shared by the store and the axios interceptor; concurrent 401s trigger exactly one refresh.
- `frontend/src/api/axios.ts` — auth endpoints excluded from Authorization header and refresh flow; every replay marked `_retry` (at most once); no `window.location` redirect on transient failures.

### 2.3 The blank-page bug that masked everything

`GET /education/categories/` (and every other DRF list endpoint) returns paginated `{count, results}` objects, but `CoursesPage`/`CourseCreatePage`/`CourseEditPage`/teacher pages called `.map()` on the raw object — React **unmounted the entire application** on the catalog, course-creation and teacher-module pages. This produced both the "course list 401-looking" symptom (blank page after login) and the flaky "element detached" timeouts.

**Fix**: `educationApi` normalizes all list endpoints (`unwrapList`); all consumers updated.

## 3. Refresh-cookie security

| Property | Value |
|----------|-------|
| Path | `/api/v1/auth/` (narrowed from `/api/v1/` — refresh + logout only, never education/problems/submissions) |
| HttpOnly | ✅ asserted in tests |
| SameSite | Lax |
| Secure | `COOKIE_SECURE = config('COOKIE_SECURE', default=not DEBUG)` — True in production |
| Rotation | On every refresh; old jti revoked; new cookie set with matching attributes |
| Logout | Clears the cookie with matching path + revokes the DB token |
| Response bodies | `refresh_token` **removed** from login/refresh responses — HttpOnly cookie is the single transport (documented API change; frontend never used the body token) |

## 4. Verified workflows (Playwright, 16 tests, run twice)

1. **Teacher**: UI login → role destination `/teacher` → course API 200 → UI course/module/lesson/material creation → publish → students page → analytics page.
2. **Student**: UI login → `/courses` → catalog → enroll via detail page → My Learning → lesson viewer (materials + practice problems) → manual completion correctly **refused** while the mandatory problem is unsolved.
3. **Judge → LMS**: AC through the real Celery judge completes the lesson, enrollment reaches `completed`/100% exactly once (no duplicate completion rows); WA/CE/AC verdicts derived from persisted submissions; education-cache invalidation on AC.
4. **Olympiad**: teacher creates a contest through the UI modal, adds a problem through the (now functional) problems modal, publishes; student registers through the UI; arena opens for the running contest; Monaco submission judged; standings show the scored row; contest submissions provably do **not** touch education analytics (`solved_problems` unchanged).
5. **Analytics authorization**: student sees own stats; student denied `/teacher/.../analytics` (role guard); foreign teacher denied by backend 403; anonymous denied 401.
6. **Session lifecycle**: reload preserves auth via exactly one refresh call; logout clears auth (Navbar and TeacherLayout); protected routes bounce after logout; missing cookie lands on login without crash.

## 5. Infrastructure limitations

- **HTTPS rehearsal not run** (no local TLS certificate). Cookie `Secure`, HSTS, and SSL redirects are settings-reviewed but not exercised through a live nginx+TLS path. Recommended before pilot: run `docker-compose.prod.yml` behind a staged domain.
- **Verdict WebSocket** points at `ws://localhost/ws/...` (port 80) and always falls back to 2-second polling. Functional, but the URL should come from configuration.
- **`.env` UTF-8 BOM** prevents python-decouple from finding `SECRET_KEY`; compose-based deployments must re-save the file without BOM or inject variables explicitly.
- E2E judge execution uses the local Celery worker (`--pool=solo`) with real subprocesses — real verdicts, single-concurrency.

## 6. Next steps toward controlled pilot

1. HTTPS rehearsal with `docker-compose.prod.yml` + certbot; verify cookie `Secure` + CORS in that path.
2. Move the verdict WebSocket URL into env-based configuration.
3. Re-save `.env` without BOM (or switch compose to an env_file without BOM).
4. Optional hardening: rate-limit `/auth/login/`, add refresh-token reuse detection alerting.


---

# Staging Rehearsal — 2026-11-12 (deployment hardening session)

## What changed

1. **Environment**: UTF-8 BOM removed from `.env` and `.env.example` (decouple could not
   parse them before); `.env.example` rewritten with placeholders only; `.gitignore` covers
   `.env.*` (except the example). Decouple parse validated (13 keys, values not printed).
2. **WebSocket**: verdict URL no longer hardcoded to port 80 — `VITE_WS_URL` build-time
   override or automatic page-origin derivation (`wss://` on HTTPS); one automatic
   reconnect; HTTP polling fallback retained.
3. **Production settings**: `config/settings/production.py` was broken (three
   `SECURE_SSL_REDIRECT` declarations, last one silently `False`; localhost CORS in prod).
   Rewritten with env-driven, secure-by-default values (`SECURE_SSL_REDIRECT`,
   HSTS, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`); load-validated.
4. **Staging stack**: `docker-compose.staging.yml` (postgres + redis internal-only,
   django/daphne with healthcheck, non-eager celery worker on `default,judge,contests`,
   celery beat, nginx serving the production Vite build on :8080 with WS upgrade headers).
   `nginx/staging/default.conf` added; prod/dev compose untouched.

## Staging execution log (real commands)

- `docker compose -f docker-compose.staging.yml up -d --build` — 6/6 services healthy.
- First staging Playwright run: **13/16** — caught a genuine deployment bug: the worker's
  shell-quoted command lost `--queues`, so it listened only on the default `celery` queue
  and submissions stayed `pending`. Fixed with a list-form command; startup banner now
  shows `default`, `judge`, `contests`.
- Second staging run: **16/16 passed** against `http://localhost:8080`
  (real Postgres, real Redis broker, non-eager judge subprocesses, nginx, production build).
- WebSocket evidence: nginx logged `101 Switching Protocols` for `/ws/submissions/…`;
  Daphne logged `WSCONNECT`/`WSDISCONNECT`.
- Dev regression after the WS change: **16/16 passed** (Vite proxy path);
  dev log shows `WebSocket HANDSHAKING → CONNECT`.
- Backend: **172 passed**; `check` clean; `makemigrations --check` — no changes;
  `migrate --plan` — no pending operations; `tsc --noEmit` clean; `npm run build` OK.

## Status matrix (updated)

| Area | Status |
|------|--------|
| Environment configuration | ✅ verified (BOM fixed, decouple validated) |
| WebSocket endpoint | ✅ verified over reverse proxy (101 + WSCONNECT) with polling fallback |
| PostgreSQL + Redis + non-eager Celery judge | ✅ verified via staging compose |
| Production Compose configuration | ✅ prepared (healthchecks, internal networking, secrets via env_file) |
| HTTPS / live TLS | ⚠️ configured, NOT verified — requires a real domain + certbot issuance |
| Off-host backups | ⚠️ documented, not configured |


---

# HTTPS/TLS Deployment & Pilot Readiness — 2026-11-12 (final session)

## Verified (executed against live TLS)

| Item | Evidence |
|------|----------|
| Certificate issued & chain valid | local CA → server cert for `localhost`/`127.0.0.1` (SAN-validated); `openssl s_client -CAfile certs/dev/ca.crt` → `Verify return code: 0 (ok)`; `openssl verify` OK |
| TLS endpoint serving | `curl --cacert certs/dev/ca.crt https://localhost:8443/health/` → 200, HTTP/2 |
| HTTP → HTTPS redirect | `301` → `https://localhost:8443/…` (port-preserving via `REDIRECT_PORT_SUFFIX`) |
| Secure cookie flags | login: `refresh_token; HttpOnly; Path=/api/v1/auth/; SameSite=Lax; Secure`; logout clears with matching attributes |
| WebSocket over TLS | nginx `101 Switching Protocols` on `/ws/…` + Daphne `WSCONNECT` (frontend auto-derives `wss://`) |
| Full E2E suite over HTTPS | **16/16 passed** against `https://localhost:8443` (after production-settings fix + rebuild) |
| Judge over HTTPS | WA/AC verdicts processed by the non-eager Celery worker during the HTTPS run |
| Backup → encryption → restore | `db_*.dump` 196K; AES-256-CBC/PBKDF2; decrypt → valid `PGDMP`; `RESTORE_DB=restore_test` round-trip matched live counts exactly (5/10/16/12); scratch DB cleaned |
| Production security defaults | bug found & fixed: `COOKIE_SECURE` inherited `DEBUG=True` from the dev `.env`; production now hard-defaults `True` (asserted programmatically) |
| Full regression | backend **172 passed**; checks/migrations clean; `tsc` clean; build OK; dev E2E **16/16**; HTTPS E2E **16/16** |

## Prepared, not verified (needs real infrastructure)

- **Let's Encrypt certificate on a public domain** — the template routes ACME webroot and
  mounts certs generically; requires a real DNS name. Do not confuse the local-CA rehearsal
  with public-CA verification.
- **HSTS** — deliberately 0 in rehearsal; enable on the real domain after first issuance.
- **Off-site backup storage** — local backup/restore verified; external target (S3/rclone)
  remains an operational task.

## Remaining operational steps for the pilot

1. Point a real domain at the server; run certbot (`certonly --webroot -w ./certbot/www`).
2. Switch the nginx mount from `./certs/dev` to `/etc/letsencrypt/live/$DOMAIN`.
3. Set `SECURE_HSTS_SECONDS=31536000`, `CSRF_TRUSTED_ORIGINS=https://$DOMAIN`,
   `CORS_ALLOWED_ORIGINS=https://$DOMAIN`, `DOMAIN=$DOMAIN`.
4. Re-run `npx playwright test` with `E2E_BASE_URL=https://$DOMAIN` (no
   `E2E_IGNORE_TLS_ERRORS` — a public CA must validate natively).
5. Configure off-site backup sync + a monitored restore drill.


---

# Public Release Preparation — 2026-11-12 (final audit session)

Code freeze: **git tag `v1.0.0-rc1`** (1472 files committed; automated scan confirmed none
of the four real secret values appear anywhere in the staged tree; `.env*`, certs, backups,
runtime artifacts gitignored).

## Configuration audit results (all actually checked)

| Check | Result |
|-------|--------|
| WebSocket URLs in the production bundle | ✅ no hardcoded `ws://localhost` (page-origin derivation) |
| ACME challenge routing | ✅ present in both HTTP and HTTPS blocks of the nginx template |
| HSTS default in production | 🔧 fixed: was 31536000 before public verification — now 0, activation procedure documented (checklist §5) |
| Canonical production compose | ✅ `docker-compose.production.yml` created: ports 80/443, `${DOMAIN}` env-driven, certbot renewal service, no hardcoded hosts (supersedes legacy `docker-compose.prod.yml`) |
| Certbot bootstrap | ✅ `scripts/init_production_certs.sh` (throwaway self-signed pair so nginx boots before issuance) |
| Off-site backups | 🟡 `OFFSITE_COMMAND` hook added to `scripts/backup.sh` — integration remains Pending external action |
| Secrets in release commit | ✅ scanned programmatically: 0 leaks (1472 files) |
| Regression after audit changes | ✅ pytest 172/172, production settings asserts (HSTS=0, SSL_REDIRECT=True, COOKIE_SECURE=True), tsc clean |

## Release readiness

See **PUBLIC_RELEASE_CHECKLIST.md** — 20 sections, 0 Blocked: 10 Verified, 3 Verified-locally
+ Prepared for public re-verification (§3 redirect, §4 cookies, §6 WSS), 1 Verified-local +
Pending off-site (§13), 1 Prepared + Pending (§2 Let's Encrypt), 4 Prepared (§5 HSTS, §14
monitoring, §15 error logging, §19 onboarding), 1 Pending external action (§1 domain & DNS).
The critical path to the first real pilot: domain+DNS → Let's Encrypt → Playwright re-run
against the public HTTPS origin (native chain validation) → HSTS.
