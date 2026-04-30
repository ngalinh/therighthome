#!/usr/bin/env bash
# First-time deploy script for chdv.shipus.vn
# Run on the server (vmadmin@103.140.249.232) after cloning the repo.
set -euo pipefail

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in values."
  exit 1
fi

echo "==> Pulling images & building app"
docker compose pull db nginx certbot
docker compose build app backup

echo "==> Bootstrap (no SSL yet) so Let's Encrypt can do http-01"
mv -f nginx/conf.d/chdv.conf nginx/conf.d/chdv.conf.ssl
mv -f nginx/conf.d/chdv-bootstrap.conf.disabled nginx/conf.d/chdv-bootstrap.conf
mkdir -p certbot/www certbot/conf storage backups secrets

docker compose up -d db app nginx
sleep 3

echo "==> Requesting Let's Encrypt cert"
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  --email admin@shipus.vn --agree-tos --no-eff-email -d chdv.shipus.vn

echo "==> Switching nginx to SSL config"
mv -f nginx/conf.d/chdv-bootstrap.conf nginx/conf.d/chdv-bootstrap.conf.disabled
mv -f nginx/conf.d/chdv.conf.ssl nginx/conf.d/chdv.conf

docker compose up -d
echo "==> Done. App available at https://chdv.shipus.vn"
