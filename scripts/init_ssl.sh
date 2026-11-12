#!/bin/bash
set -e
DOMAIN="${DOMAIN:?Set DOMAIN env var}"
EMAIL="${SSL_EMAIL:?Set SSL_EMAIL env var}"
echo "=== Getting cert for $DOMAIN ==="
mkdir -p certbot/www certbot/conf
sed -i "s/YOURDOMAIN/$DOMAIN/g" nginx/conf.d/default.conf
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
sleep 3
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot --webroot-path=/var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    --force-renewal -d "$DOMAIN" -d "www.$DOMAIN"
echo "=== Enabling SSL config ==="
cp nginx/conf.d/ssl.conf.template nginx/conf.d/ssl.conf
sed -i "s/YOURDOMAIN/$DOMAIN/g" nginx/conf.d/ssl.conf
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps nginx
sleep 3
curl -sf "https://$DOMAIN/health/" && echo "✅ SSL active!" || echo "❌ Check: docker-compose logs nginx"
