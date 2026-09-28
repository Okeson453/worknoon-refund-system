import { formatUsd } from '../../utils/currency';
import type { PolicyCheck, PolicyInput } from '../policy.types';
import { ruleCheck } from '../policyResult';

export interface EscalationContext {
  refundAmountCents: number;
}

/**
 * Escalation rules encode every condition that must stop an automatic approval.
 * Each of them can only move a request toward a human, never away (monotonic safety, spec §16).
 */
export function evaluateEscalationRules(input: PolicyInput, context: EscalationContext): PolicyCheck[] {
  const { signals, items, totalItemCount, config } = input;

  const e1 = ruleCheck(
    'E1',
    signals.suspicious,
    signals.suspicious
      ? 'Prompt-injection heuristics or the model flagged manipulation in the submitted text.'
      : 'No manipulation patterns detected in the submitted text.',
  );

  const unsupportedDamage = signals.reason === 'DAMAGED' && items.some((item) => !item.damaged);
  const unsupportedWrongItem = signals.reason === 'INCORRECT_ITEM' && items.some((item) => !item.incorrectItem);
  const amountMismatch =
    signals.claimedAmountCents !== null && signals.claimedAmountCents !== context.refundAmountCents;
  const e2Fired = unsupportedDamage || unsupportedWrongItem || amountMismatch;
  const e2Detail = amountMismatch
    ? `Customer claimed ${formatUsd(signals.claimedAmountCents ?? 0)} but the order record totals ${formatUsd(context.refundAmountCents)}.`
    : unsupportedDamage
      ? 'Damage is claimed but not confirmed on the order record.'
      : unsupportedWrongItem
        ? 'A wrong item is claimed but not confirmed on the order record.'
        : 'The claim matches the order record.';
  const e2 = ruleCheck('E2', e2Fired, e2Detail);

  const threshold = config.escalationThresholdCents;
  const e3 = ruleCheck(
    'E3',
    context.refundAmountCents > threshold,
    `Refund amount ${formatUsd(context.refundAmountCents)} against a human-review threshold of ${formatUsd(threshold)}.`,
  );

  const e4 = ruleCheck(
    'E4',
    totalItemCount > 1 && signals.identifiedItemIds.length === 0,
    totalItemCount > 1
      ? signals.identifiedItemIds.length === 0
        ? `Order has ${totalItemCount} items and the request does not identify which one is affected.`
        : `Order has ${totalItemCount} items; ${signals.identifiedItemIds.length} could be identified.`
      : `Order has a single item, so no ambiguity is possible.`,
  );

  const lowConfidence = signals.confidence < config.minConfidence;
  const unclearReason = signals.reason === 'OTHER' || signals.reason === 'UNCLEAR';
  const e5 = ruleCheck(
    'E5',
    unclearReason || lowConfidence,
    `Reason "${signals.reason}" with confidence ${signals.confidence.toFixed(2)} (minimum ${config.minConfidence}).`,
  );

  const e6 = ruleCheck(
    'E6',
    signals.aiFailed,
    signals.aiFailed
      ? 'The AI interpretation failed or returned output that failed schema validation.'
      : 'The AI interpretation succeeded.',
  );

  return [e1, e2, e3, e4, e5, e6];
}
