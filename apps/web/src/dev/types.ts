/**
 * Types shared between the recording overlay and the running app.
 *
 * This whole `dev/` subtree is a presenter aid for the screen-recorded walkthrough. It is only
 * mounted when `import.meta.env.DEV` is true, so it is tree-shaken out of `npm run build` and never
 * ships in the nginx image that reviewers run. Nothing in here participates in a refund decision.
 */

/**
 * Mirrors the API's RefundStatus. A request that reached the decision engine always ends on one of
 * the three terminal values; PENDING is unreachable through POST /api/refunds and is carried so the
 * overlay can take the API type directly rather than a cast that would hide a future status.
 */
export type DevDecision = 'APPROVED' | 'DENIED' | 'ESCALATED' | 'PENDING';

export type DevToastTone = 'success' | 'error' | 'info';

export interface DevTelemetry {
  /** Last decision the API returned, or null before the first request. */
  decision: DevDecision | null;
  amountCents: number | null;
  reference: string | null;
  /** Human-readable reason codes from the API response, already labelled. */
  reasons: string[];
  /** True when the request was refused before it reached the decision engine. */
  blocked: boolean;
  /** 1-based request counter, so the HUD makes it obvious a new decision landed. */
  submissionCount: number;
  /** Newest customer-visible message, used for the on-screen paraphrase card. */
  message: string | null;
}

export interface DevToastRecord {
  id: number;
  tone: DevToastTone;
  title: string;
  message: string;
}

export interface DevSessionState {
  telemetry: DevTelemetry;
  toasts: DevToastRecord[];
  /** Latest "what the policy sees" panel, as the presenter's pre-submission checklist. */
  context: string;
  record(toast: { tone: DevToastTone; title: string; message: string }): void;
  setContext(context: string): void;
  reportDecision(input: {
    decision: DevDecision;
    amountCents: number;
    reference: string;
    reasons: string[];
    message: string;
  }): void;
  reportBlocked(input: { message: string }): void;
  refresh(): void;
}

export const EMPTY_TELEMETRY: DevTelemetry = {
  decision: null,
  amountCents: null,
  reference: null,
  reasons: [],
  blocked: false,
  submissionCount: 0,
  message: null,
};
