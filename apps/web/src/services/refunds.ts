import { api } from './api';
import type { CreateRefundRequestInput, CreateRefundResponse, RefundRequestDetail, RefundRequestListResponse } from '../types/refund';
import type { RefundStatus } from '@worknoon/shared-types';

export function submitRefundRequest(input: CreateRefundRequestInput, signal?: AbortSignal): Promise<CreateRefundResponse> {
  return api.post<CreateRefundResponse>('/refunds', input, { signal });
}

export function listRefundRequests(
  params: { decision?: RefundStatus; page: number; limit: number },
  signal?: AbortSignal,
): Promise<RefundRequestListResponse> {
  return api.get<RefundRequestListResponse>('/refunds', {
    signal,
    query: { decision: params.decision, page: params.page, limit: params.limit },
  });
}

export function getRefundRequest(id: string, signal?: AbortSignal): Promise<RefundRequestDetail> {
  return api.get<RefundRequestDetail>(`/refunds/${encodeURIComponent(id)}`, { signal });
}
