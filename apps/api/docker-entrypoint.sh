#!/usr/bin/env bash
# API container start-up: wait for PostgreSQL, apply migrations, seed idempotently, then serve.
set -euo pipefail

echo "[entrypoint] waiting for the database…"
/app/scripts/wait-for-db.sh

echo "[entrypoint] applying database migrations…"
npx prisma migrate deploy

echo "[entrypoint] seeding synthetic CRM and order data…"
node dist/prisma/seed.js

echo "[entrypoint] starting the API on port ${PORT:-4000}…"
exec node dist/src/server.js
