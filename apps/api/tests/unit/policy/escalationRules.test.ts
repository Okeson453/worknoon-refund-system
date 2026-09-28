import { describe, expect, it } from 'vitest';
import { evaluateEscalationRules } from '../../../src/policy/rules/escalationRules';
import { computeRefundAmountCents } from '../../../src/policy/policyResult';
import { makeInput, makeItem, makeSignals } from '../../fixtures/refundScenarios';

function evaluate(overrides: Parameters<typeof makeInput>[0] = {}) {
  const input = makeInput(overrides);
  return evaluateEscalationRules(input, { refundAmountCents: computeRefundAmountCents(input.items) });
}

function findRule(checks: ReturnType<typeof evaluate>, code: string) {
  const rule = checks.find((check) => check.code === code);
  if (rule === undefined) throw new Error(`rule ${code} missing`);
  return rule;
}

describe('E1 SUSPICIOUS_INPUT', () => {
  it('fires when the screen or the model flags manipulation', () => {
    expect(findRule(evaluate({ signals: makeSignals({ suspicious: true }) }), 'SUSPICIOUS_INPUT').fired).toBe(true);
  });

  it('does not fire for ordinary input', () => {
    expect(findRule(evaluate(), 'SUSPICIOUS_INPUT').fired).toBe(false);
  });
});

describe('E2 CLAIM_CONTRADICTS_RECORDS', () => {
  it('fires when damage is claimed but not recorded', () => {
    expect(findRule(evaluate({ items: [makeItem()] }), 'CLAIM_CONTRADICTS_RECORDS').fired).toBe(true);
  });

  it('fires when the claimed amount differs from the trusted amount', () => {
    const checks = evaluate({ items: [makeItem({ priceCents: 6_000 })], signals: makeSignals({ claimedAmountCents: 30_000 }) });
    const rule = findRule(checks, 'CLAIM_CONTRADICTS_RECORDS');
    expect(rule.fired).toBe(true);
    expect(rule.detail).toContain('$300.00');
  });

  it('does not fire when the claim matches the trusted amount', () => {
    const checks = evaluate({ items: [makeItem({ priceCents: 6_000, damaged: true })], signals: makeSignals({ claimedAmountCents: 6_000 }) });
    expect(findRule(checks, 'CLAIM_CONTRADICTS_RECORDS').fired).toBe(false);
  });
});

describe('E3 OVER_REVIEW_THRESHOLD', () => {
  it('does not fire exactly at the threshold', () => {
    expect(findRule(evaluate({ items: [makeItem({ priceCents: 50_000, damaged: true })] }), 'OVER_REVIEW_THRESHOLD').fired).toBe(false);
  });

  it('fires one cent above the threshold', () => {
    expect(findRule(evaluate({ items: [makeItem({ priceCents: 50_100, damaged: true })] }), 'OVER_REVIEW_THRESHOLD').fired).toBe(true);
  });
});

describe('E4 ITEM_AMBIGUOUS', () => {
  it('fires when a multi-item order has no identified item', () => {
    const checks = evaluate({
      items: [makeItem(), makeItem({ id: 'ITM-TEST-2', name: 'Other' })],
      totalItemCount: 2,
      signals: makeSignals({ identifiedItemIds: [] }),
    });
    expect(findRule(checks, 'ITEM_AMBIGUOUS').fired).toBe(true);
  });

  it('does not fire when the request identifies an item', () => {
    const checks = evaluate({
      items: [makeItem()],
      totalItemCount: 2,
      signals: makeSignals({ identifiedItemIds: ['ITM-TEST-1'] }),
    });
    expect(findRule(checks, 'ITEM_AMBIGUOUS').fired).toBe(false);
  });

  it('cannot fire on a single-item order', () => {
    expect(findRule(evaluate({ signals: makeSignals({ identifiedItemIds: [] }) }), 'ITEM_AMBIGUOUS').fired).toBe(false);
  });
});

describe('E5 REASON_UNCLEAR', () => {
  it.each(['OTHER', 'UNCLEAR'] as const)('fires for reason %s', (reason) => {
    expect(findRule(evaluate({ signals: makeSignals({ reason }) }), 'REASON_UNCLEAR').fired).toBe(true);
  });

  it('fires when confidence is below the minimum', () => {
    expect(findRule(evaluate({ signals: makeSignals({ confidence: 0.4 }) }), 'REASON_UNCLEAR').fired).toBe(true);
  });

  it('does not fire for a clear reason with sufficient confidence', () => {
    expect(findRule(evaluate(), 'REASON_UNCLEAR').fired).toBe(false);
  });
});

describe('E6 AI_UNAVAILABLE', () => {
  it('fires when the interpretation failed', () => {
    expect(findRule(evaluate({ signals: makeSignals({ aiFailed: true }) }), 'AI_UNAVAILABLE').fired).toBe(true);
  });

  it('does not fire when the interpretation succeeded', () => {
    expect(findRule(evaluate(), 'AI_UNAVAILABLE').fired).toBe(false);
  });
});
