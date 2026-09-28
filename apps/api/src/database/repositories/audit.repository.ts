import type { AuditActor, AuditEventType, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { PrismaTransactionClient } from '../prisma';

export interface AuditEventInput {
  refundRequestId: string;
  eventType: AuditEventType;
  actor: AuditActor;
  summary: string;
  payload?: Prisma.InputJsonValue;
}

export interface AuditEventRecord {
  id: string;
  refundRequestId: string;
  eventType: AuditEventType;
  actor: AuditActor;
  summary: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

type AuditWriter = Pick<PrismaTransactionClient, 'auditEvent'>;

/** Append only: audit rows are never updated or deleted by the application. */
export async function createAuditEvent(client: AuditWriter, event: AuditEventInput): Promise<AuditEventRecord> {
  return client.auditEvent.create({ data: event });
}

export async function createAuditEvents(client: AuditWriter, events: AuditEventInput[]): Promise<number> {
  if (events.length === 0) return 0;
  const result = await client.auditEvent.createMany({ data: events });
  return result.count;
}

export async function listAuditEvents(refundRequestId: string): Promise<AuditEventRecord[]> {
  return prisma.auditEvent.findMany({
    where: { refundRequestId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}
