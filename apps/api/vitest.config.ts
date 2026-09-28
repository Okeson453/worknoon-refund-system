import { defineConfig } from 'vitest/config';
import { resolveDatabaseUrl } from './tests/fixtures/database';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/fixtures/database.ts'],
    // Keeps the suite runnable without a shell-provided environment; the database is only
    // contacted by the integration tests, which always override this through TEST_DATABASE_URL.
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      DATABASE_URL: resolveDatabaseUrl(),
    },
    // Integration files share one seeded database, so they run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    restoreMocks: true,
    reporters: ['default'],
  },
});
