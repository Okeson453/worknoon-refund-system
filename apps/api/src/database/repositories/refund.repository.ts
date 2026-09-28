import { Prisma, type RefundStatus } from '@prisma/client';
import { prisma } from '../prisma';
import type { PrismaTransactionClient } from '../prisma';

export interface CreatePendingRequestInput {
  customerId: string;
  orderId: string;
  customerMessage: string;
  itemIds: string[];
}

export const refundRequestSelect = {
  id: true,
  displayId: true,
  customerId: true,
  orderId: true,
  customerMessage: true,
  status: true,
  detectedReason: true,
  refundAmountCents: true,
  decisionReasonCodes: true,
  customerResponse: true,
  aiInterpretation: true,
  policyResult: true,
  aiUsed: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type RefundRequestRecord = Prisma.RefundRequestGetPayload<{ select: typeof refundRequestSelect }>;

export interface FinalizeRequestInput {
  status: RefundStatus;
  detectedReason: string | null;
  refundAmountCents: number;
  decisionReasonCodes: string[];
  customerResponse: string;
  aiInterpretation: Prisma.InputJsonValue | null;
  policyResult: Prisma.InputJsonValue;
  aiUsed: boolean;
}

export async function createPendingRequest(input: CreatePendingRequestInput): Promise<RefundRequestRecord> {
  return prisma.refundRequest.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      customerMessage: input.customerMessage,
      status: 'PENDING',
      items: { create: input.itemIds.map((orderItemId) => ({ orderItemId })) },
    },
    select: refundRequestSelect,
  });
}

export async function finalizeRequest(
  tx: PrismaTransactionClient,
  id: string,
  data: FinalizeRequestInput,
): Promise<RefundRequestRecord> {
  return tx.refundRequest.update({
    where: { id },
    data: {
      status: data.status,
      detectedReason: data.detectedReason,
      refundAmountCents: data.refundAmountCents,
      decisionReasonCodes: data.decisionReasonCodes,
      customerResponse: data.customerResponse,
      aiInterpretation: data.aiInterpretation ?? Prisma.DbNull,
      policyResult: data.policyResult,
      aiUsed: data.aiUsed,
    },
    select: refundRequestSelect,
  });
}

export interface ListRequestsFilter {
  decision?: RefundStatus;
  page: number;
  limit: number;
}

export interface ListRequestsResult {
  items: Array<RefundRequestRecord & { suspicious: boolean }>;
  total: number;
}

export function isSuspiciousPolicyResult(policyResult: unknown): boolean {
  if (policyResult === null || typeof policyResult !== 'object') return false;
  const rules = (policyResult as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return false;
  return rules.some(
    (rule) =>
      typeof rule === 'object' &&
      rule !== null &&
      (rule as { id?: unknown }).id === 'E1' &&
      (rule as { fired?: unknown }).fired === true,
  );
}

export async function listRequests(filter: ListRequestsFilter): Promise<ListRequestsResult> {
  const where: Prisma.RefundRequestWhereInput = filter.decision ? { status: filter.decision } : {};
  const [records, total] = await prisma.$transaction([
    prisma.refundRequest.findMany({
      where,
      select: refundRequestSelect,
      orderBy: [{ createdAt: 'desc' }, { displayId: 'desc' }],
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.refundRequest.count({ where }),
  ]);
  return { items: records.map((record) => ({ ...record, suspicious: isSuspiciousPolicyResult(record.policyResult) })), total };
}

const detailInclude = {
  customer: { select: { id: true, name: true, email: true } },
  order: { select: { id: true, status: true, orderDate: true, totalCents: true } },
  items: {
    select: {
      orderItem: {
        select: { id: true, productName: true, quantity: true, priceCents: true, finalSale: true, damaged: true, incorrectItem: true },
      },
    },
  },
} satisfies Prisma.RefundRequestInclude;

export type RefundRequestDetailRecord = Prisma.RefundRequestGetPayload<{ include: typeof detailInclude }>;

export async function findRequestDetail(id: string): Promise<RefundRequestDetailRecord | null> {
  return prisma.refundRequest.findUnique({ where: { id }, include: detailInclude });
}

export interface DashboardCounts {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  escalated: number;
  suspicious: number;
  aiFailures: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [grouped, aiFailures, suspiciousRows] = await Promise.all([
    prisma.refundRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.refundRequest.count({ where: { aiUsed: false } }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM "refund_requests"
      WHERE "policyResult" @> ${JSON.stringify({ rules: [{ id: 'E1', fired: true }] })}::jsonb
    `),
  ]);

  const byStatus = new Map<string, number>(grouped.map((row) => [row.status, row._count._all]));
  const suspicious = Number(suspiciousRows[0]?.count ?? 0);

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    pending: byStatus.get('PENDING') ?? 0,
    approved: byStatus.get('APPROVED') ?? 0,
    denied: byStatus.get('DENIED') ?? 0,
    escalated: byStatus.get('ESCALATED') ?? 0,
    suspicious,
    aiFailures,
  };
}
