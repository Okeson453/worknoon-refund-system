import type { OrderStatus, Prisma } from '@prisma/client';
import type { CreateRefundResponse, PolicyCheckDto, RefundStatus } from '@worknoon/shared-types';
import { MESSAGE_MAX_LENGTH } from '../../config/constants';
import { markAiFailure, markAiSuccess } from '../../ai/ai.provider';
import { isAiError, truncateForAudit } from '../../ai/aiErrors';
import { screenForInjection } from '../../ai/injectionScreen';
import { intersectItemIds, parseInterpretation } from '../../ai/schemas/interpretation.schema';
import type { AiProvider, Interpretation } from '../../ai/ai.types';
import { auditService } from '../../audit/audit.service';
import type { AuditEventInput } from '../../audit/audit.types';
import { findCustomerById } from '../../database/repositories/customer.repository';
import { findOrderForCustomer, findRefundedItemIds } from '../../database/repositories/order.repository';
import { createPendingRequest, finalizeRequest } from '../../database/repositories/refund.repository';
import { lockOrderRow, withTransaction } from '../../database/transactions';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { evaluateRefund } from '../../policy/evaluateRefund';
import type { PolicyInput, PolicyResult } from '../../policy/policy.types';
import { notFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { sanitizeMessage } from '../../utils/sanitize';
import type { CreateRefundRequestPayload } from '../../validation/refund.schemas';
import { composeCustomerResponse } from './refundDecision';

export interface CreateRefundRequestCommand {
  payload: CreateRefundRequestPayload;
  requestId: string;
  provider: AiProvider;
}

interface InterpretationOutcome {
  interpretation: Interpretation | null;
  aiFailed: boolean;
  failureKind: string | null;
  rawOutput: string | null;
  latencyMs: number;
}

function firstNameOf(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first && first.length > 0 ? first : 'there';
}

function toPolicyResultJson(result: PolicyResult): Record<string, unknown> {
  return {
    decision: result.decision,
    refundAmountCents: result.refundAmountCents,
    reasonCodes: result.reasonCodes,
    rules: result.rules as unknown as PolicyCheckDto[],
  };
}

/**
 * The refund pipeline (spec §6): validate → sanitize → screen → verify ownership → persist
 * intake → interpret → decide → compose → finalize → audit.
 *
 * The AI never decides. Its validated output only becomes `signals`, and every signal can only
 * push the request toward a human review. The deterministic policy engine produces the verdict.
 */
export async function createRefundRequest(command: CreateRefundRequestCommand): Promise<CreateRefundResponse> {
  const { payload, requestId, provider } = command;
  const startedAt = Date.now();

  const sanitization = sanitizeMessage(payload.message, { maxLength: MESSAGE_MAX_LENGTH });
  const screen = screenForInjection(sanitization.value);

  const customer = await findCustomerById(payload.customerId);
  if (customer === null) throw notFoundError();

  const order = await findOrderForCustomer(payload.customerId, payload.orderId);
  if (order === null) throw notFoundError();

  const requestedItemIds = Array.from(new Set(payload.itemIds));
  const selectedItems = order.items.filter((item) => requestedItemIds.includes(item.id));
  if (selectedItems.length !== requestedItemIds.length) throw notFoundError();

  const previouslyRefunded = await findRefundedItemIds(selectedItems.map((item) => item.id));

  const pending = await prisma.$transaction(async (tx) => {
    const request = await createPendingRequest({
      customerId: customer.id,
      orderId: order.id,
      customerMessage: sanitization.value,
      itemIds: selectedItems.map((item) => item.id),
    });
    await auditService.recordMany(
      request.id,
      [
        {
          eventType: 'REQUEST_RECEIVED',
          actor: 'CUSTOMER',
          summary: `Refund requested for ${selectedItems.length} item(s) on ${order.id}.`,
          payload: {
            customerId: customer.id,
            orderId: order.id,
            itemIds: selectedItems.map((item) => item.id),
            messageLength: sanitization.value.length,
          },
        },
        {
          eventType: 'INPUT_SCREENED',
          actor: 'SYSTEM',
          summary: screen.suspicious ? 'Prompt-injection heuristics matched.' : 'Input passed sanitization and screening.',
          payload: {
            normalized: sanitization.normalized,
            removedCharacters: sanitization.removedCharacters,
            changed: sanitization.changed,
            suspicious: screen.suspicious,
            matchedPatternIds: screen.matchedPatternIds,
          },
        },
      ],
      tx,
    );
    return request;
  });

  try {
    const outcome = await interpretMessage(pending.id, {
      message: sanitization.value,
      items: order.items.map((item) => ({ id: item.id, name: item.productName })),
      selectedItemIds: selectedItems.map((item) => item.id),
      screenSuspicious: screen.suspicious,
    }, provider, requestId);

    const signals: PolicyInput['signals'] = outcome.interpretation
      ? buildSignals(outcome.interpretation, screen.suspicious, selectedItems.map((item) => item.id))
      : {
          reason: 'UNCLEAR',
          confidence: 0,
          claimedAmountCents: null,
          suspicious: screen.suspicious,
          aiFailed: true,
          identifiedItemIds: selectedItems.map((item) => item.id),
        };

    const policyInput: PolicyInput = {
      now: new Date(),
      order: { status: order.status as OrderStatus, orderDate: order.orderDate },
      items: selectedItems.map((item) => ({
        id: item.id,
        name: item.productName,
        priceCents: item.priceCents,
        quantity: item.quantity,
        finalSale: item.finalSale,
        damaged: item.damaged,
        incorrectItem: item.incorrectItem,
        previouslyRefunded: previouslyRefunded.has(item.id),
      })),
      totalItemCount: order.items.length,
      signals,
      config: {
        refundWindowDays: env.REFUND_WINDOW_DAYS,
        escalationThresholdCents: Math.round(env.ESCALATION_THRESHOLD_USD * 100),
        minConfidence: env.AI_MIN_CONFIDENCE,
      },
    };

    const policyResult = evaluateRefund(policyInput);

    const composition = await composeCustomerResponse(
      {
        decision: policyResult.decision,
        reasonCodes: policyResult.reasonCodes,
        refundAmountCents: policyResult.refundAmountCents,
        itemNames: selectedItems.map((item) => item.productName),
        customerFirstName: firstNameOf(customer.name),
        requestId,
      },
      provider,
    );

    const finalized = await finalizeWithAudit({
      requestId: pending.id,
      orderId: order.id,
      selectedItems,
      interpretation: outcome.interpretation,
      policyInput,
      policyResult,
      composition,
      aiUsed: outcome.interpretation !== null,
      aiLatencyMs: outcome.latencyMs,
    });

    logger.info(
      {
        event: 'refund.decided',
        requestId,
        refundRequestId: pending.id,
        decision: finalized.status,
        refundAmountCents: finalized.refundAmountCents,
        reasonCodes: finalized.decisionReasonCodes,
        aiUsed: outcome.interpretation !== null,
        aiFallback: composition.source === 'template',
        totalLatencyMs: Date.now() - startedAt,
      },
      'refund request decided',
    );

    return {
      id: finalized.id,
      decision: finalized.status,
      refundAmountCents: finalized.refundAmountCents ?? 0,
      customerMessage: finalized.customerResponse ?? '',
      reasonCodes: finalized.decisionReasonCodes,
      createdAt: finalized.createdAt.toISOString(),
    };
  } catch (error) {
    await recordPipelineError(pending.id, requestId, error);
    throw error;
  }
}

async function interpretMessage(
  refundRequestId: string,
  input: {
    message: string;
    items: Array<{ id: string; name: string }>;
    selectedItemIds: string[];
    screenSuspicious: boolean;
  },
  provider: AiProvider,
  requestId: string,
): Promise<InterpretationOutcome> {
  const startedAt = Date.now();
  try {
    const raw = await provider.interpret({ message: input.message, items: input.items, requestId });
    const interpretation = parseInterpretation(raw, provider.name);
    const intersection = intersectItemIds(interpretation.matchedItemIds, input.items.map((item) => item.id));
    const normalized: Interpretation = {
      ...interpretation,
      matchedItemIds: intersection.matchedItemIds,
      injectionSuspected: interpretation.injectionSuspected || input.screenSuspicious,
    };
    markAiSuccess();

    await auditService.record(refundRequestId, {
      eventType: 'AI_INTERPRETATION',
      actor: 'AI',
      summary: `Interpretation: ${normalized.reason} (confidence ${normalized.confidence.toFixed(2)}).`,
      payload: {
        provider: provider.name,
        model: provider.model,
        latencyMs: Date.now() - startedAt,
        intent: normalized.intent,
        reason: normalized.reason,
        confidence: normalized.confidence,
        injectionSuspected: normalized.injectionSuspected,
        matchedItemIds: normalized.matchedItemIds,
        droppedItemIds: intersection.droppedItemIds,
        summary: normalized.summary,
      },
    });

    return { interpretation: normalized, aiFailed: false, failureKind: null, rawOutput: null, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const kind = isAiError(error) ? error.kind : 'unexpected';
    const rawOutput = isAiError(error) ? error.rawOutput ?? null : truncateForAudit(String(error), 300);
    markAiFailure();
    logger.warn({ event: 'ai.interpreter.failed', requestId, refundRequestId, kind, latencyMs }, 'interpretation failed');

    await auditService.record(refundRequestId, {
      eventType: 'AI_INTERPRETATION',
      actor: 'AI',
      summary: `Interpretation failed (${kind}); the request continues without AI signals.`,
      payload: { provider: provider.name, model: provider.model, latencyMs, failed: true, kind },
    });
    await auditService.record(refundRequestId, {
      eventType: 'ERROR',
      actor: 'SYSTEM',
      summary: `AI interpretation error: ${kind}.`,
      payload: { stage: 'interpret', kind, rawOutput },
    });

    return { interpretation: null, aiFailed: true, failureKind: kind, rawOutput, latencyMs };
  }
}

function buildSignals(
  interpretation: Interpretation,
  screenSuspicious: boolean,
  selectedItemIds: string[],
): PolicyInput['signals'] {
  // Item IDs produced by the model are already intersected with the trusted order items.
  const identified = interpretation.matchedItemIds.filter((id) => selectedItemIds.includes(id));
  return {
    reason: interpretation.reason,
    confidence: interpretation.confidence,
    claimedAmountCents: interpretation.claimedAmountCents,
    suspicious: screenSuspicious || interpretation.injectionSuspected,
    aiFailed: false,
    identifiedItemIds: identified,
  };
}

interface FinalizeArgs {
  requestId: string;
  orderId: string;
  selectedItems: Array<{ id: string; productName: string; priceCents: number; quantity: number; finalSale: boolean; damaged: boolean; incorrectItem: boolean }>;
  interpretation: Interpretation | null;
  policyInput: PolicyInput;
  policyResult: PolicyResult;
  composition: { customerMessage: string; source: 'ai' | 'template'; fallbackReason: string | null; model: string };
  aiUsed: boolean;
  aiLatencyMs: number;
}

/**
 * Finalization repeats the duplicate-refund check while holding a row lock on the order
 * (spec v1.1 §10.1). If a concurrent request won the race, the decision is recomputed with the
 * fresh facts and the deterministic template is used so no model call runs inside the lock.
 */
async function finalizeWithAudit(args: FinalizeArgs) {
  const { requestId, orderId, selectedItems, interpretation, policyInput, composition, aiUsed, aiLatencyMs } = args;

  return withTransaction(async (tx) => {
    await lockOrderRow(tx, orderId);

    const refundedNow = await tx.refundRequestItem.findMany({
      where: { orderItemId: { in: selectedItems.map((item) => item.id) }, refundRequest: { status: 'APPROVED' } },
      select: { orderItemId: true },
      distinct: ['orderItemId'],
    });
    const refundedIds = new Set(refundedNow.map((row) => row.orderItemId));

    const recomputedInput: PolicyInput = {
      ...policyInput,
      items: policyInput.items.map((item) => ({ ...item, previouslyRefunded: refundedIds.has(item.id) })),
    };
    const policyResult = refundedIds.size > 0 ? evaluateRefund(recomputedInput) : args.policyResult;

    const decision: RefundStatus = policyResult.decision;
    const customerResponse =
      decision === args.policyResult.decision
        ? composition.customerMessage
        : templateForRecomputedDecision(policyResult, selectedItems.map((item) => item.productName));

    const finalized = await finalizeRequest(tx, requestId, {
      status: decision,
      detectedReason: interpretation?.reason ?? null,
      refundAmountCents: policyResult.refundAmountCents,
      decisionReasonCodes: policyResult.reasonCodes,
      customerResponse,
      aiInterpretation: interpretation ? ({ ...interpretation } as unknown as Prisma.InputJsonValue) : null,
      policyResult: toPolicyResultJson(policyResult) as Prisma.InputJsonValue,
      aiUsed,
    });

    const events: AuditEventInput[] = [
      {
        eventType: 'POLICY_EVALUATED',
        actor: 'POLICY_ENGINE',
        summary: `Evaluated ${policyResult.rules.length} deterministic rules.`,
        payload: {
          refundAmountCents: policyResult.refundAmountCents,
          rules: policyResult.rules as unknown as PolicyCheckDto[],
          config: {
            refundWindowDays: policyInput.config.refundWindowDays,
            escalationThresholdCents: policyInput.config.escalationThresholdCents,
            minConfidence: policyInput.config.minConfidence,
          },
          recomputedUnderLock: decision !== args.policyResult.decision,
        },
      },
      {
        eventType: 'DECISION_MADE',
        actor: 'POLICY_ENGINE',
        summary: `Decision: ${decision} (${policyResult.reasonCodes.join(', ') || 'no reason code'}).`,
        payload: {
          decision,
          refundAmountCents: policyResult.refundAmountCents,
          reasonCodes: policyResult.reasonCodes,
          signals: policyInput.signals,
          aiLatencyMs,
        },
      },
      composition.source === 'ai'
        ? {
            eventType: 'AI_RESPONSE_GENERATED',
            actor: 'AI',
            summary: 'Customer reply generated by the model and verified against the decision.',
            payload: { model: composition.model, wordCount: composition.customerMessage.split(/\s+/).filter(Boolean).length },
          }
        : {
            eventType: 'AI_FALLBACK_USED',
            actor: 'SYSTEM',
            summary: `Deterministic template used (${composition.fallbackReason ?? 'composer unavailable'}).`,
            payload: { reason: composition.fallbackReason, model: composition.model },
          },
    ];

    await auditService.recordMany(requestId, events, tx);

    return finalized;
  });
}

function templateForRecomputedDecision(result: PolicyResult, itemNames: string[]): string {
  const items = itemNames.length > 0 ? itemNames.join(' and ') : 'your item';
  if (result.decision === 'DENIED') {
    return `Hi there, we reviewed your request about ${items} and are not able to process this refund because it does not meet our refund policy.`;
  }
  if (result.decision === 'APPROVED') {
    return `Hi there, thanks for letting us know about ${items}. Your refund request has been approved and will be returned to your original payment method.`;
  }
  return `Hi there, thanks for your message about ${items}. A member of our support team is reviewing your request personally and will follow up with you by email.`;
}

async function recordPipelineError(refundRequestId: string, requestId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ event: 'refund.pipeline.error', requestId, refundRequestId, message }, 'refund pipeline failed');
  try {
    await auditService.record(refundRequestId, {
      eventType: 'ERROR',
      actor: 'SYSTEM',
      summary: 'Pipeline failed after intake; the request remains PENDING for manual review.',
      payload: { stage: 'pipeline', message: truncateForAudit(message, 200) },
    });
  } catch (auditError) {
    logger.error(
      { event: 'audit.write.failed', requestId, refundRequestId, message: String(auditError) },
      'could not append error audit event',
    );
  }
}
