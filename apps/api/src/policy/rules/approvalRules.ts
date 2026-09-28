import type { PolicyCheck, PolicyInput } from '../policy.types';
import { ruleCheck } from '../policyResult';

/**
 * Approval rules only fire when the order record itself supports the claim.
 * Anything doubtful is handled by an escalation rule, which takes precedence.
 */
export function evaluateApprovalRules(input: PolicyInput): PolicyCheck[] {
  const { signals, items } = input;

  const damageConfirmed = signals.reason === 'DAMAGED' && items.length > 0 && items.every((item) => item.damaged);
  const wrongItemConfirmed = signals.reason === 'INCORRECT_ITEM' && items.length > 0 && items.every((item) => item.incorrectItem);
  const defectConfirmed = damageConfirmed || wrongItemConfirmed;

  const a1 = ruleCheck(
    'A1',
    defectConfirmed,
    damageConfirmed
      ? `Damage is confirmed on ${items.map((item) => item.name).join(', ')}.`
      : wrongItemConfirmed
        ? `A wrong-item shipment is confirmed on ${items.map((item) => item.name).join(', ')}.`
        : 'No verified defect is recorded for the selected items.',
  );

  const a2 = ruleCheck(
    'A2',
    signals.reason === 'CHANGED_MIND',
    signals.reason === 'CHANGED_MIND'
      ? 'Customer returned the item by choice inside the refund window.'
      : 'The request is not a change-of-mind return.',
  );

  return [a1, a2];
}
