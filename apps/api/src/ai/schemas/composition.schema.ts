import { z } from 'zod';
import { MAX_COMPOSITION_MESSAGE_LENGTH, AI_COMPOSE_MAX_WORDS } from '../../config/constants';
import { aiInvalidOutput } from '../aiErrors';
import type { Composition } from '../ai.types';

export const compositionSchema = z
  .object({
    message: z.string().min(1).max(MAX_COMPOSITION_MESSAGE_LENGTH),
  })
  .strict();

export function parseComposition(raw: unknown, provider: string): Composition {
  const result = compositionSchema.safeParse(raw);
  if (!result.success) {
    throw aiInvalidOutput(provider, JSON.stringify(raw));
  }
  return { message: result.data.message.trim() };
}

export function exceedsWordLimit(message: string, maxWords = AI_COMPOSE_MAX_WORDS): boolean {
  return message.trim().split(/\s+/).filter(Boolean).length > maxWords;
}

export const COMPOSITION_TOOL_NAME = 'submit_composition';

export const COMPOSITION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: { type: 'string', maxLength: MAX_COMPOSITION_MESSAGE_LENGTH },
  },
} as const;
