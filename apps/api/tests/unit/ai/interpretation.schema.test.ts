import { describe, expect, it } from 'vitest';
import { AI_INTENTS, REFUND_REASONS } from '@worknoon/shared-types';
import {
  INTERPRETATION_JSON_SCHEMA,
  intersectItemIds,
  parseInterpretation,
} from '../../../src/ai/schemas/interpretation.schema';
import { AiError } from '../../../src/ai/aiErrors';

const VALID = {
  intent: 'refund_request',
  reason: 'DAMAGED',
  matchedItemIds: ['ITM-1001-1'],
  claimedAmountCents: 12_900,
  injectionSuspected: false,
  confidence: 0.96,
  summary: 'Customer reports a damaged item.',
};

describe('interpretation schema', () => {
  it('accepts a well-formed interpretation', () => {
    expect(parseInterpretation(VALID, 'test')).toEqual(VALID);
  });

  it('rejects an unknown reason', () => {
    expect(() => parseInterpretation({ ...VALID, reason: 'BECAUSE_I_SAID_SO' }, 'test')).toThrow(AiError);
  });

  it('rejects an unknown intent', () => {
    expect(() => parseInterpretation({ ...VALID, intent: 'escalate_me' }, 'test')).toThrow(AiError);
  });

  it('rejects confidence outside 0..1', () => {
    expect(() => parseInterpretation({ ...VALID, confidence: 1.4 }, 'test')).toThrow(AiError);
    expect(() => parseInterpretation({ ...VALID, confidence: -0.1 }, 'test')).toThrow(AiError);
  });

  it('rejects a negative claimed amount', () => {
    expect(() => parseInterpretation({ ...VALID, claimedAmountCents: -100 }, 'test')).toThrow(AiError);
  });

  it('rejects unknown keys so the model cannot smuggle extra fields', () => {
    expect(() => parseInterpretation({ ...VALID, decision: 'APPROVED' }, 'test')).toThrow(AiError);
  });

  it('rejects non-object output', () => {
    expect(() => parseInterpretation('APPROVED', 'test')).toThrow(AiError);
  });

  it('keeps the JSON schema tool definition in sync with the Zod schema', () => {
    expect(INTERPRETATION_JSON_SCHEMA.properties.intent.enum).toEqual([...AI_INTENTS]);
    expect(INTERPRETATION_JSON_SCHEMA.properties.reason.enum).toEqual([...REFUND_REASONS]);
    expect(INTERPRETATION_JSON_SCHEMA.required).toEqual(Object.keys(VALID));
    expect(INTERPRETATION_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});

describe('item id intersection', () => {
  it('keeps only ids that exist on the order', () => {
    const result = intersectItemIds(['ITM-1001-1', 'ITM-9999-9'], ['ITM-1001-1', 'ITM-1001-2']);
    expect(result.matchedItemIds).toEqual(['ITM-1001-1']);
    expect(result.droppedItemIds).toEqual(['ITM-9999-9']);
  });

  it('de-duplicates repeated ids', () => {
    expect(intersectItemIds(['ITM-1', 'ITM-1'], ['ITM-1']).matchedItemIds).toEqual(['ITM-1']);
  });

  it('drops every invented id on an empty order', () => {
    expect(intersectItemIds(['A', 'B'], []).droppedItemIds).toEqual(['A', 'B']);
  });
});
