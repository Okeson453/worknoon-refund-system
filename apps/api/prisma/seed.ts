/**
 * Synthetic CRM / order / refund seed data.
 *
 * Fifteen customers are created so that every policy branch has a ready-made demo case
 * (v1.1 §6.3). Order dates are relative to seed time, so the 30/31-day boundary cases stay
 * valid whenever the stack starts, and every write is an upsert keyed by the fixed ids, so
 * re-running the seed is safe.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { POLICY_RULES } from '@worknoon/shared-types';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, now: Date): Date {
  const date = new Date(now.getTime() - days * DAY_MS);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

interface SeedItem {
  id: string;
  productName: string;
  quantity: number;
  priceCents: number;
  finalSale?: boolean;
  damaged?: boolean;
  incorrectItem?: boolean;
}

interface SeedOrder {
  id: string;
  orderDaysAgo: number;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  items: SeedItem[];
}

interface SeedCustomer {
  id: string;
  name: string;
  orders: SeedOrder[];
  /** A pre-existing APPROVED refund, used by the already-refunded (D2) scenario. */
  priorRefund?: { orderId: string; itemId: string; message: string };
}

const CUSTOMERS: SeedCustomer[] = [
  {
    id: 'CUST-001',
    name: 'Amara Osei',
    orders: [
      {
        id: 'ORD-1001',
        orderDaysAgo: 7,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1001-1', productName: 'Studio Wireless Headphones', quantity: 1, priceCents: 12_900, damaged: true }],
      },
    ],
  },
  {
    id: 'CUST-002',
    name: 'Bruno Almeida',
    orders: [
      {
        id: 'ORD-1002',
        orderDaysAgo: 12,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1002-1', productName: 'Clearance Field Jacket', quantity: 1, priceCents: 8_900, finalSale: true }],
      },
    ],
  },
  {
    id: 'CUST-003',
    name: 'Chen Wei',
    orders: [
      {
        id: 'ORD-1003',
        orderDaysAgo: 4,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1003-1', productName: 'Pro 14 Ultrabook', quantity: 1, priceCents: 90_000, damaged: true }],
      },
    ],
  },
  {
    id: 'CUST-004',
    name: 'Dana Kowalski',
    orders: [
      {
        id: 'ORD-1004',
        orderDaysAgo: 45,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1004-1', productName: 'Everyday Court Sneakers', quantity: 1, priceCents: 7_500 }],
      },
    ],
  },
  {
    id: 'CUST-005',
    name: 'Elena Rossi',
    orders: [
      {
        id: 'ORD-1005',
        orderDaysAgo: 6,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1005-1', productName: 'Pulse Hand Blender', quantity: 1, priceCents: 6_000, incorrectItem: true }],
      },
    ],
  },
  {
    id: 'CUST-006',
    name: 'Farid Haddad',
    orders: [
      {
        id: 'ORD-1006',
        orderDaysAgo: 9,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1006-1', productName: 'Aura Fitness Watch', quantity: 1, priceCents: 21_000 }],
      },
    ],
  },
  {
    id: 'CUST-007',
    name: 'Grace Lindqvist',
    orders: [
      {
        id: 'ORD-1007',
        orderDaysAgo: 8,
        status: 'DELIVERED',
        items: [
          { id: 'ITM-1007-1', productName: 'Canvas Backpack', quantity: 1, priceCents: 8_000 },
          { id: 'ITM-1007-2', productName: 'Harbour Sunglasses', quantity: 1, priceCents: 4_500, finalSale: true },
        ],
      },
    ],
  },
  {
    id: 'CUST-008',
    name: 'Hiro Tanaka',
    orders: [
      {
        id: 'ORD-1008',
        orderDaysAgo: 5,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1008-1', productName: 'Vision 27 Monitor', quantity: 1, priceCents: 50_000, damaged: true }],
      },
    ],
  },
  {
    id: 'CUST-009',
    name: 'Ines Ferreira',
    orders: [
      {
        id: 'ORD-1009',
        orderDaysAgo: 5,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1009-1', productName: 'Slate 11 Tablet', quantity: 1, priceCents: 50_100, damaged: true }],
      },
    ],
  },
  {
    id: 'CUST-010',
    name: 'Jonas Berg',
    orders: [
      {
        id: 'ORD-1010',
        orderDaysAgo: 30,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1010-1', productName: 'Merino Crew Sweater', quantity: 1, priceCents: 11_000 }],
      },
      {
        id: 'ORD-1011',
        orderDaysAgo: 31,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1011-1', productName: 'Trail Running Cap', quantity: 1, priceCents: 3_200 }],
      },
    ],
  },
  {
    id: 'CUST-011',
    name: 'Kavya Iyer',
    orders: [
      {
        id: 'ORD-1012',
        orderDaysAgo: 15,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1012-1', productName: 'Ceramic Dinner Set', quantity: 1, priceCents: 9_900 }],
      },
    ],
    priorRefund: {
      orderId: 'ORD-1012',
      itemId: 'ITM-1012-1',
      message: 'The dinner set arrived chipped, so I would like my money back.',
    },
  },
  {
    id: 'CUST-012',
    name: 'Lucas Moreau',
    orders: [
      {
        id: 'ORD-1013',
        orderDaysAgo: 3,
        status: 'SHIPPED',
        items: [{ id: 'ITM-1013-1', productName: 'Noise Cancelling Earbuds', quantity: 1, priceCents: 14_900 }],
      },
    ],
  },
  {
    id: 'CUST-013',
    name: 'Maya Haddad',
    orders: [
      {
        id: 'ORD-1014',
        orderDaysAgo: 10,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1014-1', productName: 'Barista Espresso Machine', quantity: 1, priceCents: 25_000, finalSale: true }],
      },
    ],
  },
  {
    id: 'CUST-014',
    name: 'Noah Bennett',
    orders: [
      {
        id: 'ORD-1015',
        orderDaysAgo: 6,
        status: 'DELIVERED',
        items: [
          { id: 'ITM-1015-1', productName: 'Compact Travel Umbrella', quantity: 1, priceCents: 2_900 },
          { id: 'ITM-1015-2', productName: 'Insulated Water Bottle', quantity: 1, priceCents: 3_400 },
        ],
      },
    ],
  },
  {
    id: 'CUST-015',
    name: 'Olivia Novak',
    orders: [
      {
        id: 'ORD-1016',
        orderDaysAgo: 11,
        status: 'DELIVERED',
        items: [{ id: 'ITM-1016-1', productName: 'Linen Throw Blanket', quantity: 1, priceCents: 6_000 }],
      },
    ],
  },
];

