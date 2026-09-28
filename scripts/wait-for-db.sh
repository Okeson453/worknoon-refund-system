#!/usr/bin/env bash
# Blocks until PostgreSQL accepts connections. Used by the API container before migrations run.
set -euo pipefail

RETRIES="${DB_WAIT_RETRIES:-30}"
INTERVAL="${DB_WAIT_INTERVAL:-2}"
HOST="${PGHOST:-db}"
PORT="${PGPORT:-5432}"
USER="${PGUSER:-postgres}"
DATABASE="${PGDATABASE:-worknoon}"

for attempt in $(seq 1 "$RETRIES"); do
  if node -e "
    const { Client } = require('@prisma/client');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.connect()
      .then(() => client.\$queryRawUnsafe('SELECT 1'))
      .then(() => client.\$disconnect())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  " >/dev/null 2>&1; then
    echo "[wait-for-db] ${USER}@${HOST}:${PORT}/${DATABASE} is ready (attempt ${attempt})"
    exit 0
  fi
  echo "[wait-for-db] attempt ${attempt}/${RETRIES}: database not ready yet"
  sleep "$INTERVAL"
done

echo "[wait-for-db] database did not become ready in time" >&2
exit 1
