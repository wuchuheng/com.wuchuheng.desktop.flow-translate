import { createEvent } from '../../utils/ipc-helper';
import { logger } from '../../utils/logger';
import { pasteText, restorePreviousWindow } from '../../utils/win-api-helper';
import { BrowserWindow } from 'electron';

export const onTranslateChunk = createEvent<{ chunk: string; done: boolean; isError?: boolean }>();

const startTranslation = async (payload: { text: string; backspaceCount: number }) => {
  const { text } = payload;
  const apiKey = process.env.ZHIPU_API_KEY;
  const model = process.env.ZHIPU_MODEL || 'glm-4-flash';
  const baseUrl = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

  if (!apiKey) {
    onTranslateChunk({ chunk: 'Error: ZHIPU_API_KEY not found in .env', done: true, isError: true });
    return;
  }

  try {
    logger.info(`Starting translation: "${text}"`);
    let fullTranslation = '';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        thinking: {
          type: "disabled"
        },
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator. Translate Chinese to English. Output ONLY the English translation.' 
          },
          { 
            role: 'user', 
            content: text 
          },
        ],
        stream: true,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      throw new Error(`API error: ${errorMsg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed to get reader');

    const decoder = new TextDecoder();
    let isDone = false;

    while (!isDone) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          isDone = true;
          break;
        }

        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content || '';
          if (content) {
            fullTranslation += content;
            onTranslateChunk({ chunk: content, done: false });
          }
        } catch (e) {
             // skip invalid json
        }
      }
    }

    onTranslateChunk({ chunk: '', done: true });

    // --- Backfill Logic ---
    const floatingWindow = BrowserWindow.getFocusedWindow();
    if (floatingWindow) {
      floatingWindow.hide(); // 1. Hide window
    }

    // 2. Forcefully restore focus to the original app (Word/Chrome/etc.)
    await restorePreviousWindow();

    // 3. Clear original content -> DISABLED (User input happens in popup, no need to delete target app content)
    // await prepareTargetApp(backspaceCount);

    // 4. Paste translation
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
