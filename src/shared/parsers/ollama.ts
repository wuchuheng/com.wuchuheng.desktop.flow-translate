import type { AiProviderParser, ChatRequest, KeepAliveValue } from '../types';

/**
 * Ollama native API parser
 * - Uses OpenAI-compatible endpoint for model listing (/v1/models)
 * - Uses native /api/chat for chat (supports thinking feature)
 * - Model names include tags (e.g., "qwen3.5:9b") and must be preserved
 */
export const ollamaParser: AiProviderParser = {
  async fetchModels(baseUrl: string): Promise<string[]> {
    const response = await fetch(`${baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  },

  async *streamChat(baseUrl: string, _apiKey: string, request: ChatRequest): AsyncGenerator<string> {
    // Ollama requires exact model name including tag (e.g., "qwen3.5:9b")
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);
            if (chunk.message?.content) yield chunk.message.content;
            if (chunk.done) return;
          } catch {
            continue; // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async setKeepAlive(baseUrl: string, model: string, keepAlive: KeepAliveValue): Promise<void> {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: keepAlive }),
    });

    if (!response.ok) {
      throw new Error(`Failed to set keep-alive: ${response.statusText}`);
    }
  },

  async freeModel(baseUrl: string, model: string): Promise<void> {
    await this.setKeepAlive(baseUrl, model, 0);
  },
};
