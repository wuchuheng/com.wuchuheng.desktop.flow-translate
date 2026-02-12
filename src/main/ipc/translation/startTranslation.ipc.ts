import { createEvent } from '../../utils/ipc-helper';
import { logger } from '../../utils/logger';
import { pasteText, restorePreviousWindow } from '../../utils/win-api-helper';
import { BrowserWindow } from 'electron';
import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';
import OpenAI from 'openai';
import { AI_PROVIDER_CATALOG, CONFIG_KEYS, AiConfig } from '../../../shared/constants';
import { Stream } from 'openai/streaming';
import { ChatCompletionChunk, ChatCompletionCreateParams } from 'openai/resources/chat/completions';

export const onTranslateChunk = createEvent<{ chunk: string; done: boolean; isError?: boolean }>();

const startTranslation = async (payload: { text: string; backspaceCount: number }) => {
  const { text } = payload;

  try {
    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.AI });
    const config = (configEntity?.value || {}) as AiConfig;

    const { providerId, apiKey, model, customBaseUrl, enableThinking, systemPrompt } = config;

    if (!apiKey) {
      throw new Error('API Key not configured. Please check Settings.');
    }

    const currentProvider = AI_PROVIDER_CATALOG.find(p => p.id === providerId);
    const baseUrl = providerId === 'custom' ? customBaseUrl : currentProvider?.baseUrl;

    if (!baseUrl) {
      throw new Error(`Base URL not found for provider: ${providerId}`);
    }

    logger.info(`Starting translation with model: ${model}`);

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    let thinkingParams = {};
    if (currentProvider?.thinkingConfig) {
      thinkingParams = enableThinking ? currentProvider.thinkingConfig.enable : currentProvider.thinkingConfig.disable;
    }

    const defaultPrompt =
      'You are a professional translator. Translate Chinese to English. Output ONLY the English translation.';
    const promptTemplate = systemPrompt || defaultPrompt;
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (promptTemplate.includes('{text}')) {
      messages = [{ role: 'system', content: promptTemplate.replace('{text}', text) }];
    } else {
      messages = [
        { role: 'system', content: promptTemplate },
        { role: 'user', content: text },
      ];
    }

    const params: ChatCompletionCreateParams = {
      model: model || 'gpt-3.5-turbo',
      messages,
      stream: true,
      ...thinkingParams,
    } as ChatCompletionCreateParams;

    const stream = (await client.chat.completions.create(params)) as Stream<ChatCompletionChunk>;

    let fullTranslation = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullTranslation += content;
        onTranslateChunk({ chunk: content, done: false });
      }
    }

    onTranslateChunk({ chunk: '', done: true });

    const wins = BrowserWindow.getAllWindows();
    const floatingWindow = wins.find(w => w.webContents.getURL().includes('flow-translate'));

    if (floatingWindow) {
      floatingWindow.hide();
    }

    await restorePreviousWindow();

    if (fullTranslation) {
      await pasteText(fullTranslation);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Translation failed: ${message}`);
    onTranslateChunk({ chunk: `Error: ${message}`, done: true, isError: true });
  }
};

export default startTranslation;
