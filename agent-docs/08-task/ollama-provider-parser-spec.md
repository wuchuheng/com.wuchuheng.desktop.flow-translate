<!--
TEMPLATE MAP (reference-only)
$CLAUDE_CONFIG_DIR/templates/docs/spec.md

OUTPUT MAP (write to)
./agent-docs/08-task/ollama-provider-parser-spec.md
-->

# Spec: Ollama Provider Parser Architecture

## Overview

Refactor the AI provider system to support multiple API types through a parser pattern. This enables Ollama's native API support while maintaining the existing OpenAI-compatible implementation.

## Problem Statement

- Ollama's thinking feature (`think: true/false`) is **only supported in the native API** (`/api/chat`), not the OpenAI-compatible endpoint (`/v1/chat/completions`)
- Current architecture tightly couples provider config to OpenAI SDK
- Need extensible design for future API types (Anthropic, Cohere, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AiProviderParser Interface                       │
├─────────────────────────────────────────────────────────────────────┤
│  + fetchModels(baseUrl, apiKey?): Promise<string[]>                 │
│  + streamChat(baseUrl, apiKey, request): AsyncGenerator<string>     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ implements
          ┌───────────────────┴───────────────────┐
          │                                       │
┌─────────────────────┐               ┌─────────────────────┐
│ OpenAICompatibleParser            │ OllamaParser         │
├─────────────────────┤               ├─────────────────────┤
│ - Uses OpenAI SDK   │               │ - Uses native API   │
│ - Endpoint: /v1/*   │               │ - Endpoint: /api/*  │
│ - SSE streaming     │               │ - NDJSON streaming  │
└─────────────────────┘               └─────────────────────┘
```

## File Structure

```
src/shared/
├── constants.ts          # Provider catalog + PARSERS mapping
├── types.ts              # ChatRequest, ParserType, AiProviderParser interface
└── parsers/
    ├── openai.ts         # OpenAI SDK implementation
    └── ollama.ts         # Native Ollama implementation
```

## Type Definitions

### `src/shared/types.ts`

```typescript
/**
 * Supported API parser types
 */
export type ParserType = 'openai' | 'ollama';

/**
 * Chat request structure (normalized across all parsers)
 */
export type ChatRequest = {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  enableThinking: boolean;
};

/**
 * Provider parser interface
 * Each parser handles API communication for a specific provider type
 */
export interface AiProviderParser {
  /**
   * Fetch available models from the provider
   * @param baseUrl - API base URL
   * @param apiKey - Optional API key (some providers don't require it)
   * @returns Array of model identifiers
   */
  fetchModels(baseUrl: string, apiKey?: string): Promise<string[]>;

  /**
   * Stream chat completion
   * @param baseUrl - API base URL
   * @param apiKey - API key
   * @param request - Normalized chat request
   * @yields Content chunks as they arrive
   */
  streamChat(
    baseUrl: string,
    apiKey: string,
    request: ChatRequest
  ): AsyncGenerator<string>;
}
```

## Provider Config Update

### `src/shared/constants.ts`

```typescript
import type { ParserType } from './types';
import { openaiParser } from './parsers/openai';
import { ollamaParser } from './parsers/ollama';

export type AiProviderConfig = {
  id: string;
  name: string;
  baseUrl?: string;
  docsUrl?: string;
  allowCustomBaseUrl?: boolean;
  thinkingConfig?: {
    enable: Record<string, unknown>;
    disable: Record<string, unknown>;
  };
  parser: ParserType;  // NEW: which parser to use
};

/**
 * Parser registry - maps parser type to implementation
 */
export const PARSERS = {
  openai: openaiParser,
  ollama: ollamaParser,
} as const;

export const AI_PROVIDER_CATALOG: AiProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    parser: 'openai',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs',
    parser: 'openai',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai/docs/introduction',
    parser: 'openai',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://docs.mistral.ai/',
    parser: 'openai',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs/openai',
    parser: 'openai',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    docsUrl: 'https://docs.fireworks.ai/api-reference/introduction',
    parser: 'openai',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek(深度求索)',
    baseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com/',
    parser: 'openai',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    docsUrl: 'https://inference-docs.cerebras.ai/',
    parser: 'openai',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    docsUrl: 'https://docs.perplexity.ai/',
    parser: 'openai',
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM(智谱)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    parser: 'openai',
    thinkingConfig: {
      enable: { thinking: { type: 'enabled' } },
      disable: { thinking: { type: 'disabled' } },
    },
  },
  {
    id: 'qwen',
    name: 'Qwen (千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api',
    parser: 'openai',
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    docsUrl: 'https://platform.moonshot.cn/docs/api/chat-completion',
    parser: 'openai',
  },
  {
    id: 'minimax',
    name: 'Minimax',
    baseUrl: 'https://api.minimax.io/v1',
    docsUrl: 'https://platform.minimaxi.com/',
    parser: 'openai',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    allowCustomBaseUrl: true,
    parser: 'ollama',
    thinkingConfig: {
      enable: { think: true },
      disable: { think: false },
    },
  },
  {
    id: 'custom',
    name: 'OpenAI compatible (custom)',
    allowCustomBaseUrl: true,
    parser: 'openai',
  },
];
```

## Parser Implementations

### `src/shared/parsers/openai.ts`

```typescript
import OpenAI from 'openai';
import type { AiProviderParser, ChatRequest } from '../types';
import { addThinkingArgument } from '../ai-helper';

