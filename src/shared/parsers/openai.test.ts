import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { ChatRequest } from '../types';

const completionCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: completionCreate } };
    models = { list: vi.fn() };
  },
}));

import { openaiParser } from './openai';

const requestFor = (providerId: string, model = 'test-model'): ChatRequest => ({
  model,
  providerId,
  enableThinking: true,
  messages: [{ role: 'user', content: 'Hello' }],
});

const emptyStream = {
  async *[Symbol.asyncIterator]() {},
};

const collect = async (request: ChatRequest, baseUrl = 'https://example.test/v1') => {
  const chunks = [];
  for await (const chunk of openaiParser.streamChat(baseUrl, 'test-key', request)) chunks.push(chunk);
  return chunks;
};

describe('openaiParser.streamChat', () => {
  beforeEach(() => {
    completionCreate.mockReset();
    completionCreate.mockResolvedValue(emptyStream);
  });

  it.each([
    ['OpenRouter', { reasoning: { effort: 'medium' } }],
    ['DeepSeek', { thinking: { type: 'enabled' } }],
    ['Qwen', { enable_thinking: true }],
    ['GLM', { thinking: { type: 'enabled' } }],
  ])('sends the supported reasoning request profile for %s', async (providerId, profileFields) => {
    await collect(requestFor(providerId));

    expect(completionCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model', ...profileFields }));
  });

  it.each(['custom', 'vLLM', 'llama.cpp'])('sends no reasoning fields for %s', async providerId => {
    await collect(requestFor(providerId));

    const payload = completionCreate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('reasoning');
    expect(payload).not.toHaveProperty('thinking');
    expect(payload).not.toHaveProperty('enable_thinking');
  });

  it('retries an unsupported reasoning target once without profile fields and caches the fallback', async () => {
    completionCreate
      .mockRejectedValueOnce({ status: 400, message: 'unsupported parameter enable_thinking' })
      .mockResolvedValue(emptyStream);
    const request = requestFor('qwen', 'fallback-model');
    const baseUrl = 'https://qwen.example/v1';

    await collect(request, baseUrl);

    expect(completionCreate).toHaveBeenCalledTimes(2);
    expect(completionCreate.mock.calls[0][0]).toMatchObject({ enable_thinking: true });
    expect(completionCreate.mock.calls[1][0]).not.toHaveProperty('reasoning');
    expect(completionCreate.mock.calls[1][0]).not.toHaveProperty('thinking');
    expect(completionCreate.mock.calls[1][0]).not.toHaveProperty('enable_thinking');

    completionCreate.mockClear();
    await collect(request, baseUrl);
    expect(completionCreate).toHaveBeenCalledTimes(1);
    expect(completionCreate.mock.calls[0][0]).not.toHaveProperty('enable_thinking');
  });

  it('marks only the first chunk after a classified reasoning fallback', async () => {
    completionCreate
      .mockRejectedValueOnce({ status: 400, message: 'unsupported parameter enable_thinking' })
      .mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'First' } }] };
          yield { choices: [{ delta: { content: 'Second' } }] };
        },
      });

    const chunks = await collect(requestFor('qwen', 'notice-model'), 'https://notice.example/v1');

    expect(chunks).toEqual([
      { content: 'First', usage: undefined, reasoningUnavailable: true },
      { content: 'Second', usage: undefined },
    ]);
  });

  it('does not mark a disabled reasoning request after a classified fallback retry', async () => {
    completionCreate
      .mockRejectedValueOnce({ status: 400, message: 'unsupported parameter enable_thinking' })
      .mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Translated' } }] };
        },
      });

    const chunks = await collect(
      { ...requestFor('qwen', 'disabled-fallback-model'), enableThinking: false },
      'https://disabled-fallback.example/v1'
    );

    expect(chunks).toEqual([{ content: 'Translated', usage: undefined }]);
    expect(completionCreate).toHaveBeenCalledTimes(2);
  });

  it('does not mark a cached reasoning fallback', async () => {
    completionCreate
      .mockRejectedValueOnce({ status: 400, message: 'unsupported parameter enable_thinking' })
      .mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Translated' } }] };
        },
      });
    const request = requestFor('qwen', 'cached-notice-model');
    const baseUrl = 'https://cached-notice.example/v1';

    await collect(request, baseUrl);
    const chunks = await collect(request, baseUrl);

    expect(chunks).toEqual([{ content: 'Translated', usage: undefined }]);
  });

  it.each([
    ['profile-free request', requestFor('custom', 'profile-free-model')],
    ['disabled reasoning request', { ...requestFor('qwen', 'disabled-model'), enableThinking: false }],
    ['normal profiled request', requestFor('qwen', 'normal-profile-model')],
  ])('does not mark a %s as reasoning unavailable', async (_description, request) => {
    completionCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'Translated' } }] };
      },
    });

    const chunks = await collect(request, `https://${request.model}.example/v1`);

    expect(chunks).toEqual([{ content: 'Translated', usage: undefined }]);
  });

  it.each([
    [{ completion_tokens_details: { reasoning_tokens: 7 } }, 7],
    [{ output_tokens_details: { thinking_tokens: 11 } }, 11],
    [{ completion_tokens: 3 }, undefined],
  ])('normalizes the supplied reasoning usage detail', async (usage, reasoningTokens) => {
    completionCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [] as ChatCompletionChunk['choices'],
          usage: { prompt_tokens: 2, completion_tokens: 3, ...usage },
        };
      },
    });

    const chunks = await collect(requestFor('custom'));

    expect(chunks).toEqual([{ content: '', usage: { promptTokens: 2, completionTokens: 3, reasoningTokens } }]);
  });
});
