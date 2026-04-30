#!/bin/sh
set -e

echo "Running migrations..."
npx prisma migrate deploy || npx prisma db push --accept-data-loss

echo "Seeding default data (idempotent)..."
node prisma/seed.js || true

echo "Starting Next.js server..."
exec node server.js
