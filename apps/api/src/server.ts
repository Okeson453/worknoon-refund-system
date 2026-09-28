import { createApp } from './app';
import { env } from './config/env';
import { checkDatabaseConnection, disconnectPrisma } from './database/prisma';
import { logger } from './utils/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
  const databaseUp = await checkDatabaseConnection();
  if (!databaseUp) {
    logger.error({ event: 'startup.failed', reason: 'database unreachable' }, 'cannot reach the database');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ event: 'startup', port: env.PORT, env: env.NODE_ENV, aiProvider: env.AI_PROVIDER }, 'api listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ event: 'shutdown', signal }, 'graceful shutdown started');
    const forceExit = setTimeout(() => {
      logger.warn({ event: 'shutdown.timeout' }, 'forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(() => {
      void disconnectPrisma().finally(() => {
        logger.info({ event: 'shutdown.complete' }, 'shutdown complete');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'process.unhandledRejection', reason: String(reason) }, 'unhandled rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ event: 'process.uncaughtException', message: error.message }, 'uncaught exception');
    shutdown('uncaughtException');
  });
}

void bootstrap();
