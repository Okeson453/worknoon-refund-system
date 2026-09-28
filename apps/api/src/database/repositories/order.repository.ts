import type { OrderStatus } from '@prisma/client';
import { prisma } from '../prisma';

export interface OrderItemRecord {
  id: string;
  productName: string;
  quantity: number;
  priceCents: number;
  finalSale: boolean;
  damaged: boolean;
  incorrectItem: boolean;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  orderDate: Date;
  status: OrderStatus;
  totalCents: number;
  items: OrderItemRecord[];
}

const itemSelect = {
  id: true,
  productName: true,
  quantity: true,
  priceCents: true,
  finalSale: true,
  damaged: true,
  incorrectItem: true,
} as const;

/** Ownership is part of the lookup: an order that does not belong to the customer is not found. */
export async function findOrderForCustomer(customerId: string, orderId: string): Promise<OrderRecord | null> {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: {
      id: true,
      customerId: true,
      orderDate: true,
      status: true,
      totalCents: true,
      items: { select: itemSelect, orderBy: { id: 'asc' } },
    },
  });
}

export async function listOrdersForCustomer(customerId: string): Promise<OrderRecord[]> {
  return prisma.order.findMany({
    where: { customerId },
    select: {
      id: true,
      customerId: true,
      orderDate: true,
      status: true,
      totalCents: true,
      items: { select: itemSelect, orderBy: { id: 'asc' } },
    },
    orderBy: { orderDate: 'desc' },
  });
}

/**
 * Order items already covered by an APPROVED refund. Derived from the refund tables so there is
 * exactly one source of truth for "already refunded".
 */
export async function findRefundedItemIds(orderItemIds: readonly string[]): Promise<Set<string>> {
  if (orderItemIds.length === 0) return new Set();
  const links = await prisma.refundRequestItem.findMany({
    where: { orderItemId: { in: [...orderItemIds] }, refundRequest: { status: 'APPROVED' } },
    select: { orderItemId: true },
    distinct: ['orderItemId'],
  });
  return new Set(links.map((link) => link.orderItemId));
}
