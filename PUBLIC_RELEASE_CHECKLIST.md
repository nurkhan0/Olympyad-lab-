# CodeArena — Public Release Checklist

Status legend: **Verified** (actually tested here) · **Prepared** (config/docs done, needs an
operational run) · **Pending external action** (blocked on infrastructure you must supply —
domain/DNS/storage) · **Blocked** (cannot proceed until a dependency clears).

Release baseline: git tag `v1.0.0-rc1` (frozen 2026-11-12). Local-CA TLS verification is NOT
equivalent to a publicly trusted certificate — user devices will not trust it automatically.

---

## 1. Domain & DNS — Pending external action

- [ ] Register/acquire the pilot domain.
- [ ] Create DNS A (and AAAA if IPv6) record → server IP; confirm propagation
      (`dig +short $DOMAIN`).
- [ ] Confirm ports 80 and 443 are reachable from the internet
      (`nc -vz $DOMAIN 80`, `nc -vz $DOMAIN 443` from an external host).
- No domain was invented or registered during development. Nothing to verify until one exists.

## 2. TLS certificate (Let's Encrypt) — Prepared, Pending external action

- [ ] `cp .env.example .env.prod`; set `DOMAIN`, `ACME_EMAIL`, secrets (`COOKIE_SECURE` left
      to defaults), `CSRF_TRUSTED_ORIGINS=https://$DOMAIN`, `CORS_ALLOWED_ORIGINS=https://$DOMAIN`,
      `ALLOWED_HOSTS=$DOMAIN`.
- [ ] `npm --prefix frontend run build` (produce `frontend/dist`).
- [ ] `scripts/init_production_certs.sh` — 14-day throwaway self-signed pair so nginx boots.
- [ ] `docker compose -f docker-compose.production.yml up -d --build`.
- [ ] `docker compose -f docker-compose.production.yml run --rm certbot certonly --webroot
      -w /var/www/certbot -d $DOMAIN --email $ACME_EMAIL --agree-tos --no-eff-email`
- [ ] `docker compose -f docker-compose.production.yml restart nginx`.
- [ ] Verify externally-trusted chain: `openssl s_client -connect $DOMAIN:443 -servername $DOMAIN`
      → `Verify return code: 0` **without** a custom CA file.
- Renewal: the `certbot` service renews twice daily; nginx re-reads certs on
  `restart nginx` after renewal (add a deploy hook if zero-downtime reload is wanted).
- ACME HTTP-01 webroot is routed in `nginx/https/app.conf.template`
  (`/.well-known/acme-challenge/` → `/var/www/certbot`) for both the HTTP and HTTPS blocks.
- Local-CA rehearsal (completed, tag v1.0.0-rc1) verified the identical nginx/TLS/cookie/WSS
  path cryptographically — but it is NOT a substitute for this item.

## 3. HTTPS redirect — Verified (locally) / Prepared (public)

- Verified over the local-CA rehearsal: `301` → `https://…` with port-preserving suffix.
- Re-verify on the public domain after §2: `curl -I http://$DOMAIN/…` → 301 to `https://`.

## 4. Secure cookies — Verified (locally) / Prepared (public)

- Verified over live TLS: login sets `refresh_token; HttpOnly; Path=/api/v1/auth/;
  SameSite=Lax; Secure`; logout clears with matching attributes.
- `COOKIE_SECURE` hard-defaults to `True` in production settings (a dev-`DEBUG` inheritance
  bug was found and fixed).
- Re-verify header flags over the public domain after §2 (`curl -v` on login/logout).

## 5. HSTS — Prepared (procedure below), Pending external action

- Default in `production.py` is `SECURE_HSTS_SECONDS=0` — deliberately off until public
  HTTPS is verified (a misconfigured HSTS hard-locks browsers).
- After §2 passes on the public domain:
  1. Set `SECURE_HSTS_SECONDS=31536000` in `.env.prod`, restart django.
  2. Verify the response header: `curl -sI https://$DOMAIN | grep -i strict`.
  3. `includeSubDomains`: enable only after checking EVERY subdomain serves valid TLS.
  4. `preload`: do NOT enable without a separate readiness review (removal takes months).

## 6. WebSocket (WSS) — Verified (locally) / Prepared (public)

- Verified: `VITE_WS_URL` optional override or automatic page-origin derivation; `wss://`
  through nginx (`101 Switching Protocols` + Daphne `WSCONNECT`); one reconnect; 2s polling
  fallback so verdicts never depend on the socket.
