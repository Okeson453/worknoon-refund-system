import { z } from 'zod';
import { LOG_LEVELS } from './constants';

/** Fails fast at boot: an invalid environment must stop the process, not surface at request time. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AI_PROVIDER: z.enum(['anthropic', 'mock']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().default(''),
  AI_MODEL: z.string().min(1).default('claude-sonnet-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).default(10_000),
  AI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
  REFUND_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  ESCALATION_THRESHOLD_USD: z.coerce.number().min(0).max(100_000).default(500),
  ADMIN_API_KEY: z.string().default(''),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n  - ${details.join('\n  - ')}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv(process.env);
