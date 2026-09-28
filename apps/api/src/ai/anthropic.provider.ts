import Anthropic from '@anthropic-ai/sdk';
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
import { INTERPRETATION_JSON_SCHEMA, INTERPRETATION_TOOL_NAME } from './schemas/interpretation.schema';
import { parseInterpretation } from './schemas/interpretation.schema';
import { COMPOSITION_JSON_SCHEMA, COMPOSITION_TOOL_NAME, parseComposition } from './schemas/composition.schema';
import type { AiProvider, ComposeInput, Composition, Interpretation, InterpretInput } from './ai.types';

export const PROVIDER_NAME = 'anthropic';

interface ToolUseBlock {
  type: string;
  name?: string;
  input?: unknown;
}

interface AnthropicMessageResponse {
  content: ToolUseBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface AnthropicClientLike {
  messages: {
    create(params: Record<string, unknown>): Promise<AnthropicMessageResponse>;
  };
}

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries?: number;
  client?: AnthropicClientLike;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const name = error instanceof Error ? error.name : '';
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
  if (name.includes('Timeout') || name === 'AbortError') return aiTimeout(PROVIDER_NAME);
  if (status === 429) return aiRateLimited(PROVIDER_NAME);
  const message = error instanceof Error ? error.message : 'Unknown provider error';
  return aiProviderError(PROVIDER_NAME, message.slice(0, 200));
}

function isRetryable(error: AiError): boolean {
  return error.kind === 'timeout' || error.kind === 'rate_limited' || error.kind === 'provider' || error.kind === 'unavailable';
}

function extractToolInput(response: AnthropicMessageResponse, toolName: string, provider: string): unknown {
  const block = response.content.find((item) => item.type === 'tool_use' && item.name === toolName);
  if (!block) {
    const text = response.content
      .filter((item) => item.type === 'text')
      .map((item) => (item as { text?: string }).text ?? '')
      .join(' ')
      .slice(0, AUDIT_RAW_OUTPUT_MAX_LENGTH);
    throw aiInvalidOutput(provider, text || `No ${toolName} tool call in response (stop_reason=${response.stop_reason ?? 'unknown'})`);
  }
  return block.input;
}

export class AnthropicProvider implements AiProvider {
  readonly name = PROVIDER_NAME;
  readonly model: string;

  private readonly client: AnthropicClientLike | null;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.model = options.model;
    this.maxRetries = options.maxRetries ?? AI_MAX_RETRIES;
    this.sleep = options.sleep ?? defaultSleep;
    this.client = options.client ?? this.createClient();
  }

  private createClient(): AnthropicClientLike | null {
    if (!this.options.apiKey) return null;
    const anthropic = new Anthropic({
      apiKey: this.options.apiKey,
      timeout: this.options.timeoutMs,
      maxRetries: 0,
    });
    return {
      messages: {
        create: (params) => anthropic.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming),
      },
    };
  }

  private async callWithRetry(params: Record<string, unknown>): Promise<AnthropicMessageResponse> {
    if (!this.client) throw aiUnavailable(this.name, 'ANTHROPIC_API_KEY is not configured.');
    let attempt = 0;
    let lastError: AiError = aiProviderError(this.name, 'The AI provider was never called.');
    while (attempt <= this.maxRetries) {
      const startedAt = Date.now();
      try {
        const response = await this.client.messages.create(params);
        logger.debug(
          { event: 'ai.call', provider: this.name, model: this.model, tool: params.tool_choice, latencyMs: Date.now() - startedAt },
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
      system: INTERPRET_SYSTEM_PROMPT,
      tools: [
        {
          name: INTERPRETATION_TOOL_NAME,
          description: 'Submit the structured interpretation of the customer refund message.',
          input_schema: INTERPRETATION_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: INTERPRETATION_TOOL_NAME },
      messages: [{ role: 'user', content: buildInterpretUserPrompt(input.message, input.items) }],
    });
    const raw = extractToolInput(response, INTERPRETATION_TOOL_NAME, this.name);
    const interpretation = parseInterpretation(raw, this.name);
    logger.debug({ event: 'ai.usage', provider: this.name, ...response.usage }, 'ai token usage');
    return interpretation;
  }

  async compose(input: ComposeInput): Promise<Composition> {
    const response = await this.callWithRetry({
      model: this.model,
      max_tokens: AI_COMPOSE_MAX_TOKENS,
      temperature: 0,
      system: COMPOSE_SYSTEM_PROMPT,
      tools: [
        {
          name: COMPOSITION_TOOL_NAME,
          description: 'Submit the customer-facing reply text.',
          input_schema: COMPOSITION_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: COMPOSITION_TOOL_NAME },
      messages: [{ role: 'user', content: buildComposeUserPrompt(input) }],
    });
    const raw = extractToolInput(response, COMPOSITION_TOOL_NAME, this.name);
    return parseComposition(raw, this.name);
  }

  static auditExcerpt(value: unknown): string {
    return truncateForAudit(value, AUDIT_RAW_OUTPUT_MAX_LENGTH);
  }
}
