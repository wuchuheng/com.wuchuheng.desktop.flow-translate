import { createEvent } from '../../utils/ipc-helper';
import { logger } from '../../utils/logger';
import { pasteText, restorePreviousWindow } from '../../utils/win-api-helper';
import { BrowserWindow } from 'electron';
import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';
import OpenAI from 'openai';
import { AI_PROVIDER_CATALOG, CONFIG_KEYS, AiConfig, DEFAULT_AI_CONFIG } from '@/shared/constants';
import { Stream } from 'openai/streaming';
import { ChatCompletionChunk, ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { addThinkingArgument, cleanModelName } from '@/shared/ai-helper';

export const onTranslateChunk = createEvent<{ chunk: string; done: boolean; isError?: boolean }>();

const startTranslation = async (payload: { text: string; backspaceCount: number; closeAfter?: boolean }) => {
  const { text, closeAfter = true } = payload;

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

    const cleanedModel = cleanModelName(model || 'gpt-3.5-turbo');
    logger.info(`Starting translation with model: ${cleanedModel} (original: ${model})`);

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    const promptTemplate = systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (promptTemplate.includes('{text}')) {
      // If the template contains {text}, we treat it as a single user message for maximum compatibility
      messages = [{ role: 'user', content: promptTemplate.replace('{text}', text) }];
    } else {
      messages = [
        { role: 'system', content: promptTemplate },
        { role: 'user', content: `<content>\n${text}\n</content>` },
      ];
    }

    let requestConfig: Record<string, unknown> = {
      model: model || 'gpt-3.5-turbo',
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };

    requestConfig = addThinkingArgument(requestConfig, model, providerId, !!enableThinking);
    logger.info(`[AI Request Config]: ${JSON.stringify(requestConfig, null, 2)}`);

    const stream = (await client.chat.completions.create(
      requestConfig as unknown as ChatCompletionCreateParams
    )) as Stream<ChatCompletionChunk>;

    let fullTranslation = '';
    let totalUsage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | null = null;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullTranslation += content;
        onTranslateChunk({ chunk: content, done: false });
      }

      if (chunk.usage) {
        totalUsage = chunk.usage;
      }
    }

    if (totalUsage) {
      logger.info(
        `[AI Usage Summary]: Prompt: ${totalUsage.prompt_tokens}, Completion: ${totalUsage.completion_tokens}, Total: ${totalUsage.total_tokens}`
      );
    }

    onTranslateChunk({ chunk: '', done: true });

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
