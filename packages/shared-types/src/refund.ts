import type {
  AiIntent,
  AuditActor,
  AuditEventType,
  OrderStatus,
  PolicyRuleCategory,
  PolicyRuleId,
  RefundReason,
  RefundStatus,
} from './enums';
import type { PagedResponse } from './api';

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface CustomerOrdersResponse {
  items: OrderSummary[];
}

export interface OrderSummary {
  id: string;
  orderDate: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItemDto[];
}

export interface OrderItemDto {
  id: string;
  productName: string;
  quantity: number;
  priceCents: number;
  finalSale: boolean;
  damaged: boolean;
  incorrectItem: boolean;
}

export interface CreateRefundRequestInput {
  customerId: string;
  orderId: string;
  itemIds: string[];
  message: string;
}

/** Customer-safe verdict returned by POST /api/refunds. Never contains internal reasoning. */
export interface CreateRefundResponse {
  id: string;
  decision: RefundStatus;
  refundAmountCents: number;
  customerMessage: string;
  reasonCodes: string[];
  createdAt: string;
}

export interface RefundRequestListItem {
  id: string;
  displayId: number;
  customerId: string;
  orderId: string;
  status: RefundStatus;
  refundAmountCents: number | null;
  detectedReason: RefundReason | null;
  aiUsed: boolean;
  suspicious: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyCheckDto {
  id: PolicyRuleId;
  code: string;
  category: PolicyRuleCategory;
  fired: boolean;
  detail: string;
}

export interface InterpretationDto {
  intent: AiIntent;
  reason: RefundReason;
  matchedItemIds: string[];
  claimedAmountCents: number | null;
  injectionSuspected: boolean;
  confidence: number;
  summary: string;
}

export interface RefundRequestDetail {
  id: string;
  displayId: number;
  customer: CustomerSummary;
  order: {
    id: string;
    status: OrderStatus;
    orderDate: string;
    totalCents: number;
  };
  items: OrderItemDto[];
  status: RefundStatus;
  detectedReason: RefundReason | null;
  customerMessage: string;
  refundAmountCents: number | null;
  decisionReasonCodes: string[];
  aiInterpretation: InterpretationDto | null;
  aiUsed: boolean;
  policyResult: {
    decision: RefundStatus;
    refundAmountCents: number;
    reasonCodes: string[];
    rules: PolicyCheckDto[];
  } | null;
  customerResponse: string | null;
  createdAt: string;
  updatedAt: string;
  audit: AuditEventDto[];
}

export interface AuditEventDto {
  id: string;
  eventType: AuditEventType;
  actor: AuditActor;
  summary: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummary {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  escalated: number;
  suspicious: number;
  aiFailures: number;
}

export type RefundRequestListResponse = PagedResponse<RefundRequestListItem>;
