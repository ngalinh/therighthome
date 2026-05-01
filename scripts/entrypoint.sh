#!/bin/sh
set -e

PRISMA_BIN="node node_modules/prisma/build/index.js"

# If prisma/migrations exists, use migrate deploy; otherwise db push.
# Project doesn't ship migrations yet — db push syncs the schema directly.
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Running migrations..."
  $PRISMA_BIN migrate deploy
else
  echo "No migrations folder — syncing schema with db push..."
  $PRISMA_BIN db push --accept-data-loss --skip-generate
fi

echo "Seeding default data (idempotent)..."
node prisma/seed.js || true

echo "Starting Next.js server..."
exec node server.js
