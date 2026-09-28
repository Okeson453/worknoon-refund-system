import type { AuditActor, AuditEventType } from '@prisma/client';

/** Structured, non-sensitive context for an audit row. */
export type AuditPayload = Record<string, unknown>;

export interface AuditEventInput {
  eventType: AuditEventType;
  actor: AuditActor;
  summary: string;
  payload?: AuditPayload | null;
}

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  actor: AuditActor;
  summary: string;
  payload: unknown;
  createdAt: Date;
}
