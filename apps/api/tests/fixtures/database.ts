import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Test database bootstrap.
 *
 * Registered as Vitest's global setup so both the unit and the integration run see a database
 * with the 15 seeded scenarios. Unit-only runs (`vitest run tests/unit`) skip the migration and
 * seed entirely, which keeps them fast and free of infrastructure requirements.
 *
 * The integration run starts from a clean slate: previous refund requests are removed so the
 * duplicate-refund rule (D2) is exercised from a known state on every run. To make that safe,
 * the target database name must contain "test".
 */

const FALLBACK_DATABASE_URL = 'postgresql://refunds:refunds@localhost:5432/refunds_test';

export function resolveDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? FALLBACK_DATABASE_URL;
}

function databaseNameOf(databaseUrl: string): string {
  const withoutQuery = databaseUrl.split('?')[0];
  const segments = withoutQuery.split('/');
  return segments[segments.length - 1] ?? '';
}

function assertTestDatabase(databaseUrl: string): void {
  if (!databaseNameOf(databaseUrl).toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseNameOf(databaseUrl)}". ` +
        'Point TEST_DATABASE_URL at a database whose name contains "test".',
    );
  }
}

/** True unless the run is explicitly limited to the unit suites. */
function runIncludesIntegrationTests(): boolean {
  const pathFilters = process.argv.slice(2).filter((argument) => !argument.startsWith('-') && argument.includes('test'));
  if (pathFilters.length === 0) return true;
  return pathFilters.some((filter) => filter.replace(/\\/g, '/').includes('integration'));
}

let databasePrepared = false;

export async function setup(): Promise<void> {
  if (!runIncludesIntegrationTests()) return;

  const databaseUrl = resolveDatabaseUrl();
  assertTestDatabase(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  process.env.TEST_DATABASE_URL = databaseUrl;

  const apiRoot = resolve(__dirname, '../..');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  const { seedDatabase } = await import('../../prisma/seed');
  const { prisma } = await import('../../src/database/prisma');
  try {
    await prisma.refundRequest.deleteMany();
    await seedDatabase();
    databasePrepared = true;
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown(): Promise<void> {
  if (!databasePrepared) return;
  const { prisma } = await import('../../src/database/prisma');
  await prisma.$disconnect();
}
