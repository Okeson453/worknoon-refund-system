import type { RefundRequestListItem, RefundRequestListResponse, RefundReason } from '@worknoon/shared-types';
import { listRequests } from '../../database/repositories/refund.repository';
import type { ListRefundRequestsQuery } from '../../validation/refund.schemas';
import { buildPagination } from '../../validation/pagination.schemas';

export async function listRefundRequests(query: ListRefundRequestsQuery): Promise<RefundRequestListResponse> {
  const { items, total } = await listRequests({
    decision: query.decision,
    page: query.page,
    limit: query.limit,
  });

  const mapped: RefundRequestListItem[] = items.map((item) => ({
    id: item.id,
    displayId: item.displayId,
    customerId: item.customerId,
    orderId: item.orderId,
    status: item.status,
    refundAmountCents: item.refundAmountCents,
    detectedReason: (item.detectedReason as RefundReason | null) ?? null,
    aiUsed: item.aiUsed,
    suspicious: item.suspicious,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return { items: mapped, pagination: buildPagination(query.page, query.limit, total) };
}
