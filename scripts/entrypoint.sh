#!/bin/sh
set -e

# Bind-mounted /app/storage may be owned by the host user (e.g. uid 1000),
# but the app runs as nextjs (uid 1001). Fix ownership before dropping privs.
mkdir -p /app/storage
chown -R nextjs:nodejs /app/storage 2>/dev/null || true

PRISMA_BIN="node node_modules/prisma/build/index.js"

# If prisma/migrations exists, use migrate deploy; otherwise db push.
# Project doesn't ship migrations yet — db push syncs the schema directly.
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Running migrations..."
  su-exec nextjs:nodejs $PRISMA_BIN migrate deploy
else
  echo "No migrations folder — syncing schema with db push..."
  su-exec nextjs:nodejs $PRISMA_BIN db push --accept-data-loss --skip-generate
fi

echo "Seeding default data (idempotent)..."
su-exec nextjs:nodejs node prisma/seed.js || true
su-exec nextjs:nodejs node prisma/seed-vp1.js || true

echo "Starting Next.js server..."
exec su-exec nextjs:nodejs node server.js
