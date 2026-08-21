import { createEvent } from '../../utils/ipc-helper';
import { logger } from '../../utils/logger';
import { pasteText, restorePreviousWindow } from '../../utils/win-api-helper';
import { BrowserWindow } from 'electron';
import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';
import { createHistory, updateTransaction } from '../../database/repositories/history.repository';
import { PARSERS, CONFIG_KEYS, AiConfig, DEFAULT_AI_CONFIG } from '@/shared/constants';
import { getProviderById, getBaseUrl } from '@/shared/ai-helper';
import { clearDraftCache } from '../draft/save.ipc';
import type { ChatRequest } from '@/shared/types';

export type TranslateChunkPayload = {
  chunk: string;
  done: boolean;
  isError?: boolean;
  reasoningUnavailable?: boolean;
  stats?: {
    charsReceived: number;
    completionTokens?: number;
    promptTokens?: number;
    reasoningTokens?: number;
  };
};

export const onTranslateChunk = createEvent<TranslateChunkPayload>();

const startTranslation = async (payload: { text: string; backspaceCount: number; closeAfter?: boolean }) => {
  const { text, closeAfter = true } = payload;

  let historyId: number | null = null;
  try {
    // 1. Create history record before AI call
    historyId = await createHistory(text);

    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.AI });
    const config = (configEntity?.value || {}) as AiConfig;
    const { apiKey, model, enableThinking, systemPrompt } = config;

    const provider = getProviderById(config.providerId);
    const parser = PARSERS[provider?.parser || 'openai'];
    const baseUrl = getBaseUrl(config);

    if (!baseUrl) {
      throw new Error(`Base URL not found for provider: ${config.providerId}`);
    }

    logger.info(`Starting translation: provider=${config.providerId}, model=${model}, thinking=${enableThinking}`);

    const promptTemplate = systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
    const messages: ChatRequest['messages'] = promptTemplate.includes('{text}')
      ? [{ role: 'user', content: promptTemplate.replace('{text}', text) }]
      : [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: `<content>\n${text}\n</content>` },
        ];

    const chatRequest: ChatRequest = {
      model: model || 'gpt-3.5-turbo',
      messages,
      enableThinking: !!enableThinking,
      providerId: config.providerId,
    };

    let fullTranslation = '';
    let totalChars = 0;
    let completionTokens: number | undefined;
    let promptTokens: number | undefined;
    let reasoningTokens: number | undefined;
    for await (const sc of parser.streamChat(baseUrl, apiKey || '', chatRequest)) {
      fullTranslation += sc.content;
      totalChars += sc.content.length;
      if (sc.usage?.completionTokens !== undefined) completionTokens = sc.usage.completionTokens;
      if (sc.usage?.promptTokens !== undefined) promptTokens = sc.usage.promptTokens;
      if (sc.usage?.reasoningTokens !== undefined) reasoningTokens = sc.usage.reasoningTokens;
      onTranslateChunk({
        chunk: sc.content,
        done: false,
        ...(sc.reasoningUnavailable ? { reasoningUnavailable: true } : {}),
        stats: { charsReceived: totalChars, completionTokens, promptTokens, reasoningTokens },
      });
    }

    onTranslateChunk({ chunk: '', done: true });

    // 2. Update history with transaction result
    if (historyId !== null) {
      await updateTransaction(historyId, fullTranslation);
    }

    clearDraftCache();

    if (closeAfter) {
      const wins = BrowserWindow.getAllWindows();
      const floatingWindow = wins.find(w => w.webContents.getURL().includes('flow-translate'));

      if (floatingWindow) {
        floatingWindow.hide();
      }

      await restorePreviousWindow();

      if (fullTranslation) {
        await pasteText(fullTranslation);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Translation failed: ${message}`);
    onTranslateChunk({ chunk: `Error: ${message}`, done: true, isError: true });
  }
};

export default startTranslation;
