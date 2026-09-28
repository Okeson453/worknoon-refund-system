import pino from 'pino';
import { env } from '../config/env';

/** Secrets and customer contact details never reach the log stream. */
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'authorization',
  'anthropicApiKey',
  'ANTHROPIC_API_KEY',
  'apiKey',
  'phone',
  'email',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'worknoon-refund-api' },
  redact: { paths: redactPaths, censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
