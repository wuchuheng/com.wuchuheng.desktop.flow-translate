import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamChunk } from '@/shared/types';

const streamChat = vi.hoisted(() => vi.fn());
const findOneBy = vi.hoisted(() => vi.fn());
const createHistory = vi.hoisted(() => vi.fn());
const updateTransaction = vi.hoisted(() => vi.fn());
const clearDraftCache = vi.hoisted(() => vi.fn());

vi.mock('@/shared/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/constants')>();
  return { ...actual, PARSERS: { openai: { streamChat } } };
});

vi.mock('../../database/data-source', () => ({
  getDataSource: () => ({ getRepository: () => ({ findOneBy }) }),
}));

vi.mock('../../database/entities/config.entity', () => ({ Config: class Config {} }));
vi.mock('../../database/repositories/history.repository', () => ({ createHistory, updateTransaction }));
vi.mock('../draft/save.ipc', () => ({ clearDraftCache }));
vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../utils/win-api-helper', () => ({ pasteText: vi.fn(), restorePreviousWindow: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: (): never[] => [] } }));

import startTranslation, { onTranslateChunk } from './startTranslation.ipc';

const config = {
  providerId: 'openai',
  apiKey: 'test-key',
  model: 'test-model',
  enableThinking: true,
  systemPrompt: 'Translate {text}',
};

const streamOf = (...chunks: StreamChunk[]) =>
  (async function* () {
    yield* chunks;
  })();

describe('startTranslation', () => {
  const emitted: unknown[] = [];

  beforeEach(() => {
    emitted.length = 0;
    onTranslateChunk._setDispatcher?.(payload => emitted.push(payload));
    findOneBy.mockResolvedValue({ value: config });
    createHistory.mockResolvedValue(1);
    updateTransaction.mockResolvedValue(undefined);
    clearDraftCache.mockReset();
  });

  it('forwards provider-reported reasoning tokens in IPC stats', async () => {
    streamChat.mockReturnValue(streamOf({ content: 'Translated', usage: { reasoningTokens: 42 } }));

    await startTranslation({ text: 'Original', backspaceCount: 0, closeAfter: false });

    expect(emitted).toContainEqual({
      chunk: 'Translated',
      done: false,
      stats: { charsReceived: 10, completionTokens: undefined, promptTokens: undefined, reasoningTokens: 42 },
    });
  });

  it('forwards a classified fallback notice as a successful stream payload', async () => {
    streamChat.mockReturnValue(streamOf({ content: 'Translated', reasoningUnavailable: true }));

    await startTranslation({ text: 'Original', backspaceCount: 0, closeAfter: false });

    expect(emitted).toContainEqual({
      chunk: 'Translated',
      done: false,
      reasoningUnavailable: true,
      stats: { charsReceived: 10, completionTokens: undefined, promptTokens: undefined, reasoningTokens: undefined },
    });
    expect(emitted).not.toContainEqual(expect.objectContaining({ isError: true }));
  });

  it.each([
    ['profile-free request', { content: 'Translated' }],
    ['normal profiled request', { content: 'Translated', usage: { completionTokens: 3 } }],
  ])('omits the fallback notice for a %s', async (_description, chunk: StreamChunk) => {
    streamChat.mockReturnValue(streamOf(chunk));

    await startTranslation({ text: 'Original', backspaceCount: 0, closeAfter: false });

    expect(emitted).not.toContainEqual(expect.objectContaining({ reasoningUnavailable: true }));
  });
});
