import { describe, expect, it } from 'vitest';
import { evaluateDenialRules } from '../../../src/policy/rules/denialRules';
import { daysBefore, makeInput, makeItem } from '../../fixtures/refundScenarios';

function findRule(input: Parameters<typeof evaluateDenialRules>[0], code: string) {
  const rule = evaluateDenialRules(input).find((check) => check.code === code);
  if (rule === undefined) throw new Error(`rule ${code} missing`);
  return rule;
}

describe('D1 ORDER_NOT_DELIVERED', () => {
  it.each(['PROCESSING', 'SHIPPED', 'CANCELLED'] as const)('fires for %s', (status) => {
    const rule = findRule(makeInput({ order: { status, orderDate: daysBefore(2) } }), 'ORDER_NOT_DELIVERED');
    expect(rule.fired).toBe(true);
    expect(rule.category).toBe('DENIAL');
  });

  it('does not fire for a delivered order', () => {
    expect(findRule(makeInput(), 'ORDER_NOT_DELIVERED').fired).toBe(false);
  });
});

describe('D2 ALREADY_REFUNDED', () => {
  it('fires when a requested item already has an approved refund', () => {
    const rule = findRule(
      makeInput({ items: [makeItem({ previouslyRefunded: true }), makeItem({ id: 'ITM-TEST-2', name: 'Other' })] }),
      'ALREADY_REFUNDED',
    );
    expect(rule.fired).toBe(true);
    expect(rule.detail).toContain('Test Product');
  });

  it('does not fire for items without a prior refund', () => {
    expect(findRule(makeInput(), 'ALREADY_REFUNDED').fired).toBe(false);
  });
});

describe('D3 FINAL_SALE', () => {
  it('fires when any requested item is final sale', () => {
    const rule = findRule(makeInput({ items: [makeItem({ finalSale: true })] }), 'FINAL_SALE');
    expect(rule.fired).toBe(true);
  });

  it('does not fire when the item is not final sale', () => {
    expect(findRule(makeInput(), 'FINAL_SALE').fired).toBe(false);
  });
});

describe('D4 OUTSIDE_REFUND_WINDOW', () => {
  it('does not fire on day 30 (inclusive window)', () => {
    const rule = findRule(makeInput({ order: { status: 'DELIVERED', orderDate: daysBefore(30) } }), 'OUTSIDE_REFUND_WINDOW');
    expect(rule.fired).toBe(false);
  });

  it('fires on day 31', () => {
    const rule = findRule(makeInput({ order: { status: 'DELIVERED', orderDate: daysBefore(31) } }), 'OUTSIDE_REFUND_WINDOW');
    expect(rule.fired).toBe(true);
  });

  it('respects a configured window', () => {
    const input = makeInput({ order: { status: 'DELIVERED', orderDate: daysBefore(15) }, config: { refundWindowDays: 14, escalationThresholdCents: 50_000, minConfidence: 0.6 } });
    expect(findRule(input, 'OUTSIDE_REFUND_WINDOW').fired).toBe(true);
  });
});
