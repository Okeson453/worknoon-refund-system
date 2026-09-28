import type {
  OrderStatus,
  PolicyRuleCategory,
  PolicyRuleId,
  RefundReason,
  RefundStatus,
} from '@worknoon/shared-types';

/**
 * Types accepted by the deterministic policy engine.
 * This module is pure: no Express, no Prisma, no AI provider, no clock or network access.
 * The clock is injected through `now` so every boundary is unit-testable.
 */

export interface PolicyOrderFact {
  status: OrderStatus;
  orderDate: Date;
}

export interface PolicyItemFact {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  finalSale: boolean;
  damaged: boolean;
  incorrectItem: boolean;
  previouslyRefunded: boolean;
}

/** The only channel through which untrusted AI output reaches the policy engine. */
export interface PolicySignals {
  reason: RefundReason;
  confidence: number;
  claimedAmountCents: number | null;
  suspicious: boolean;
  aiFailed: boolean;
  /** Item IDs the model identified as the subject of the complaint, already intersected with trusted IDs. */
  identifiedItemIds: string[];
}

export interface PolicyConfig {
  refundWindowDays: number;
  escalationThresholdCents: number;
  minConfidence: number;
}

export interface PolicyInput {
  now: Date;
  order: PolicyOrderFact;
  items: PolicyItemFact[];
  /** Number of items on the order, used by the ambiguity rule. */
  totalItemCount: number;
  signals: PolicySignals;
  config: PolicyConfig;
}

export interface PolicyCheck {
  id: PolicyRuleId;
  code: string;
  category: PolicyRuleCategory;
  fired: boolean;
  detail: string;
}

export interface PolicyResult {
  decision: RefundStatus;
  refundAmountCents: number;
  rules: PolicyCheck[];
  reasonCodes: string[];
}
