import { RULE_EVALUATION_ORDER } from './policy.constants';
import { buildPolicyResult, computeRefundAmountCents, resolveVerdict } from './policyResult';
import { evaluateApprovalRules } from './rules/approvalRules';
import { evaluateDenialRules } from './rules/denialRules';
import { evaluateEscalationRules } from './rules/escalationRules';
import type { PolicyCheck, PolicyInput, PolicyResult } from './policy.types';

/**
 * The single authoritative decision function.
 *
 * Pure: no I/O, no clock, no randomness, no database and no model access. Every rule is
 * evaluated (no short-circuiting) so the audit trail can show what did *not* fire either.
 * The returned decision can never be influenced by anything other than the passed facts.
 */
export function evaluateRefund(input: PolicyInput): PolicyResult {
  const refundAmountCents = computeRefundAmountCents(input.items);
  const evaluated = [
    ...evaluateDenialRules(input),
    ...evaluateEscalationRules(input, { refundAmountCents }),
    ...evaluateApprovalRules(input),
  ];

  // Report the rules in the order declared by the catalogue, so the audit trail is stable
  // regardless of the order in which the rule modules happen to be written.
  const byId = new Map(evaluated.map((check) => [check.id, check]));
  const checks = RULE_EVALUATION_ORDER.map((id) => byId.get(id)).filter(
    (check): check is PolicyCheck => check !== undefined,
  );

  return buildPolicyResult(checks, refundAmountCents);
}

export { resolveVerdict };
export type { PolicyInput, PolicyResult } from './policy.types';
