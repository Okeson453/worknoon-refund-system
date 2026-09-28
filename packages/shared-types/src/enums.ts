/**
 * Domain enums shared by the API and the web client.
 * Values are declared as const arrays so both sides use identical runtime values
 * while still exposing precise union types to the compiler.
 */

export const ORDER_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REFUND_STATUSES = ['PENDING', 'APPROVED', 'DENIED', 'ESCALATED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const AUDIT_ACTORS = ['CUSTOMER', 'SYSTEM', 'AI', 'POLICY_ENGINE', 'ADMIN'] as const;
export type AuditActor = (typeof AUDIT_ACTORS)[number];

export const AUDIT_EVENT_TYPES = [
  'REQUEST_RECEIVED',
  'INPUT_SCREENED',
  'AI_INTERPRETATION',
  'POLICY_EVALUATED',
  'DECISION_MADE',
  'AI_RESPONSE_GENERATED',
  'AI_FALLBACK_USED',
  'ERROR',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AI_INTENTS = ['refund_request', 'status_inquiry', 'other'] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

export const REFUND_REASONS = ['DAMAGED', 'INCORRECT_ITEM', 'CHANGED_MIND', 'OTHER', 'UNCLEAR'] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const AI_HEALTH_STATES = ['enabled', 'disabled', 'degraded'] as const;
export type AiHealthState = (typeof AI_HEALTH_STATES)[number];

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'NOT_FOUND',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Deterministic policy rule catalogue. Ids are stable; codes are the persisted reason codes. */
export const POLICY_RULES = {
  D1: 'ORDER_NOT_DELIVERED',
  D2: 'ALREADY_REFUNDED',
  D3: 'FINAL_SALE',
  D4: 'OUTSIDE_REFUND_WINDOW',
  E1: 'SUSPICIOUS_INPUT',
  E2: 'CLAIM_CONTRADICTS_RECORDS',
  E3: 'OVER_REVIEW_THRESHOLD',
  E4: 'ITEM_AMBIGUOUS',
  E5: 'REASON_UNCLEAR',
  E6: 'AI_UNAVAILABLE',
  A1: 'VERIFIED_DEFECT',
  A2: 'STANDARD_RETURN',
  X1: 'NO_APPROVABLE_REASON',
} as const;

export type PolicyRuleId = keyof typeof POLICY_RULES;
export type PolicyRuleCode = (typeof POLICY_RULES)[PolicyRuleId];

export type PolicyRuleCategory = 'DENIAL' | 'ESCALATION' | 'APPROVAL';

export interface PolicyRuleDefinition {
  readonly id: PolicyRuleId;
  readonly code: PolicyRuleCode;
  readonly category: PolicyRuleCategory;
  readonly title: string;
}

export const POLICY_RULE_DEFINITIONS: readonly PolicyRuleDefinition[] = [
  { id: 'D1', code: POLICY_RULES.D1, category: 'DENIAL', title: 'Order is not delivered' },
  { id: 'D2', code: POLICY_RULES.D2, category: 'DENIAL', title: 'Item already refunded' },
  { id: 'D3', code: POLICY_RULES.D3, category: 'DENIAL', title: 'Item is final sale' },
  { id: 'D4', code: POLICY_RULES.D4, category: 'DENIAL', title: 'Outside the refund window' },
  { id: 'E1', code: POLICY_RULES.E1, category: 'ESCALATION', title: 'Suspicious input detected' },
  { id: 'E2', code: POLICY_RULES.E2, category: 'ESCALATION', title: 'Claim contradicts records' },
  { id: 'E3', code: POLICY_RULES.E3, category: 'ESCALATION', title: 'Above the human-review threshold' },
  { id: 'E4', code: POLICY_RULES.E4, category: 'ESCALATION', title: 'Requested item is ambiguous' },
  { id: 'E5', code: POLICY_RULES.E5, category: 'ESCALATION', title: 'Reason is unclear' },
  { id: 'E6', code: POLICY_RULES.E6, category: 'ESCALATION', title: 'AI interpretation unavailable' },
  { id: 'A1', code: POLICY_RULES.A1, category: 'APPROVAL', title: 'Verified defect on the order record' },
  { id: 'A2', code: POLICY_RULES.A2, category: 'APPROVAL', title: 'Standard return inside the window' },
  { id: 'X1', code: POLICY_RULES.X1, category: 'ESCALATION', title: 'No approving rule matched' },
] as const;
