import type { AiIntent, RefundReason, RefundStatus } from '@worknoon/shared-types';

export interface InterpretItem {
  id: string;
  name: string;
}

/** Call 1 input: sanitized customer text plus item id/name pairs. Nothing else. */
export interface InterpretInput {
  message: string;
  items: InterpretItem[];
  requestId: string;
}

export interface Interpretation {
  intent: AiIntent;
  reason: RefundReason;
  matchedItemIds: string[];
  claimedAmountCents: number | null;
  injectionSuspected: boolean;
  confidence: number;
  summary: string;
}

/** Call 2 input: trusted structured fields only. Never the raw customer message. */
export interface ComposeInput {
  decision: RefundStatus;
  reasonCodes: string[];
  itemNames: string[];
  refundAmountCents: number;
  customerFirstName: string;
  requestId: string;
}

export interface Composition {
  message: string;
}

/**
 * The single seam between the application and any language model.
 * The return types are validated by the caller, never trusted by the type system alone.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  interpret(input: InterpretInput): Promise<Interpretation>;
  compose(input: ComposeInput): Promise<Composition>;
}
