#!/usr/bin/env bash
# Full verification: typecheck, lint, unit tests, integration tests and production builds.
# Integration tests need a PostgreSQL database whose name contains "test".
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${TEST_DATABASE_URL:=postgresql://postgres:postgres@localhost:5432/worknoon_test}"
export TEST_DATABASE_URL
export DATABASE_URL="${DATABASE_URL:-$TEST_DATABASE_URL}"

echo "==> shared types"
npm run build:shared

echo "==> prisma client"
npm run prisma:generate

echo "==> typecheck"
npm run typecheck

echo "==> lint"
npm run lint

echo "==> unit tests"
npm run test:unit

echo "==> integration tests"
npm run test:integration

echo "==> production builds"
npm run build

echo "==> all checks passed"
