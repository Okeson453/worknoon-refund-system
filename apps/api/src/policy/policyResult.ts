import { POLICY_RULES } from '@worknoon/shared-types';
import type { PolicyRuleCategory, PolicyRuleId, RefundStatus } from '@worknoon/shared-types';
import { CATEGORY_PRECEDENCE, RULE_DEFINITIONS } from './policy.constants';
import type { PolicyCheck, PolicyResult } from './policy.types';

export function ruleCheck(id: PolicyRuleId, fired: boolean, detail: string): PolicyCheck {
  const definition = RULE_DEFINITIONS[id];
  return { id, code: definition.code, category: definition.category, fired, detail };
}

export function firedChecks(checks: readonly PolicyCheck[]): PolicyCheck[] {
  return checks.filter((check) => check.fired);
}

/** Refund amount always comes from trusted price and quantity data, never from the request body. */
export function computeRefundAmountCents(items: ReadonlyArray<{ priceCents: number; quantity: number }>): number {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

function verdictForCategory(category: PolicyRuleCategory): RefundStatus {
  switch (category) {
    case 'DENIAL':
      return 'DENIED';
    case 'ESCALATION':
      return 'ESCALATED';
    case 'APPROVAL':
      return 'APPROVED';
  }
}

export interface ResolvedVerdict {
  decision: RefundStatus;
  reasonCodes: string[];
  determiningCategory: PolicyRuleCategory | 'DEFAULT_SAFE';
}

/**
 * Deterministic precedence (spec §15): any denial wins, otherwise any escalation, otherwise
 * any approval. When nothing fired at all the request is escalated rather than approved —
 * the system can never approve by accident.
 */
export function resolveVerdict(checks: readonly PolicyCheck[]): ResolvedVerdict {
  for (const category of CATEGORY_PRECEDENCE) {
    const fired = firedChecks(checks).filter((check) => check.category === category);
    if (fired.length > 0) {
      return { decision: verdictForCategory(category), reasonCodes: fired.map((check) => check.code), determiningCategory: category };
    }
  }
  return { decision: 'ESCALATED', reasonCodes: [POLICY_RULES.X1], determiningCategory: 'DEFAULT_SAFE' };
}

export function buildPolicyResult(checks: readonly PolicyCheck[], refundAmountCents: number): PolicyResult {
  const { decision, reasonCodes } = resolveVerdict(checks);
  return { decision, refundAmountCents, rules: [...checks], reasonCodes };
}
