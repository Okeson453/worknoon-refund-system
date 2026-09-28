/**
 * Layer 1 of the prompt-injection defense (spec §20): normalize, strip control and
 * zero-width characters, collapse whitespace. Never throws and never drops content
 * silently — the caller receives a change report for the audit trail.
 */

// eslint-disable-next-line no-control-regex -- matching control characters is exactly what this layer strips
const CONTROL_AND_ZERO_WIDTH = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
const EXCESS_WHITESPACE = /[ \t]{2,}/g;

export interface SanitizeResult {
  value: string;
  changed: boolean;
  removedCharacters: number;
  normalized: boolean;
}

export interface SanitizeOptions {
  maxLength?: number;
}

export function sanitizeMessage(input: string, options: SanitizeOptions = {}): SanitizeResult {
  const { maxLength } = options;
  const normalizedInput = input.normalize('NFKC');
  const normalized = normalizedInput !== input;

  const stripped = normalizedInput.replace(CONTROL_AND_ZERO_WIDTH, '');
  const removedCharacters = normalizedInput.length - stripped.length;

  const collapsed = stripped.replace(/\r\n?/g, '\n').replace(EXCESS_WHITESPACE, ' ').trim();

  const truncated = maxLength !== undefined && collapsed.length > maxLength ? collapsed.slice(0, maxLength) : collapsed;

  return {
    value: truncated,
    changed: normalized || removedCharacters > 0 || truncated !== collapsed || collapsed !== input,
    removedCharacters,
    normalized,
  };
}

/** Plain-text guard for anything that leaves the AI layer toward a customer. */
export function isPlainTextSafe(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}
