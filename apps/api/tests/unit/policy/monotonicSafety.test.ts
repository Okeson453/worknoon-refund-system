import { describe, expect, it } from 'vitest';
import { evaluateRefund } from '../../../src/policy/evaluateRefund';
import type { RefundStatus } from '@worknoon/shared-types';
import type { PolicyInput } from '../../../src/policy/policy.types';
import { makeInput, makeItem, makeSignals } from '../../fixtures/refundScenarios';

const RANK: Record<RefundStatus, number> = { PENDING: 1, APPROVED: 0, ESCALATED: 1, DENIED: 2 };

/** More caution may only keep the verdict or move it toward ESCALATED/DENIED, never toward APPROVED. */
function expectNoWeaker(base: RefundStatus, next: RefundStatus): void {
  expect(RANK[next]).toBeGreaterThanOrEqual(RANK[base]);
}

const BASELINES: Array<[string, PolicyInput]> = [
  ['approved defect', makeInput({ items: [makeItem({ damaged: true })], signals: makeSignals() })],
  ['standard return', makeInput({ items: [makeItem()], signals: makeSignals({ reason: 'CHANGED_MIND' }) })],
  ['already escalated', makeInput({ items: [makeItem({ priceCents: 90_000, damaged: true })] })],
  ['already denied', makeInput({ items: [makeItem({ finalSale: true, damaged: true })] })],
];

describe('monotonic safety property', () => {
  it.each(BASELINES)('suspicious input can only tighten the verdict (%s)', (_name, input) => {
    const base = evaluateRefund(input).decision;
    const next = evaluateRefund({ ...input, signals: { ...input.signals, suspicious: true } }).decision;
    expectNoWeaker(base, next);
  });

  it.each(BASELINES)('an AI failure can only tighten the verdict (%s)', (_name, input) => {
    const base = evaluateRefund(input).decision;
    const next = evaluateRefund({ ...input, signals: { ...input.signals, aiFailed: true, confidence: 0 } }).decision;
    expectNoWeaker(base, next);
    expect(next).not.toBe('APPROVED');
  });

  it.each(BASELINES)('lowering confidence can only tighten the verdict (%s)', (_name, input) => {
    const base = evaluateRefund(input).decision;
    const next = evaluateRefund({ ...input, signals: { ...input.signals, confidence: 0.1 } }).decision;
    expectNoWeaker(base, next);
    expect(next).not.toBe('APPROVED');
  });

  it.each(BASELINES)('an uncertain reason can only tighten the verdict (%s)', (_name, input) => {
    const base = evaluateRefund(input).decision;
    const next = evaluateRefund({ ...input, signals: { ...input.signals, reason: 'UNCLEAR' } }).decision;
    expectNoWeaker(base, next);
  });

  it.each(BASELINES)('an unidentified item can only tighten the verdict (%s)', (_name, input) => {
    const base = evaluateRefund(input).decision;
    const next = evaluateRefund({ ...input, signals: { ...input.signals, identifiedItemIds: [] } }).decision;
    expectNoWeaker(base, next);
  });

  it('never approves when any safety signal is present', () => {
    const risky: PolicyInput[] = [
      makeInput({ signals: makeSignals({ suspicious: true }) }),
      makeInput({ signals: makeSignals({ aiFailed: true }) }),
      makeInput({ signals: makeSignals({ confidence: 0.1 }) }),
      makeInput({ signals: makeSignals({ reason: 'UNCLEAR' }) }),
      makeInput({ signals: makeSignals({ identifiedItemIds: [] }) }),
    ];
    for (const input of risky) {
      expect(evaluateRefund(input).decision).not.toBe('APPROVED');
    }
  });
});
