#!/usr/bin/env bash
# Deploy when an EXISTING host nginx + certbot are present.
# App binds 127.0.0.1:3002 (configurable via APP_HOST_PORT env), host nginx
# reverse-proxies admin.therighthome.vn to it.
set -euo pipefail

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in values."
  exit 1
fi

DOMAIN="admin.therighthome.vn"
# Detect nginx config layout — try sites-enabled first (Debian/Ubuntu),
# then conf.d (RHEL-style). Existing site at /etc/nginx/sites-enabled/* tells us this server uses Debian style.
if [ -d /etc/nginx/sites-enabled ]; then
  NGINX_CONF_DST="/etc/nginx/sites-enabled/admin.therighthome.vn.conf"
else
  NGINX_CONF_DST="/etc/nginx/conf.d/admin.therighthome.vn.conf"
fi
NGINX_CONF_SRC="nginx/host-snippet/admin.therighthome.vn.conf"

mkdir -p storage backups secrets
# Make sure the bind-mounted storage is writable by the container's nextjs uid.
# Container also fixes this on startup, but doing it here helps if running as
# a non-root host user that can't chown.
chmod -R u+rwX,g+rwX,o+rwX storage 2>/dev/null || true

echo "==> Building app image"
docker compose build app worker backup

echo "==> Starting db, app, worker, backup (no bundled nginx)"
docker compose up -d db app worker backup

echo "==> Waiting for app health (port 3002)"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3002/login; then
    echo "App responding on 127.0.0.1:3002"
    break
  fi
  sleep 2
done

if [ ! -f "$NGINX_CONF_DST" ]; then
  echo "==> Installing nginx server block to $NGINX_CONF_DST"
  sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "==> $NGINX_CONF_DST already exists, skipping copy"
fi

echo "==> Issuing SSL cert for $DOMAIN (host certbot)"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@therighthome.vn --redirect || true

echo "==> Done. App should be live at https://$DOMAIN"
echo "    Test: curl -I https://$DOMAIN/login"
