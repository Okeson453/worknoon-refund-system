import type { OrderStatus, OrderSummary } from '@worknoon/shared-types';

export interface SeedOrderExpectation {
  customerId: string;
  orderId: string;
  status: OrderStatus;
  totalCents: number;
  itemIds: string[];
  damagedItemIds: string[];
  finalSaleItemIds: string[];
  incorrectItemIds: string[];
}

/** The seeded order matrix (v1.1 §6.3), used to assert API responses in integration tests. */
export const EXPECTED_ORDERS: SeedOrderExpectation[] = [
  { customerId: 'CUST-001', orderId: 'ORD-1001', status: 'DELIVERED', totalCents: 12_900, itemIds: ['ITM-1001-1'], damagedItemIds: ['ITM-1001-1'], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-002', orderId: 'ORD-1002', status: 'DELIVERED', totalCents: 8_900, itemIds: ['ITM-1002-1'], damagedItemIds: [], finalSaleItemIds: ['ITM-1002-1'], incorrectItemIds: [] },
  { customerId: 'CUST-003', orderId: 'ORD-1003', status: 'DELIVERED', totalCents: 90_000, itemIds: ['ITM-1003-1'], damagedItemIds: ['ITM-1003-1'], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-004', orderId: 'ORD-1004', status: 'DELIVERED', totalCents: 7_500, itemIds: ['ITM-1004-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-005', orderId: 'ORD-1005', status: 'DELIVERED', totalCents: 6_000, itemIds: ['ITM-1005-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: ['ITM-1005-1'] },
  { customerId: 'CUST-006', orderId: 'ORD-1006', status: 'DELIVERED', totalCents: 21_000, itemIds: ['ITM-1006-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-007', orderId: 'ORD-1007', status: 'DELIVERED', totalCents: 12_500, itemIds: ['ITM-1007-1', 'ITM-1007-2'], damagedItemIds: [], finalSaleItemIds: ['ITM-1007-2'], incorrectItemIds: [] },
  { customerId: 'CUST-008', orderId: 'ORD-1008', status: 'DELIVERED', totalCents: 50_000, itemIds: ['ITM-1008-1'], damagedItemIds: ['ITM-1008-1'], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-009', orderId: 'ORD-1009', status: 'DELIVERED', totalCents: 50_100, itemIds: ['ITM-1009-1'], damagedItemIds: ['ITM-1009-1'], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-010', orderId: 'ORD-1010', status: 'DELIVERED', totalCents: 11_000, itemIds: ['ITM-1010-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-010', orderId: 'ORD-1011', status: 'DELIVERED', totalCents: 3_200, itemIds: ['ITM-1011-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-011', orderId: 'ORD-1012', status: 'DELIVERED', totalCents: 9_900, itemIds: ['ITM-1012-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-012', orderId: 'ORD-1013', status: 'SHIPPED', totalCents: 14_900, itemIds: ['ITM-1013-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-013', orderId: 'ORD-1014', status: 'DELIVERED', totalCents: 25_000, itemIds: ['ITM-1014-1'], damagedItemIds: [], finalSaleItemIds: ['ITM-1014-1'], incorrectItemIds: [] },
  { customerId: 'CUST-014', orderId: 'ORD-1015', status: 'DELIVERED', totalCents: 6_300, itemIds: ['ITM-1015-1', 'ITM-1015-2'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
  { customerId: 'CUST-015', orderId: 'ORD-1016', status: 'DELIVERED', totalCents: 6_000, itemIds: ['ITM-1016-1'], damagedItemIds: [], finalSaleItemIds: [], incorrectItemIds: [] },
];

export function orderFor(customerId: string, orderId: string): SeedOrderExpectation {
  const found = EXPECTED_ORDERS.find((order) => order.customerId === customerId && order.orderId === orderId);
  if (found === undefined) throw new Error(`Unknown fixture order ${orderId} for ${customerId}`);
  return found;
}

export function ordersOf(customerId: string): SeedOrderExpectation[] {
  return EXPECTED_ORDERS.filter((order) => order.customerId === customerId);
}

export function toOrderSummaryDto(order: SeedOrderExpectation, now: Date): OrderSummary {
  return {
    id: order.orderId,
    orderDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: order.status,
    totalCents: order.totalCents,
    items: order.itemIds.map((itemId) => ({
      id: itemId,
      productName: `Item ${itemId}`,
      quantity: 1,
      priceCents: order.totalCents / order.itemIds.length,
      finalSale: order.finalSaleItemIds.includes(itemId),
      damaged: order.damagedItemIds.includes(itemId),
      incorrectItem: order.incorrectItemIds.includes(itemId),
    })),
  };
}
