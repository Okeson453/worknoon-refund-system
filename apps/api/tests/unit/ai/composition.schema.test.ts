import { describe, expect, it } from 'vitest';
import { exceedsWordLimit, parseComposition } from '../../../src/ai/schemas/composition.schema';
import { checkCompositionConsistency, composeCustomerResponse, templateResponse } from '../../../src/services/refund/refundDecision';
import { AiError } from '../../../src/ai/aiErrors';
import { MockProvider } from '../../../src/ai/mock.provider';
import type { DecisionCompositionInput } from '../../../src/services/refund/refundDecision';

const base: DecisionCompositionInput = {
  decision: 'APPROVED',
  reasonCodes: ['VERIFIED_DEFECT'],
  refundAmountCents: 12_900,
  itemNames: ['Studio Wireless Headphones'],
  customerFirstName: 'Amara',
  requestId: 'req_test',
};

describe('composition schema', () => {
  it('accepts and trims a plain-text message', () => {
    expect(parseComposition({ message: '  Hi Amara.  ' }, 'test')).toEqual({ message: 'Hi Amara.' });
  });

  it('rejects an empty message and extra keys', () => {
    expect(() => parseComposition({ message: '' }, 'test')).toThrow(AiError);
    expect(() => parseComposition({ message: 'hi', markdown: true }, 'test')).toThrow(AiError);
  });

  it('detects an over-long reply', () => {
    expect(exceedsWordLimit('word '.repeat(81))).toBe(true);
    expect(exceedsWordLimit('word '.repeat(80))).toBe(false);
  });
});

describe('composition consistency check', () => {
  it('accepts a reply that matches an approval', () => {
    expect(checkCompositionConsistency('Hi Amara, your refund of $129.00 has been approved.', base)).toBeNull();
  });

  it('rejects an approval claim on a denial', () => {
    expect(checkCompositionConsistency('Your refund has been approved.', { ...base, decision: 'DENIED' })).toContain('contradicts');
  });

  it('rejects a denial claim on an approval', () => {
    expect(checkCompositionConsistency('Sorry, this request was denied.', base)).toContain('contradicts');
  });

  it('rejects an escalation claim on an approval', () => {
    expect(checkCompositionConsistency('We have escalated this to a specialist.', base)).toContain('contradicts');
  });

  it('rejects any amount other than the trusted one', () => {
    expect(checkCompositionConsistency('We can refund $500.00.', base)).toContain('trusted refund amount');
  });

  it('rejects an over-long reply', () => {
    expect(checkCompositionConsistency('word '.repeat(120), base)).toContain('word limit');
  });
});

describe('composeCustomerResponse', () => {
  it('uses the model output when it is consistent', async () => {
    const result = await composeCustomerResponse(base, new MockProvider());
    expect(result.source).toBe('ai');
    expect(result.fallbackReason).toBeNull();
  });

  it('falls back to the template when the model contradicts the decision', async () => {
    const rogue = {
      name: 'rogue',
      model: 'rogue-1',
      interpret: async () => {
        throw new Error('unused');
      },
      compose: async () => ({ message: 'Your refund has been approved and paid out.' }),
    };
    const result = await composeCustomerResponse({ ...base, decision: 'DENIED' }, rogue);
    expect(result.source).toBe('template');
    expect(result.fallbackReason).toContain('contradicts');
    expect(result.customerMessage).toBe(templateResponse({ ...base, decision: 'DENIED' }));
  });

  it('falls back to the template when the composer throws', async () => {
    const broken = {
      name: 'broken',
      model: 'broken-1',
      interpret: async () => {
        throw new Error('unused');
      },
      compose: async () => {
        throw new Error('boom');
      },
    };
    const result = await composeCustomerResponse(base, broken);
    expect(result.source).toBe('template');
    expect(result.customerMessage).toContain('$129.00');
  });
});
