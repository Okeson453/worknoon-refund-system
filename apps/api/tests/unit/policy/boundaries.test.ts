import { describe, expect, it } from 'vitest';
import { evaluateRefund } from '../../../src/policy/evaluateRefund';
import { daysBefore, makeInput, makeItem, makeSignals } from '../../fixtures/refundScenarios';

describe('money boundaries', () => {
  it('approves a damaged item priced exactly at the review threshold', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ priceCents: 50_000, damaged: true })], signals: makeSignals() }),
    );
    expect(result.decision).toBe('APPROVED');
    expect(result.refundAmountCents).toBe(50_000);
  });

  it('escalates a damaged item priced one cent above the threshold', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ priceCents: 50_100, damaged: true })], signals: makeSignals() }),
    );
    expect(result.decision).toBe('ESCALATED');
    expect(result.reasonCodes).toContain('OVER_REVIEW_THRESHOLD');
  });

  it('sums quantity across the requested items', () => {
    const result = evaluateRefund(
      makeInput({ items: [makeItem({ priceCents: 2_500, quantity: 3, damaged: true })] }),
    );
    expect(result.refundAmountCents).toBe(7_500);
  });
});

describe('refund window boundaries', () => {
  it('approves a change of mind on day 30 when otherwise eligible', () => {
    const result = evaluateRefund(
      makeInput({
        order: { status: 'DELIVERED', orderDate: daysBefore(30) },
        items: [makeItem()],
        signals: makeSignals({ reason: 'CHANGED_MIND' }),
      }),
    );
    expect(result.decision).toBe('APPROVED');
  });

  it('denies a change of mind on day 31', () => {
    const result = evaluateRefund(
      makeInput({
        order: { status: 'DELIVERED', orderDate: daysBefore(31) },
        items: [makeItem()],
        signals: makeSignals({ reason: 'CHANGED_MIND' }),
      }),
    );
    expect(result.decision).toBe('DENIED');
    expect(result.reasonCodes).toEqual(['OUTSIDE_REFUND_WINDOW']);
  });
});
