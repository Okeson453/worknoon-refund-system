#!/usr/bin/env bash
# Simulates the clean-clone acceptance check from the specification:
#   git clone <repo> && cd worknoon-refund-system && cp .env.example .env && docker compose up --build
# Verifies that the working tree contains every documented file and no secrets.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REQUIRED_FILES=(
  ".env.example"
  ".gitignore"
  ".dockerignore"
  "docker-compose.yml"
  "package.json"
  "tsconfig.base.json"
  "README.md"
  "LICENSE"
  "apps/web/Dockerfile"
  "apps/web/nginx.conf"
  "apps/web/index.html"
  "apps/web/vite.config.ts"
  "apps/web/package.json"
  "apps/web/tsconfig.json"
  "apps/web/public/favicon.svg"
  "apps/api/Dockerfile"
  "apps/api/docker-entrypoint.sh"
  "apps/api/package.json"
  "apps/api/tsconfig.json"
  "apps/api/vitest.config.ts"
  "apps/api/prisma/schema.prisma"
  "apps/api/prisma/seed.ts"
  "packages/shared-types/package.json"
  "packages/shared-types/tsconfig.json"
  "policy/refund-policy.md"
  "docs/ARCHITECTURE.md"
  "docs/API.md"
  "docs/DATA_MODEL.md"
  "docs/AI.md"
  "docs/SECURITY.md"
  "docs/DEMO.md"
  "docs/demo-script.md"
  "scripts/wait-for-db.sh"
  "scripts/test-all.sh"
  "scripts/verify-clean-clone.sh"
)

missing=0
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "MISSING or empty: $file" >&2
    missing=1
  fi
done

if [[ -f .env ]]; then
  echo "ERROR: .env must not be committed (it is git-ignored, but it exists in this tree)" >&2
  missing=1
fi

if grep -rIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
     -E 'sk-ant-[A-Za-z0-9_-]{10,}' . >/dev/null 2>&1; then
  echo "ERROR: an Anthropic API key appears to be committed" >&2
  missing=1
fi

migration_count=$(find apps/api/prisma/migrations -name 'migration.sql' | wc -l | tr -d ' ')
if [[ "$migration_count" -lt 1 ]]; then
  echo "ERROR: no Prisma migration found" >&2
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "clean-clone verification FAILED" >&2
  exit 1
fi

echo "clean-clone verification passed: ${#REQUIRED_FILES[@]} required files present, ${migration_count} migration(s), no committed secrets"
