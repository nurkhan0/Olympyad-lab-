#!/bin/sh
# Generate a local Certificate Authority and a server certificate for
# localhost/127.0.0.1 — used ONLY for the HTTPS rehearsal (docker-compose.https.yml).
# Real deployments must use certbot (Let's Encrypt) against a live domain.
set -eu

OUT="$(cd "$(dirname "$0")/.." && pwd)/certs/dev"
DOMAIN="${DOMAIN:-localhost}"
mkdir -p "$OUT"

# 1) Local root CA (10 years)
openssl genrsa -out "$OUT/ca.key" 4096 2>/dev/null
openssl req -x509 -new -nodes -key "$OUT/ca.key" -sha256 -days 3650 \
  -subj "/CN=CodeArena Local Dev CA/O=CodeArena" \
  -out "$OUT/ca.crt" 2>/dev/null

# 2) Server key + CSR with SANs
openssl genrsa -out "$OUT/privkey.pem" 2048 2>/dev/null
openssl req -new -key "$OUT/privkey.pem" \
  -subj "/CN=${DOMAIN}" \
  -out "$OUT/server.csr" 2>/dev/null

cat > "$OUT/san.cnf" <<EOF
subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
EOF

# 3) Sign the server certificate with the local CA (825 days max for some clients)
openssl x509 -req -in "$OUT/server.csr" \
  -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -days 825 -sha256 -extfile "$OUT/san.cnf" \
  -out "$OUT/fullchain.pem" 2>/dev/null

# 4) chain.pem (CA cert) for nginx ssl_trusted_certificate
cp "$OUT/ca.crt" "$OUT/chain.pem"

# Verify the chain cryptographically
openssl verify -CAfile "$OUT/ca.crt" "$OUT/fullchain.pem"

echo "Certificates written to $OUT"
echo "Subjects: $(openssl x509 -in "$OUT/fullchain.pem" -noout -subject 2>/dev/null)"
echo "SANs:     $(openssl x509 -in "$OUT/fullchain.pem" -noout -ext subjectAltName 2>/dev/null | tail -1)"
