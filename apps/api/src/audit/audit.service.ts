import type { Prisma } from '@prisma/client';
import { createAuditEvent, createAuditEvents, listAuditEvents } from '../database/repositories/audit.repository';
import type { PrismaTransactionClient } from '../database/prisma';
import { prisma } from '../database/prisma';
import type { AuditEventInput, AuditEventRecord } from './audit.types';

type AuditWriter = Pick<PrismaTransactionClient, 'auditEvent'>;

/**
 * Append-only audit writer. Every meaningful state transition of a refund request produces one
 * immutable event, inside the same transaction as the state change it describes.
 */
export const auditService = {
  async record(refundRequestId: string, event: AuditEventInput, client?: AuditWriter): Promise<void> {
    const writer = client ?? (prisma as unknown as AuditWriter);
    await createAuditEvent(writer, {
      refundRequestId,
      eventType: event.eventType,
      actor: event.actor,
      summary: event.summary,
      payload: toJson(event.payload),
    });
  },

  async recordMany(refundRequestId: string, events: AuditEventInput[], client: AuditWriter): Promise<void> {
    await createAuditEvents(
      client,
      events.map((event) => ({
        refundRequestId,
        eventType: event.eventType,
        actor: event.actor,
        summary: event.summary,
        payload: toJson(event.payload),
      })),
    );
  },

  async timeline(refundRequestId: string): Promise<AuditEventRecord[]> {
    return listAuditEvents(refundRequestId);
  },
};

function toJson(payload: AuditEventInput['payload']): Prisma.InputJsonValue | undefined {
  if (payload === undefined || payload === null) return undefined;
  return payload as unknown as Prisma.InputJsonValue;
}
