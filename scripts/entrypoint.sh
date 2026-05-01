#!/bin/sh
set -e

PRISMA_BIN="node node_modules/prisma/build/index.js"

echo "Running migrations..."
$PRISMA_BIN migrate deploy 2>/dev/null || $PRISMA_BIN db push --accept-data-loss

echo "Seeding default data (idempotent)..."
node prisma/seed.js || true

echo "Starting Next.js server..."
exec node server.js
