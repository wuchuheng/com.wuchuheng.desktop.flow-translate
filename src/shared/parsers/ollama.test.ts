import { afterEach, describe, expect, it, vi } from 'vitest';
import { ollamaParser } from './ollama';

describe('ollamaParser.streamChat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits final native NDJSON token usage without inventing a reasoning count', async () => {
    const encoder = new TextEncoder();
    const responseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('{"message":{"content":""},"done":true,"prompt_eval_count":4,"eval_count":9}\n')
        );
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody, { status: 200 })));

    const chunks = [];
    for await (const chunk of ollamaParser.streamChat('http://ollama.test', '', {
      model: 'qwen3:latest',
      messages: [{ role: 'user', content: 'Hello' }],
      enableThinking: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        content: '',
        usage: { promptTokens: 4, completionTokens: 9, reasoningTokens: undefined },
      },
    ]);
  });
});