- Re-verify over the public domain after §2 (submit code, watch nginx log for 101).

## 7. PostgreSQL — Verified (staging)

- Healthcheck `pg_isready`, persistent named volume, migrations idempotent.
- Production: same image/config via `docker-compose.production.yml` (fresh `prod_*` volumes).

## 8. Redis — Verified (staging)

- Healthcheck, broker for Celery, Channels layer, Django cache (`/health/` checks it live).

## 9. Celery worker — Verified (staging)

- Non-eager worker, queues `default,judge,contests` (verify the banner after start — a
  worker on the wrong queue strands submissions `pending`; this exact failure was caught
  in staging), `inspect ping` healthcheck.

## 10. Judge — Verified

- Real subprocess execution (Python/C++/Java), WA/CE/AC verified end-to-end on staging and
  HTTPS stacks; verdicts persisted to `Submission` and broadcast over WS.

## 11. Static files — Verified (staging)

- `collectstatic` in the entrypoint; whitenoise manifest + nginx `/static/` alias.

## 12. Media files — Verified (staging)

- `/media/` alias on nginx, persistent volume, included in backups.

## 13. Backups (local) — Verified · Off-site — Pending external action

- Verified: `scripts/backup.sh` (pg_dump custom format + media tar + AES-256-CBC/PBKDF2
  encryption + retention), `scripts/restore.sh` round-trip matched live row counts exactly,
  live-DB overwrite guard, optional `OFFSITE_COMMAND` hook.
- Off-site: choose a provider (S3-compatible/rclone/Borg), configure credentials in the
  sync tool, set `OFFSITE_COMMAND`, then **restore from the off-site copy once** and only
  then mark this item Verified. Until then: Pending external action.

## 14. Monitoring — Prepared

- `/health/` (DB+Redis) with 200/503; per-service Docker healthchecks; Flower on :5555.
- Prepared: point an external uptime monitor at `/health/`; no external monitor is
  configured yet (Pending external action).

## 15. Error logging — Prepared

- Sentry SDK is wired in requirements but **not configured** (no DSN set). Set
  `SENTRY_DSN`-style configuration if desired before the pilot; otherwise rely on
  `docker compose logs` during the pilot. (Pending external action if Sentry is wanted.)

## 16. Database migration — Verified (procedure)

- Entrypoint migrates idempotently on start; `migrate --plan` clean; migration graph
  verified. Production rule: backup (§13) → `--plan` review → migrate → health check.

## 17. Rollback — Verified (procedure)

- Keep the previous image tag; `docker compose ... up -d --no-deps django celery_worker
  celery_beat` with the old image; irreversible migrations require the §13 restore.
- Release tag `v1.0.0-rc1` marks the known-good code state.

## 18. Account provisioning — Verified (mechanism)

- Only admins can grant teacher/admin roles; no public role escalation (registration
  creates students); JWT bearer + rotating HttpOnly refresh cookie; logout revokes server-side.

## 19. Teacher & student onboarding — Prepared

- `python manage.py seed_e2e` is test data — do NOT run it on production.
- Pilot onboarding: create teacher accounts via admin (`createsuperuser` + role grant),
  teachers create their own courses/students enroll via the catalog.
- Pilot 1 (recommended): a small teacher/student group covering course creation, materials,
  judge tasks, one olympiad. Pilot 2: scale after load, backup, and judge stability review.

## 20. Code freeze — Verified

- Tag `v1.0.0-rc1` frozen; only release-blocking fixes after this point, each with
  regression runs (pytest + tsc/build + affected E2E).

---

**Summary (exact, per section titles)** — 20 sections, 0 Blocked:

| Status | Sections | Count |
|--------|----------|-------|
| Verified | §7 PostgreSQL, §8 Redis, §9 Celery, §10 Judge, §11 Static, §12 Media, §16 Migration, §17 Rollback, §18 Accounts, §20 Code freeze | 10 |
| Verified locally + Prepared (public re-verification) | §3 Redirect, §4 Cookies, §6 WSS | 3 |
| Verified (local) + Pending external action (off-site) | §13 Backups | 1 |
| Prepared + Pending external action | §2 Let's Encrypt | 1 |
| Prepared | §5 HSTS, §14 Monitoring, §15 Error logging, §19 Onboarding | 4 |
| Pending external action | §1 Domain & DNS | 1 |


