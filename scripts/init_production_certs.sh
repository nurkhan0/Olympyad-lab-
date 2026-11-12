#!/bin/sh
# Create a THROWAWAY self-signed certificate so the production nginx can boot
# before the real Let's Encrypt certificate exists. certbot (step 5 of
# PUBLIC_RELEASE_CHECKLIST.md) replaces it; the files are then ignored until
# renewed. Requires DOMAIN in the environment or in .env.prod.
set -eu

cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${DOMAIN:-}" ]; then
  DOMAIN=$(grep -E '^DOMAIN=' .env.prod 2>/dev/null | cut -d= -f2-)
fi
: "${DOMAIN:?Set DOMAIN in the environment or .env.prod}"

OUT="./certbot/conf/live/${DOMAIN}"
mkdir -p "$OUT"

if [ -f "$OUT/privkey.pem" ]; then
  echo "Certificate for $DOMAIN already exists at $OUT — leaving it untouched."
  exit 0
fi

echo "Generating bootstrap self-signed certificate for $DOMAIN..."
openssl req -x509 -new -nodes -newkey rsa:2048 -sha256 -days 14 \
  -keyout "$OUT/privkey.pem" -out "$OUT/fullchain.pem" \
  -subj "/CN=${DOMAIN}" 2>/dev/null
cp "$OUT/fullchain.pem" "$OUT/chain.pem"

echo "Done. nginx can now start; obtain the real certificate with:"
echo "  docker compose -f docker-compose.production.yml run --rm certbot \\"
echo "    certonly --webroot -w /var/www/certbot -d $DOMAIN --email \$ACME_EMAIL --agree-tos --no-eff-email"
