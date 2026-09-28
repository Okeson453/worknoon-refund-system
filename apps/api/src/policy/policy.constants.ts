import { POLICY_RULE_DEFINITIONS } from '@worknoon/shared-types';
import type { PolicyRuleCategory, PolicyRuleDefinition, PolicyRuleId } from '@worknoon/shared-types';
import type { PolicyConfig } from './policy.types';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Defaults mirror policy/refund-policy.md. The unit test in tests/unit/policy/constants.test.ts
 * asserts that the documented numbers and these constants stay in sync.
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  refundWindowDays: 30,
  escalationThresholdCents: 50_000,
  minConfidence: 0.6,
};

/** Single source of truth for the rule catalogue: packages/shared-types. */
export const RULE_DEFINITIONS: Readonly<Record<PolicyRuleId, PolicyRuleDefinition>> = Object.fromEntries(
  POLICY_RULE_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<PolicyRuleId, PolicyRuleDefinition>;

/** Order of evaluation inside each category; also the order shown in the admin drawer. */
export const RULE_EVALUATION_ORDER: readonly PolicyRuleId[] = [
  'D1',
  'D2',
  'D3',
  'D4',
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'A1',
  'A2',
] as const;

/** Precedence: first category with at least one fired rule wins (spec §15). */
export const CATEGORY_PRECEDENCE: readonly PolicyRuleCategory[] = ['DENIAL', 'ESCALATION', 'APPROVAL'] as const;
