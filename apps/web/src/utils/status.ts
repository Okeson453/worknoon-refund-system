import type { OrderStatus, PolicyRuleCategory, RefundStatus } from '@worknoon/shared-types';

export type Tone = 'positive' | 'negative' | 'caution' | 'neutral' | 'info';

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Text glyph so the decision is never communicated by colour alone. */
  glyph: string;
  description: string;
}

export const REFUND_STATUS_META: Record<RefundStatus, StatusMeta> = {
  APPROVED: { label: 'Approved', tone: 'positive', glyph: '✓', description: 'The refund was approved automatically.' },
  DENIED: { label: 'Denied', tone: 'negative', glyph: '✕', description: 'The refund does not meet the refund policy.' },
  ESCALATED: { label: 'Escalated', tone: 'caution', glyph: '!', description: 'A support specialist will review the request.' },
  PENDING: { label: 'Pending', tone: 'info', glyph: '…', description: 'The request is still being processed.' },
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  DELIVERED: { label: 'Delivered', tone: 'positive' },
  SHIPPED: { label: 'Shipped', tone: 'info' },
  PROCESSING: { label: 'Processing', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'negative' },
};

export const CATEGORY_TONE: Record<PolicyRuleCategory, Tone> = {
  DENIAL: 'negative',
  ESCALATION: 'caution',
  APPROVAL: 'positive',
};

const REASON_CODE_LABELS: Record<string, string> = {
  ORDER_NOT_DELIVERED: 'Order not delivered',
  ALREADY_REFUNDED: 'Already refunded',
  FINAL_SALE: 'Final sale item',
  OUTSIDE_REFUND_WINDOW: 'Outside the refund window',
  SUSPICIOUS_INPUT: 'Suspicious input detected',
  CLAIM_CONTRADICTS_RECORDS: 'Claim contradicts the order record',
  OVER_REVIEW_THRESHOLD: 'Above the manual review threshold',
  ITEM_AMBIGUOUS: 'Requested item is ambiguous',
  REASON_UNCLEAR: 'Reason is unclear',
  AI_UNAVAILABLE: 'AI interpretation unavailable',
  VERIFIED_DEFECT: 'Verified defect',
  STANDARD_RETURN: 'Standard return',
  NO_APPROVABLE_REASON: 'No approving rule matched',
};

export function reasonCodeLabel(code: string): string {
  return REASON_CODE_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Damaged',
  INCORRECT_ITEM: 'Incorrect item',
  CHANGED_MIND: 'Changed mind',
  OTHER: 'Other',
  UNCLEAR: 'Unclear',
};

export function refundReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '—';
  return REASON_LABELS[reason] ?? reason;
}

export function refundStatusMeta(status: RefundStatus | string): StatusMeta {
  return REFUND_STATUS_META[status as RefundStatus] ?? { label: status, tone: 'neutral', glyph: '•', description: '' };
}
