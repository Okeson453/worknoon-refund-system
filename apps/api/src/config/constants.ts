/** Non-negotiable, non-configurable limits. Anything environment driven lives in config/env.ts. */

export const API_PREFIX = '/api';

export const ID_MAX_LENGTH = 64;
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 1000;
export const MAX_ITEM_IDS_PER_REQUEST = 20;
export const MAX_INTERPRETATION_SUMMARY_LENGTH = 240;
export const MAX_COMPOSITION_MESSAGE_LENGTH = 600;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** v1.1 §10.1: per-IP limit on the customer submission endpoint. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 20;

/** v1.1 §8.3: one retry on 429 / 5xx / timeout for interpretation. */
export const AI_MAX_RETRIES = 1;
export const AI_INTERPRET_MAX_TOKENS = 500;
export const AI_COMPOSE_MAX_TOKENS = 300;
export const AI_COMPOSE_MAX_WORDS = 80;
export const AI_RETRY_BASE_DELAY_MS = 250;

/** Raw model output is never stored whole; the audit trail keeps a short, truncated sample. */
export const AUDIT_RAW_OUTPUT_MAX_LENGTH = 500;

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
