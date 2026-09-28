import type { AiIntent, RefundReason } from '@worknoon/shared-types';
import { usdToCents } from '../utils/currency';
import { screenForInjection } from './injectionScreen';
import { describeReasonCodes } from './prompts/compose.system';
import type { AiProvider, ComposeInput, Composition, Interpretation, InterpretInput } from './ai.types';

/**
 * Deterministic provider used by the test suite and by no-key demo runs.
 * It classifies with fixed keyword rules, so the same input always produces the same
 * interpretation and the whole pipeline stays reproducible.
 */

const DAMAGE_PATTERN = /\b(damage|damaged|broken|cracked|defective|not working|stopped working|smashed|scratched|malfunction)\b/i;
const WRONG_ITEM_PATTERN = /\b(wrong item|incorrect item|not what i ordered|wrong (color|size|model)|mismatch|different item)\b/i;
const CHANGED_MIND_PATTERN = /\b(changed my mind|no longer (want|need)|don'?t (want|need)|do not (want|need)|ordered by mistake|return it because)\b/i;
const REFUND_INTENT_PATTERN = /\b(refund|return|reimburse|money back|send it back|exchange)\b/i;
const STATUS_INTENT_PATTERN = /\b(where is|status of|tracking|shipment|delivery date)\b/i;
const AMOUNT_PATTERN = /(?:\$\s?(\d{1,7}(?:[.,]\d{1,2})?)|(\d{1,7}(?:[.,]\d{1,2})?)\s*usd\b)/i;

function headNoun(name: string): string {
  const words = name.trim().toLowerCase().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  return last.length >= 4 ? last : name.trim().toLowerCase();
}

function matchItems(message: string, items: InterpretInput['items']): string[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [items[0].id];
  const haystack = message.toLowerCase();
  return items
    .filter((item) => {
      const name = item.name.toLowerCase();
      return haystack.includes(name) || haystack.includes(headNoun(item.name));
    })
    .map((item) => item.id);
}

export function detectReason(message: string): RefundReason {
  if (DAMAGE_PATTERN.test(message)) return 'DAMAGED';
  if (WRONG_ITEM_PATTERN.test(message)) return 'INCORRECT_ITEM';
  if (CHANGED_MIND_PATTERN.test(message)) return 'CHANGED_MIND';
  return 'UNCLEAR';
}

export function detectIntent(message: string): AiIntent {
  if (REFUND_INTENT_PATTERN.test(message)) return 'refund_request';
  if (STATUS_INTENT_PATTERN.test(message)) return 'status_inquiry';
  return 'other';
}

export function detectClaimedAmountCents(message: string): number | null {
  const match = AMOUNT_PATTERN.exec(message);
  if (!match) return null;
  const value = Number.parseFloat((match[1] ?? match[2]).replace(',', '.'));
  return Number.isFinite(value) ? usdToCents(value) : null;
}

const REASON_SUMMARY: Readonly<Record<RefundReason, string>> = {
  DAMAGED: 'reports a damaged or defective item',
  INCORRECT_ITEM: 'reports an incorrect item was delivered',
  CHANGED_MIND: 'no longer wants the item',
  OTHER: 'raises a refund request without a clear reason',
  UNCLEAR: 'does not state a clear refund reason',
};

export class MockProvider implements AiProvider {
  readonly name = 'mock';
  readonly model = 'mock-deterministic-v1';

  async interpret(input: InterpretInput): Promise<Interpretation> {
    const screen = screenForInjection(input.message);
    const reason = detectReason(input.message);
    const intent = detectIntent(input.message);
    const matchedItemIds = matchItems(input.message, input.items);
    const claimedAmountCents = detectClaimedAmountCents(input.message);
    const itemNames = input.items.filter((item) => matchedItemIds.includes(item.id)).map((item) => item.name);

    const confidence =
      reason === 'UNCLEAR' ? 0.35 : input.items.length > 1 && matchedItemIds.length === 0 ? 0.5 : 0.95;

    const summaryParts = [`Customer ${REASON_SUMMARY[reason]}`];
    summaryParts.push(itemNames.length > 0 ? `for ${itemNames.join(' and ')}.` : 'without naming a specific item.');
    if (claimedAmountCents !== null) {
      summaryParts.push(`Customer claims a refund of ${(claimedAmountCents / 100).toFixed(2)} USD.`);
    }

    return {
      intent,
      reason,
      matchedItemIds,
      claimedAmountCents,
      injectionSuspected: screen.suspicious,
      confidence,
      summary: summaryParts.join(' ').slice(0, 240),
    };
  }

  async compose(input: ComposeInput): Promise<Composition> {
    const items = input.itemNames.length > 0 ? input.itemNames.join(' and ') : 'your item';
    const reasons = describeReasonCodes(input.reasonCodes);
    const amount = (input.refundAmountCents / 100).toFixed(2);
    const firstName = input.customerFirstName || 'there';

    if (input.decision === 'APPROVED') {
      return {
        message:
          `Hi ${firstName}, thanks for letting us know about ${items}. Your refund of $${amount} has been approved and ` +
          `it will be returned to your original payment method. We are sorry for the trouble and appreciate your patience.`,
      };
    }
    if (input.decision === 'DENIED') {
      return {
        message:
          `Hi ${firstName}, thank you for contacting us about ${items}. We reviewed your request and are not able to ` +
          `process this refund because ${reasons[0] ?? 'it does not meet our refund policy'}. We appreciate you trying us.`,
      };
    }
    return {
      message:
        `Hi ${firstName}, thanks for your message about ${items}. A member of our support team is reviewing your ` +
        `request personally and will follow up by email. Nothing further is needed from you right now.`,
    };
  }
}
