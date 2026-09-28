import { PrismaClient, type Prisma } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/** A single process-wide client; Prisma pools connections internally. */
export const prisma = new PrismaClient({
  log: env.LOG_LEVEL === 'debug' ? ['warn', 'error'] : ['error'],
});

export type PrismaTransactionClient = Prisma.TransactionClient;

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ event: 'db.unreachable', error: error instanceof Error ? error.message : String(error) }, 'database unreachable');
    return false;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
