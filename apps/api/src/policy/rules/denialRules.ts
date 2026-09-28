import { MS_PER_DAY } from '../policy.constants';
import type { PolicyCheck, PolicyInput } from '../policy.types';
import { ruleCheck } from '../policyResult';

const DAY_MS = MS_PER_DAY;

export function elapsedDaysSince(orderDate: Date, now: Date): number {
  return Math.floor((now.getTime() - orderDate.getTime()) / DAY_MS);
}

/**
 * Denials are derived exclusively from database facts, so they are never influenced by
 * customer text or model output. The refund window is inclusive: exactly `refundWindowDays`
 * days old is still eligible, one day more is not.
 */
export function evaluateDenialRules(input: PolicyInput): PolicyCheck[] {
  const { order, items, config } = input;

  const d1 = ruleCheck(
    'D1',
    order.status !== 'DELIVERED',
    `Order status is ${order.status}; only DELIVERED orders are eligible.`,
  );

  const refundedItems = items.filter((item) => item.previouslyRefunded);
  const d2 = ruleCheck(
    'D2',
    refundedItems.length > 0,
    refundedItems.length > 0
      ? `Already refunded: ${refundedItems.map((item) => item.name).join(', ')}.`
      : 'No previously approved refund covers the selected items.',
  );

  const finalSaleItems = items.filter((item) => item.finalSale);
  const d3 = ruleCheck(
    'D3',
    finalSaleItems.length > 0,
    finalSaleItems.length > 0
      ? `Final sale: ${finalSaleItems.map((item) => item.name).join(', ')}.`
      : 'No selected item is marked final sale.',
  );

  const elapsed = elapsedDaysSince(order.orderDate, input.now);
  const d4 = ruleCheck(
    'D4',
    elapsed > config.refundWindowDays,
    `Order is ${elapsed} day(s) old and the refund window is ${config.refundWindowDays} day(s) inclusive.`,
  );

  return [d1, d2, d3, d4];
}
