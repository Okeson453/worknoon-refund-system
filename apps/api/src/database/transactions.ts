import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { PrismaTransactionClient } from './prisma';

const TRANSACTION_TIMEOUT_MS = 10_000;
const TRANSACTION_MAX_WAIT_MS = 5_000;

/** Runs `work` inside a single database transaction. */
export async function withTransaction<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(work, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });
}

/**
 * Row-level lock on the order, taken before the duplicate-refund check is repeated inside the
 * finalize transaction. Two concurrent requests for the same item cannot both pass rule D2.
 */
export async function lockOrderRow(tx: PrismaTransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`);
}
