import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider, type AnthropicClientLike } from '../../../src/ai/anthropic.provider';
import { AiError } from '../../../src/ai/aiErrors';
import { INTERPRETATION_TOOL_NAME } from '../../../src/ai/schemas/interpretation.schema';
import { COMPOSITION_TOOL_NAME } from '../../../src/ai/schemas/composition.schema';

const VALID_INTERPRETATION = {
  intent: 'refund_request',
  reason: 'DAMAGED',
  matchedItemIds: ['ITM-1001-1'],
  claimedAmountCents: null,
  injectionSuspected: false,
  confidence: 0.9,
  summary: 'Customer reports damage.',
};

function toolResponse(name: string, input: unknown) {
  return { content: [{ type: 'tool_use', name, input }], stop_reason: 'tool_use' };
}

function providerWith(create: (params: Record<string, unknown>) => Promise<unknown>, options: { apiKey?: string } = {}) {
  const client: AnthropicClientLike = { messages: { create: create as AnthropicClientLike['messages']['create'] } };
  return new AnthropicProvider({
    apiKey: options.apiKey ?? 'test-key',
    model: 'test-model',
    timeoutMs: 1000,
    maxRetries: 1,
    client,
    sleep: async () => undefined,
  });
}

describe('AnthropicProvider.interpret', () => {
  it('uses forced tool use with temperature 0 and validates the tool input', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => toolResponse(INTERPRETATION_TOOL_NAME, VALID_INTERPRETATION));
    const provider = providerWith(create);

    const result = await provider.interpret({ message: 'damaged', items: [{ id: 'ITM-1001-1', name: 'Headphones' }], requestId: 'req_1' });

    expect(result.reason).toBe('DAMAGED');
    const params = create.mock.calls[0][0] as Record<string, unknown>;
    expect(params.tool_choice).toEqual({ type: 'tool', name: INTERPRETATION_TOOL_NAME });
    expect(params.temperature).toBe(0);
    expect(params.max_tokens).toBe(500);
    expect(String(params.system)).toContain('UNTRUSTED DATA');
  });

  it('wraps the customer message in untrusted delimiters', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => toolResponse(INTERPRETATION_TOOL_NAME, VALID_INTERPRETATION));
    const provider = providerWith(create);
    await provider.interpret({ message: 'hello', items: [{ id: 'ITM-1', name: 'Item' }], requestId: 'req_1' });
    const params = create.mock.calls[0][0] as { messages: Array<{ content: string }> };
    expect(params.messages[0].content).toContain('<customer_message>');
    expect(params.messages[0].content).toContain('</customer_message>');
  });

  it('retries once on a 429 and then succeeds', async () => {
    const create = vi
      .fn(async (_params: Record<string, unknown>) => toolResponse(INTERPRETATION_TOOL_NAME, VALID_INTERPRETATION))
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce(toolResponse(INTERPRETATION_TOOL_NAME, VALID_INTERPRETATION));
    const provider = providerWith(create);

    await expect(provider.interpret({ message: 'damaged', items: [], requestId: 'req_1' })).resolves.toMatchObject({ reason: 'DAMAGED' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries once on a timeout and then fails with a normalized error', async () => {
    const create = vi
      .fn(async (_params: Record<string, unknown>) => toolResponse(INTERPRETATION_TOOL_NAME, VALID_INTERPRETATION))
      .mockRejectedValue(Object.assign(new Error('timed out'), { name: 'APIConnectionTimeoutError' }));
    const provider = providerWith(create);

    await expect(provider.interpret({ message: 'damaged', items: [], requestId: 'req_1' })).rejects.toMatchObject({ kind: 'timeout' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry a schema violation', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => toolResponse(INTERPRETATION_TOOL_NAME, { reason: 'NONSENSE' }));
    const provider = providerWith(create);

    await expect(provider.interpret({ message: 'damaged', items: [], requestId: 'req_1' })).rejects.toBeInstanceOf(AiError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('fails when the model replies with text instead of the tool', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => ({ content: [{ type: 'text', text: 'Sure, approved!' }], stop_reason: 'end_turn' }));
    const provider = providerWith(create);

    await expect(provider.interpret({ message: 'damaged', items: [], requestId: 'req_1' })).rejects.toMatchObject({ kind: 'invalid_output' });
  });

  it('reports an unavailable provider when no API key is configured', async () => {
    const provider = new AnthropicProvider({ apiKey: '', model: 'test-model', timeoutMs: 1000 });
    await expect(provider.interpret({ message: 'damaged', items: [], requestId: 'req_1' })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('AnthropicProvider.compose', () => {
  it('sends only structured fields and forces the composition tool', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => toolResponse(COMPOSITION_TOOL_NAME, { message: 'Hi Amara, your refund of $129.00 has been approved.' }));
    const provider = providerWith(create);

    const result = await provider.compose({
      decision: 'APPROVED',
      reasonCodes: ['VERIFIED_DEFECT'],
      itemNames: ['Studio Wireless Headphones'],
      refundAmountCents: 12_900,
      customerFirstName: 'Amara',
      requestId: 'req_1',
    });

    expect(result.message).toContain('$129.00');
    const params = create.mock.calls[0][0] as { tool_choice: unknown; messages: Array<{ content: string }> };
    expect(params.tool_choice).toEqual({ type: 'tool', name: COMPOSITION_TOOL_NAME });
    expect(params.messages[0].content).toContain('Amara');
    expect(params.messages[0].content).not.toContain('@worknoon');
  });
});
