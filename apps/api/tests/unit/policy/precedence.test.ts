import { describe, expect, it } from 'vitest';
import { evaluateRefund } from '../../../src/policy/evaluateRefund';
import { resolveVerdict } from '../../../src/policy/policyResult';
import { makeInput, makeItem, makeSignals } from '../../fixtures/refundScenarios';

describe('decision precedence', () => {
  it('denies when a denial and an escalation both fire', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ finalSale: true, damaged: true })], signals: makeSignals({ suspicious: true }) }),
    );
    expect(result.decision).toBe('DENIED');
    expect(result.reasonCodes).toEqual(['FINAL_SALE']);
  });

  it('denies before escalating even when an approval rule also fires', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ damaged: true, finalSale: true })], signals: makeSignals({ claimedAmountCents: 99_999 }) }),
    );
    expect(result.decision).toBe('DENIED');
  });

  it('escalates when an escalation and an approval both fire', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ priceCents: 90_000, damaged: true })], signals: makeSignals() }),
    );
    expect(result.decision).toBe('ESCALATED');
    expect(result.reasonCodes).toEqual(['OVER_REVIEW_THRESHOLD']);
  });

  it('approves when only an approval rule fires', () => {
    const result = evaluateRefund(makeInput({ items: [makeItem({ damaged: true })], signals: makeSignals() }));
    expect(result.decision).toBe('APPROVED');
    expect(result.reasonCodes).toEqual(['VERIFIED_DEFECT']);
  });

  it('escalates by default when nothing fired', () => {
    const result = evaluateRefund(
      makeInput({
        items: [makeItem()],
        signals: makeSignals({ reason: 'DAMAGED', confidence: 0.95, identifiedItemIds: ['ITM-TEST-1'], claimedAmountCents: 0 }),
      }),
    );
    // E2 fires because damage is not recorded, so a truly empty result set is produced by hand below.
    expect(result.rules.some((rule) => rule.fired)).toBe(true);
    expect(resolveVerdict([])).toEqual({ decision: 'ESCALATED', reasonCodes: ['NO_APPROVABLE_REASON'], determiningCategory: 'DEFAULT_SAFE' });
  });

  it('keeps reason codes limited to the winning category', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ priceCents: 90_000, damaged: true, finalSale: true })], signals: makeSignals({ suspicious: true }) }),
    );
    expect(result.decision).toBe('DENIED');
    expect(result.reasonCodes).toEqual(['FINAL_SALE']);
    expect(result.rules.filter((rule) => rule.fired).map((rule) => rule.code)).toEqual(
      expect.arrayContaining(['FINAL_SALE', 'SUSPICIOUS_INPUT', 'OVER_REVIEW_THRESHOLD', 'VERIFIED_DEFECT']),
    );
  });

  it('evaluates every rule without short-circuiting', () => {
    const result = evaluateRefund(makeInput());
    expect(result.rules).toHaveLength(12);
    expect(result.rules.map((rule) => rule.id).join('')).toBe('D1D2D3D4E1E2E3E4E5E6A1A2');
  });
});
