import {
  AI_COMPOSE_MAX_TOKENS,
  AI_INTERPRET_MAX_TOKENS,
  AI_MAX_RETRIES,
  AI_RETRY_BASE_DELAY_MS,
  AUDIT_RAW_OUTPUT_MAX_LENGTH,
} from '../config/constants';
import { logger } from '../utils/logger';
import { AiError, aiInvalidOutput, aiProviderError, aiRateLimited, aiTimeout, aiUnavailable, truncateForAudit } from './aiErrors';
import { buildComposeUserPrompt, COMPOSE_SYSTEM_PROMPT } from './prompts/compose.system';
import { buildInterpretUserPrompt, INTERPRET_SYSTEM_PROMPT } from './prompts/interpret.system';
import { INTERPRETATION_JSON_SCHEMA, INTERPRETATION_TOOL_NAME, parseInterpretation } from './schemas/interpretation.schema';
import { COMPOSITION_JSON_SCHEMA, COMPOSITION_TOOL_NAME, parseComposition } from './schemas/composition.schema';
import type { AiProvider, ComposeInput, Composition, Interpretation, InterpretInput } from './ai.types';

export const PROVIDER_NAME = 'gemini';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini provider that speaks Google's OpenAI-compatible chat-completions surface,
 * so the same tool-calling prompt contracts (JSON schemas as function signatures)
 * work without vendor SDKs. Free-tier friendly: no subscription, just an API key.
 */

interface ToolCall {
  function?: { name?: string; arguments?: string };
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { tool_calls?: ToolCall[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface GeminiClientLike {
  chatCompletions(params: Record<string, unknown>): Promise<OpenAiChatResponse>;
}

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries?: number;
  baseUrl?: string;
  client?: GeminiClientLike;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name.includes('Timeout'))) {
    return aiTimeout(PROVIDER_NAME);
  }
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
  if (status === 429) return aiRateLimited(PROVIDER_NAME);
  const message = error instanceof Error ? error.message : 'Unknown provider error';
  return aiProviderError(PROVIDER_NAME, message.slice(0, 200));
}

function isRetryable(error: AiError): boolean {
  return error.kind === 'timeout' || error.kind === 'rate_limited' || error.kind === 'provider' || error.kind === 'unavailable';
}

function extractToolArguments(response: OpenAiChatResponse, toolName: string, provider: string): unknown {
  const call = response.choices?.[0]?.message?.tool_calls?.find((item) => item.function?.name === toolName);
  const rawArguments = call?.function?.arguments;
  if (!rawArguments) {
    throw aiInvalidOutput(provider, `No ${toolName} tool call in response`.slice(0, AUDIT_RAW_OUTPUT_MAX_LENGTH));
  }
  try {
    return JSON.parse(rawArguments) as unknown;
  } catch {
    throw aiInvalidOutput(provider, `Tool arguments were not valid JSON: ${rawArguments.slice(0, 200)}`);
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = PROVIDER_NAME;
  readonly model: string;

  private readonly client: GeminiClientLike | null;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: GeminiProviderOptions) {
    this.model = options.model;
    this.maxRetries = options.maxRetries ?? AI_MAX_RETRIES;
    this.sleep = options.sleep ?? defaultSleep;
    this.client = options.client ?? this.createClient();
  }

  private createClient(): GeminiClientLike | null {
    if (!this.options.apiKey) return null;
    const baseUrl = this.options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
    return {
      chatCompletions: async (params) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.apiKey}` },
            body: JSON.stringify(params),
            signal: controller.signal,
          });
          if (!response.ok) {
            const body = await response.text().catch(() => '');
            const error = new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 120)}`) as Error & { status?: number };
            error.status = response.status;
            throw error;
          }
          return (await response.json()) as OpenAiChatResponse;
        } finally {
          clearTimeout(timer);
        }
      },
    };
  }

  private async callWithRetry(params: Record<string, unknown>): Promise<OpenAiChatResponse> {
    if (!this.client) throw aiUnavailable(this.name, 'GEMINI_API_KEY is not configured.');
    let attempt = 0;
    let lastError: AiError = aiProviderError(this.name, 'The AI provider was never called.');
    while (attempt <= this.maxRetries) {
      const startedAt = Date.now();
      try {
        const response = await this.client.chatCompletions(params);
        logger.debug(
          { event: 'ai.call', provider: this.name, model: this.model, latencyMs: Date.now() - startedAt },
          'ai call completed',
        );
        return response;
      } catch (error) {
        lastError = toAiError(error);
        logger.warn(
          { event: 'ai.retry', provider: this.name, attempt, kind: lastError.kind, latencyMs: Date.now() - startedAt },
          'ai call failed',
        );
        if (attempt === this.maxRetries || !isRetryable(lastError)) break;
        await this.sleep(AI_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
      attempt += 1;
    }
    throw lastError;
  }

  async interpret(input: InterpretInput): Promise<Interpretation> {
    const response = await this.callWithRetry({
      model: this.model,
      max_tokens: AI_INTERPRET_MAX_TOKENS,
      temperature: 0,
      messages: [
        { role: 'system', content: INTERPRET_SYSTEM_PROMPT },
        { role: 'user', content: buildInterpretUserPrompt(input.message, input.items) },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: INTERPRETATION_TOOL_NAME,
            description: 'Submit the structured interpretation of the customer refund message.',
            parameters: INTERPRETATION_JSON_SCHEMA,
          },
        },
      ],
      tool_choice: 'required',
    });
    const raw = extractToolArguments(response, INTERPRETATION_TOOL_NAME, this.name);
    return parseInterpretation(raw, this.name);
  }

  async compose(input: ComposeInput): Promise<Composition> {
    const response = await this.callWithRetry({
      model: this.model,
      max_tokens: AI_COMPOSE_MAX_TOKENS,
      temperature: 0,
      messages: [
        { role: 'system', content: COMPOSE_SYSTEM_PROMPT },
        { role: 'user', content: buildComposeUserPrompt(input) },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: COMPOSITION_TOOL_NAME,
            description: 'Submit the customer-facing reply text.',
            parameters: COMPOSITION_JSON_SCHEMA,
          },
        },
      ],
      tool_choice: 'required',
    });
    const raw = extractToolArguments(response, COMPOSITION_TOOL_NAME, this.name);
    return parseComposition(raw, this.name);
  }

  static auditExcerpt(value: unknown): string {
    return truncateForAudit(value, AUDIT_RAW_OUTPUT_MAX_LENGTH);
  }
}
