import type { AiHealthState } from '@worknoon/shared-types';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AnthropicProvider, PROVIDER_NAME as ANTHROPIC_NAME } from './anthropic.provider';
import { GeminiProvider, GEMINI_DEFAULT_MODEL, PROVIDER_NAME as GEMINI_NAME } from './gemini.provider';
import { MockProvider } from './mock.provider';
import type { AiProvider } from './ai.types';

export interface AiProviderDescriptor {
  name: string;
  model: string;
  health: AiHealthState;
}

let cachedProvider: AiProvider | null = null;
let lastFailureAt: number | null = null;
let lastSuccessAt: number | null = null;

const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5';

function createProvider(): AiProvider {
  if (env.AI_PROVIDER === 'mock') {
    logger.info({ event: 'ai.provider', provider: 'mock' }, 'using deterministic mock AI provider');
    return new MockProvider();
  }
  if (env.AI_PROVIDER === GEMINI_NAME) {
    const model = env.AI_MODEL || GEMINI_DEFAULT_MODEL;
    logger.info({ event: 'ai.provider', provider: GEMINI_NAME, model }, 'using gemini AI provider');
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model,
      timeoutMs: env.AI_TIMEOUT_MS,
    });
  }
  const model = env.AI_MODEL || ANTHROPIC_DEFAULT_MODEL;
  logger.info({ event: 'ai.provider', provider: ANTHROPIC_NAME, model }, 'using anthropic AI provider');
  return new AnthropicProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    model,
    timeoutMs: env.AI_TIMEOUT_MS,
  });
}

export function getAiProvider(): AiProvider {
  if (cachedProvider === null) cachedProvider = createProvider();
  return cachedProvider;
}

export function markAiSuccess(): void {
  lastSuccessAt = Date.now();
  lastFailureAt = null;
}

export function markAiFailure(): void {
  lastFailureAt = Date.now();
}

export function describeAiProvider(): AiProviderDescriptor {
  const provider = getAiProvider();
  const keyMissing =
    (provider.name === ANTHROPIC_NAME && env.ANTHROPIC_API_KEY.length === 0) ||
    (provider.name === GEMINI_NAME && env.GEMINI_API_KEY.length === 0);
  if (keyMissing || provider.name === 'mock') {
    return { name: provider.name, model: provider.model, health: 'disabled' };
  }
  const failureAfterSuccess = lastFailureAt !== null && (lastSuccessAt === null || lastFailureAt > lastSuccessAt);
  return { name: provider.name, model: provider.model, health: failureAfterSuccess ? 'degraded' : 'enabled' };
}

export type { AiProvider } from './ai.types';