export const openaiParser: AiProviderParser = {
  async fetchModels(baseUrl: string, apiKey?: string): Promise<string[]> {
    if (!apiKey) return [];

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      dangerouslyAllowBrowser: true,
    });

    const list = await client.models.list();
    return list.data.map(m => m.id);
  },

  async *streamChat(
    baseUrl: string,
    apiKey: string,
    request: ChatRequest
  ): AsyncGenerator<string> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    let requestConfig: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
    };

    // Apply thinking config if provider supports it (handled by addThinkingArgument)
    requestConfig = addThinkingArgument(
      requestConfig,
      request.model,
      undefined, // providerId not needed here, thinkingConfig applied at caller level
      request.enableThinking
    );

    const stream = await client.chat.completions.create(
      requestConfig as OpenAI.Chat.ChatCompletionCreateParams
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) yield content;
    }
  },
};
```

### `src/shared/parsers/ollama.ts`

```typescript
import type { AiProviderParser, ChatRequest } from '../types';

/**
 * Ollama native API parser
 * - Uses OpenAI-compatible endpoint for model listing
 * - Uses native /api/chat for chat (supports thinking feature)
 */
export const ollamaParser: AiProviderParser = {
  async fetchModels(baseUrl: string): Promise<string[]> {
    // Ollama exposes OpenAI-compatible /v1/models endpoint
    const response = await fetch(`${baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  },

  async *streamChat(
    baseUrl: string,
    _apiKey: string, // Ollama doesn't require API key, but kept for interface consistency
    request: ChatRequest
  ): AsyncGenerator<string> {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        think: request.enableThinking,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);

            // Yield content if present
            if (chunk.message?.content) {
              yield chunk.message.content;
            }

            // Check for stream end
            if (chunk.done) {
              return;
            }
          } catch {
            // Skip malformed JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
```

## Usage Updates

### `src/renderer/hooks/useOpenAI.ts`

```typescript
import { AI_PROVIDER_CATALOG, PARSERS, AiConfig } from '@/shared/constants';

export const useOpenAI = () => {
  // ... existing state ...

  const fetchModels = useCallback(async (values: AiConfig) => {
    try {
      setFetchingModels(true);

      const provider = AI_PROVIDER_CATALOG.find(p => p.id === values.providerId);
      const baseUrl = values.customBaseUrl || provider?.baseUrl;
      const parser = PARSERS[provider?.parser || 'openai'];

      const models = await parser.fetchModels(baseUrl || '', values.apiKey);
      const options = models.map(m => ({ value: m }));
      setModelOptions(options);
      return options;
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      message.error(`Failed to fetch models: ${msg}`);
      return [];
    } finally {
      setFetchingModels(false);
    }
  }, []);

  // Remove createClient if only used for fetchModels
  // Or keep for test playground in AiSettingsTab

  return { fetchingModels, modelOptions, fetchModels };
};
```

### `src/main/ipc/translation/startTranslation.ipc.ts`

```typescript
import { AI_PROVIDER_CATALOG, PARSERS, CONFIG_KEYS, AiConfig, DEFAULT_AI_CONFIG } from '@/shared/constants';
import type { ChatRequest } from '@/shared/types';

const startTranslation = async (payload: { text: string; backspaceCount: number; closeAfter?: boolean }) => {
  const { text, closeAfter = true } = payload;

  try {
    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.AI });
    const config = (configEntity?.value || {}) as AiConfig;

    const { providerId, apiKey, model, customBaseUrl, enableThinking, systemPrompt } = config;

    // Get provider and parser
    const provider = AI_PROVIDER_CATALOG.find(p => p.id === providerId);
    const parser = PARSERS[provider?.parser || 'openai'];
    const baseUrl = customBaseUrl || provider?.baseUrl;

    if (!baseUrl) {
      throw new Error(`Base URL not found for provider: ${providerId}`);
    }

    // Build messages
    const promptTemplate = systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
    let messages: ChatRequest['messages'] = [];

    if (promptTemplate.includes('{text}')) {
      messages = [{ role: 'user', content: promptTemplate.replace('{text}', text) }];
    } else {
      messages = [
        { role: 'system', content: promptTemplate },
        { role: 'user', content: `<content>\n${text}\n</content>` },
      ];
    }

    // Build chat request
    const chatRequest: ChatRequest = {
      model: model || 'gpt-3.5-turbo',
      messages,
      enableThinking: !!enableThinking,
    };

    logger.info(`[AI Request]: provider=${providerId}, model=${chatRequest.model}, thinking=${enableThinking}`);

    // Stream chat using parser
    let fullTranslation = '';

    for await (const chunk of parser.streamChat(baseUrl, apiKey || '', chatRequest)) {
      fullTranslation += chunk;
      onTranslateChunk({ chunk, done: false });
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
```

### `src/renderer/pages/Settings/components/AiSettingsTab.tsx`

For the test playground, use the parser directly:

```typescript
import { AI_PROVIDER_CATALOG, PARSERS } from '@/shared/constants';
import type { ChatRequest } from '@/shared/types';

const handleTestChat = async () => {
  // ... existing setup ...

  const provider = AI_PROVIDER_CATALOG.find(p => p.id === values.providerId);
  const parser = PARSERS[provider?.parser || 'openai'];
  const baseUrl = values.customBaseUrl || provider?.baseUrl;

  const chatRequest: ChatRequest = {
    model: values.model,
    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
    enableThinking: !!values.enableThinking,
  };

  try {
    let fullContent = '';

    for await (const chunk of parser.streamChat(baseUrl || '', values.apiKey, chatRequest)) {
      fullContent += chunk;
      setChatMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        last.content = fullContent;
        return next;
      });
    }
  } catch (error) {
    // ... error handling ...
  }
};
```

## API Comparison

| Aspect | OpenAI-compatible | Ollama Native |
|--------|------------------|---------------|
| **Fetch Models** | `GET /v1/models` | `GET /v1/models` (same) |
| **Chat Endpoint** | `POST /v1/chat/completions` | `POST /api/chat` |
| **Thinking Support** | ❌ No | ✅ `think: true/false` |
| **Request Body** | OpenAI format | Ollama format |
| **Streaming** | SSE (Server-Sent Events) | NDJSON (newline-delimited JSON) |
| **Chunk Content** | `choices[0].delta.content` | `message.content` |
| **Done Signal** | Stream ends | `done: true` in response |

## Test Plan

### Unit Tests

1. **OpenAI Parser**
   - Mock OpenAI SDK, verify fetchModels returns model list
   - Mock streaming response, verify streamChat yields chunks

2. **Ollama Parser**
   - Mock `/v1/models` response, verify fetchModels returns model list
   - Mock NDJSON streaming, verify streamChat parses correctly
   - Test with `think: true` and `think: false`

### Integration Tests

1. **Fetch Models**
   - Select each provider, verify models appear in dropdown

2. **Chat Translation**
   - Test OpenAI provider with thinking disabled
   - Test Zhipu provider with thinking enabled
   - Test Ollama provider with thinking disabled
   - Test Ollama provider with thinking enabled

3. **Custom Base URL**
   - Test Ollama with custom URL
   - Test custom provider with custom URL

4. **Error Handling**
   - Test when Ollama is not running
   - Test with invalid API key (for providers that require it)

## Migration Notes

1. Remove `useOpenAI.createClient()` - use parser directly
2. Remove `ai-helper.ts` logic from `startTranslation.ipc.ts` - parsers handle it
3. Update imports across affected files

## Benefits

1. **Extensible**: Add new API types by creating a new parser file
2. **Testable**: Each parser can be unit tested in isolation
3. **Clean separation**: Provider config ≠ API implementation
4. **Consistent interface**: Same method calls regardless of underlying API