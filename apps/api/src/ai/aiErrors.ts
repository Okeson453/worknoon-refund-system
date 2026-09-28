export type AiErrorKind = 'timeout' | 'rate_limited' | 'unavailable' | 'invalid_output' | 'provider';

/** Every AI failure is normalized so the policy engine can treat them identically. */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly provider: string;
  /** Short, non-sensitive excerpt kept for the audit trail. */
  readonly rawOutput?: string;

  constructor(kind: AiErrorKind, provider: string, message: string, rawOutput?: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.provider = provider;
    this.rawOutput = rawOutput;
  }
}

export function aiTimeout(provider: string): AiError {
  return new AiError('timeout', provider, 'The AI provider did not respond in time.');
}

export function aiRateLimited(provider: string): AiError {
  return new AiError('rate_limited', provider, 'The AI provider rate limited the request.');
}

export function aiUnavailable(provider: string, cause?: string): AiError {
  return new AiError('unavailable', provider, cause ?? 'The AI provider is not available.');
}

export function aiInvalidOutput(provider: string, rawOutput?: string): AiError {
  return new AiError('invalid_output', provider, 'The AI provider returned output that failed schema validation.', rawOutput);
}

export function aiProviderError(provider: string, message: string): AiError {
  return new AiError('provider', provider, message);
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

/** Truncates model output before it is persisted so audit rows stay small and safe. */
export function truncateForAudit(value: unknown, maxLength: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text;
}
