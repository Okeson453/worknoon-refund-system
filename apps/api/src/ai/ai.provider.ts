import type { AiHealthState } from '@worknoon/shared-types';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AnthropicProvider, PROVIDER_NAME } from './anthropic.provider';
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

function createProvider(): AiProvider {
  if (env.AI_PROVIDER === 'mock') {
    logger.info({ event: 'ai.provider', provider: 'mock' }, 'using deterministic mock AI provider');
    return new MockProvider();
  }
  logger.info({ event: 'ai.provider', provider: PROVIDER_NAME, model: env.AI_MODEL }, 'using anthropic AI provider');
  return new AnthropicProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.AI_MODEL,
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
  const keyMissing = provider.name === PROVIDER_NAME && env.ANTHROPIC_API_KEY.length === 0;
  if (keyMissing || provider.name !== PROVIDER_NAME) {
    return { name: provider.name, model: provider.model, health: 'disabled' };
  }
  const failureAfterSuccess = lastFailureAt !== null && (lastSuccessAt === null || lastFailureAt > lastSuccessAt);
  return { name: provider.name, model: provider.model, health: failureAfterSuccess ? 'degraded' : 'enabled' };
}

export type { AiProvider } from './ai.types';
