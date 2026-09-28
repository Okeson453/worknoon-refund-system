import type { InterpretationDto, PolicyCheckDto, RefundRequestDetail } from '@worknoon/shared-types';
import { auditService } from '../../audit/audit.service';
import { findRequestDetail } from '../../database/repositories/refund.repository';
import { notFoundError } from '../../utils/errors';

function toPolicyResultDto(value: unknown): RefundRequestDetail['policyResult'] {
  if (value === null || typeof value !== 'object') return null;
  const result = value as { decision?: unknown; refundAmountCents?: unknown; reasonCodes?: unknown; rules?: unknown };
  if (typeof result.decision !== 'string' || !Array.isArray(result.rules) || !Array.isArray(result.reasonCodes)) return null;
  return {
    decision: result.decision as RefundRequestDetail['status'],
    refundAmountCents: typeof result.refundAmountCents === 'number' ? result.refundAmountCents : 0,
    reasonCodes: result.reasonCodes.filter((code): code is string => typeof code === 'string'),
    rules: result.rules as PolicyCheckDto[],
  };
}

function toInterpretationDto(value: unknown): InterpretationDto | null {
  if (value === null || typeof value !== 'object') return null;
  return value as unknown as InterpretationDto;
}

/** Full admin view: order context, every policy check, the AI interpretation and the audit timeline. */
export async function getRefundRequest(id: string): Promise<RefundRequestDetail> {
  const record = await findRequestDetail(id);
  if (record === null) throw notFoundError('Refund request not found.');

  const audit = await auditService.timeline(id);

  return {
    id: record.id,
    displayId: record.displayId,
    customer: record.customer,
    order: {
      id: record.order.id,
      status: record.order.status,
      orderDate: record.order.orderDate.toISOString(),
      totalCents: record.order.totalCents,
    },
    items: record.items.map((link) => link.orderItem),
    status: record.status,
    detectedReason: (record.detectedReason as RefundRequestDetail['detectedReason']) ?? null,
    customerMessage: record.customerMessage,
    refundAmountCents: record.refundAmountCents,
    decisionReasonCodes: record.decisionReasonCodes,
    aiInterpretation: toInterpretationDto(record.aiInterpretation),
    aiUsed: record.aiUsed,
    policyResult: toPolicyResultDto(record.policyResult),
    customerResponse: record.customerResponse,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    audit: audit.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actor: event.actor,
      summary: event.summary,
      payload: (event.payload as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
