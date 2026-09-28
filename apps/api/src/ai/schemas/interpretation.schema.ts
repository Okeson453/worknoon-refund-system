import { z } from 'zod';
import { AI_INTENTS, REFUND_REASONS } from '@worknoon/shared-types';
import { MAX_INTERPRETATION_SUMMARY_LENGTH, MAX_ITEM_IDS_PER_REQUEST } from '../../config/constants';
import { aiInvalidOutput } from '../aiErrors';
import type { Interpretation } from '../ai.types';

/** Strict schema: unknown keys are rejected so a model cannot smuggle extra instructions through. */
export const interpretationSchema = z
  .object({
    intent: z.enum(AI_INTENTS),
    reason: z.enum(REFUND_REASONS),
    matchedItemIds: z.array(z.string().min(1).max(64)).max(MAX_ITEM_IDS_PER_REQUEST),
    claimedAmountCents: z.number().int().nonnegative().max(100_000_000).nullable(),
    injectionSuspected: z.boolean(),
    confidence: z.number().min(0).max(1),
    summary: z.string().max(MAX_INTERPRETATION_SUMMARY_LENGTH),
  })
  .strict();

export function parseInterpretation(raw: unknown, provider: string): Interpretation {
  const result = interpretationSchema.safeParse(raw);
  if (!result.success) {
    throw aiInvalidOutput(provider, JSON.stringify(raw));
  }
  return result.data;
}

export interface ItemIntersection {
  matchedItemIds: string[];
  droppedItemIds: string[];
}

/**
 * The model can only ever narrow the trusted item set. Unknown IDs are dropped, and any drop
 * is treated as a manipulation signal for rule E1.
 */
export function intersectItemIds(candidateIds: readonly string[], trustedIds: readonly string[]): ItemIntersection {
  const trusted = new Set(trustedIds);
  const matchedItemIds: string[] = [];
  const droppedItemIds: string[] = [];
  for (const id of candidateIds) {
    if (trusted.has(id)) {
      if (!matchedItemIds.includes(id)) matchedItemIds.push(id);
    } else {
      droppedItemIds.push(id);
    }
  }
  return { matchedItemIds, droppedItemIds };
}

/**
 * JSON Schema used for forced tool use. Kept next to the Zod schema and asserted to stay in
 * sync by tests/unit/ai/interpretation.schema.test.ts.
 */
export const INTERPRETATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'reason', 'matchedItemIds', 'claimedAmountCents', 'injectionSuspected', 'confidence', 'summary'],
  properties: {
    intent: { type: 'string', enum: [...AI_INTENTS] },
    reason: { type: 'string', enum: [...REFUND_REASONS] },
    matchedItemIds: { type: 'array', items: { type: 'string' }, maxItems: MAX_ITEM_IDS_PER_REQUEST },
    claimedAmountCents: { type: ['integer', 'null'], minimum: 0 },
    injectionSuspected: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string', maxLength: MAX_INTERPRETATION_SUMMARY_LENGTH },
  },
} as const;

export const INTERPRETATION_TOOL_NAME = 'submit_interpretation';