export async function seedDatabase(now: Date = new Date()): Promise<void> {
  for (const customer of CUSTOMERS) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { name: customer.name },
      create: {
        id: customer.id,
        name: customer.name,
        email: `customer${customer.id.slice(-3).toLowerCase()}@example.test`,
        phone: null,
      },
    });

    for (const order of customer.orders) {
      const totalCents = order.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      await prisma.order.upsert({
        where: { id: order.id },
        update: { status: order.status, totalCents, orderDate: daysAgo(order.orderDaysAgo, now) },
        create: { id: order.id, customerId: customer.id, orderDate: daysAgo(order.orderDaysAgo, now), status: order.status, totalCents },
      });

      for (const item of order.items) {
        await prisma.orderItem.upsert({
          where: { id: item.id },
          update: {
            productName: item.productName,
            quantity: item.quantity,
            priceCents: item.priceCents,
            finalSale: item.finalSale ?? false,
            damaged: item.damaged ?? false,
            incorrectItem: item.incorrectItem ?? false,
          },
          create: {
            id: item.id,
            orderId: order.id,
            productName: item.productName,
            quantity: item.quantity,
            priceCents: item.priceCents,
            finalSale: item.finalSale ?? false,
            damaged: item.damaged ?? false,
            incorrectItem: item.incorrectItem ?? false,
          },
        });
      }
    }

    if (customer.priorRefund) {
      const { orderId, itemId, message } = customer.priorRefund;
      const order = customer.orders.find((candidate) => candidate.id === orderId);
      const item = order?.items.find((candidate) => candidate.id === itemId);
      if (order === undefined || item === undefined) throw new Error(`Seed priorRefund references unknown data for ${customer.id}`);

      const existing = await prisma.refundRequest.findFirst({
        where: { orderId, status: 'APPROVED', customerMessage: message },
        select: { id: true },
      });
      if (existing !== null) continue;

      const priorRequest = await prisma.refundRequest.create({
        data: {
          customerId: customer.id,
          orderId,
          customerMessage: message,
          status: 'APPROVED',
          detectedReason: 'DAMAGED',
          refundAmountCents: item.priceCents * item.quantity,
          decisionReasonCodes: [POLICY_RULES.A1],
          customerResponse: 'Your refund has been approved and returned to your original payment method.',
          aiUsed: true,
          aiInterpretation: {
            intent: 'refund_request',
            reason: 'DAMAGED',
            matchedItemIds: [itemId],
            claimedAmountCents: null,
            injectionSuspected: false,
            confidence: 0.95,
            summary: 'Seed record of an already refunded order.',
          },
          policyResult: {
            decision: 'APPROVED',
            refundAmountCents: item.priceCents * item.quantity,
            reasonCodes: [POLICY_RULES.A1],
            rules: [{ id: 'A1', code: POLICY_RULES.A1, category: 'APPROVAL', fired: true, detail: 'Damage is confirmed on the order record.' }],
          },
          items: { create: [{ orderItemId: itemId }] },
        },
        select: { id: true },
      });

      await prisma.auditEvent.createMany({
        data: [
          {
            refundRequestId: priorRequest.id,
            eventType: 'REQUEST_RECEIVED',
            actor: 'CUSTOMER',
            summary: 'Seeded historical refund request.',
            payload: { source: 'seed' },
          },
          {
            refundRequestId: priorRequest.id,
            eventType: 'DECISION_MADE',
            actor: 'POLICY_ENGINE',
            summary: 'Decision: APPROVED (seed history).',
            payload: { decision: 'APPROVED', source: 'seed' },
          },
        ],
      });
    }
  }
}

async function main(): Promise<void> {
  await seedDatabase();
  // eslint-disable-next-line no-console -- the seed is a CLI entry point and reports progress on stdout
  console.log(`Seeded ${CUSTOMERS.length} synthetic customers.`);
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error('Seed failed:', error instanceof Prisma.PrismaClientKnownRequestError ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
