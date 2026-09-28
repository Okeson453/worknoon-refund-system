import type { RefundStatus } from '@worknoon/shared-types';
import { formatUsd } from '../../utils/currency';
import { AI_COMPOSE_MAX_WORDS } from '../../config/constants';
import { describeReasonCodes } from '../../ai/prompts/compose.system';
import { isAiError, truncateForAudit } from '../../ai/aiErrors';
import { exceedsWordLimit } from '../../ai/schemas/composition.schema';
import type { AiProvider } from '../../ai/ai.types';

/**
 * Second half of the pipeline: turn a finished verdict into customer-facing text.
 * The composer only ever receives structured fields, and its output is verified before it is
 * shown. A failed verification is not an error — it silently falls back to a template.
 */

export interface DecisionCompositionInput {
  decision: RefundStatus;
  reasonCodes: string[];
  refundAmountCents: number;
  itemNames: string[];
  customerFirstName: string;
  requestId: string;
}

export interface DecisionComposition {
  customerMessage: string;
  source: 'ai' | 'template';
  fallbackReason: string | null;
  model: string;
}

const APPROVAL_CONTRADICTIONS = /\b(?:denied|rejected|escalat(?:ed|ing|ion))\b/i;
const DENIAL_CONTRADICTIONS = /\b(?:has been approved|refund (?:has been|was) issued|we have approved|is approved)\b/i;
const DOLLAR_FIGURE = /\$\s?(\d{1,9}(?:[.,]\d{1,2})?)/g;

export function templateResponse(input: DecisionCompositionInput): string {
  const firstName = input.customerFirstName || 'there';
  const items = input.itemNames.length > 0 ? input.itemNames.join(' and ') : 'your item';
  const amount = formatUsd(input.refundAmountCents);
  const reasons = describeReasonCodes(input.reasonCodes);
  const primaryReason = reasons[0] ?? 'it does not meet our refund policy';

  if (input.decision === 'APPROVED') {
    return (
      `Hi ${firstName}, thanks for letting us know about ${items}. Your refund of ${amount} has been approved and will be ` +
      `returned to your original payment method. We are sorry for the trouble and we appreciate your patience.`
    );
  }
  if (input.decision === 'DENIED') {
    return (
      `Hi ${firstName}, thank you for contacting us about ${items}. We reviewed your request and are not able to process ` +
      `this refund because ${primaryReason}. We appreciate you giving us the details anyway.`
    );
  }
  return (
    `Hi ${firstName}, thanks for your message about ${items}. A member of our support team is reviewing your request ` +
    `personally and will follow up with you by email. Nothing further is needed from you right now.`
  );
}

/**
 * Consistency check (spec §19 / v1.1 §8.4). The reply may never contradict the deterministic
 * decision and may never quote an amount other than the trusted one.
 */
export function checkCompositionConsistency(text: string, input: DecisionCompositionInput): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'empty composition';
  if (exceedsWordLimit(trimmed, AI_COMPOSE_MAX_WORDS)) return 'composition exceeds the word limit';
  if (input.decision !== 'APPROVED' && DENIAL_CONTRADICTIONS.test(trimmed)) return 'composition contradicts a non-approval decision';
  if (input.decision === 'APPROVED' && APPROVAL_CONTRADICTIONS.test(trimmed)) return 'composition contradicts an approval decision';

  for (const match of trimmed.matchAll(DOLLAR_FIGURE)) {
    const quoted = Math.round(Number.parseFloat(match[1].replace(',', '.')) * 100);
    if (quoted !== input.refundAmountCents) return 'composition quotes an amount that is not the trusted refund amount';
  }
  return null;
}

export async function composeCustomerResponse(
  input: DecisionCompositionInput,
  provider: AiProvider,
): Promise<DecisionComposition> {
  try {
    const composition = await provider.compose(input);
    const violation = checkCompositionConsistency(composition.message, input);
    if (violation) {
      return {
        customerMessage: templateResponse(input),
        source: 'template',
        fallbackReason: `${violation} (model output discarded: ${truncateForAudit(composition.message, 120)})`,
        model: provider.model,
      };
    }
    return { customerMessage: composition.message.trim(), source: 'ai', fallbackReason: null, model: provider.model };
  } catch (error) {
    return {
      customerMessage: templateResponse(input),
      source: 'template',
      fallbackReason: isAiError(error) ? `composer failed: ${error.kind}` : 'composer failed with an unexpected error',
      model: provider.model,
    };
  }
}
