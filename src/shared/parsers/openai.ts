import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { AiProviderParser, ChatRequest } from '../types';
import { addThinkingArgument, cleanModelName } from '../ai-helper';

/**
 * Creates an OpenAI client instance
 */
const createClient = (baseUrl: string, apiKey: string) =>
  new OpenAI({
    apiKey,
    baseURL: baseUrl,
    dangerouslyAllowBrowser: true,
  });

/**
 * OpenAI-compatible API parser
 * Works with OpenAI, OpenRouter, Together, Mistral, Groq, DeepSeek, Zhipu, etc.
 */
export const openaiParser: AiProviderParser = {
  async fetchModels(baseUrl: string, apiKey?: string): Promise<string[]> {
    if (!apiKey) return [];

    const client = createClient(baseUrl, apiKey);
    const list = await client.models.list();
    return list.data.map(m => m.id);
  },

  async *streamChat(baseUrl: string, apiKey: string, request: ChatRequest): AsyncGenerator<string> {
    const client = createClient(baseUrl, apiKey);

    // OpenAI APIs use model name without tag suffix (e.g., "gpt-4" not "gpt-4:latest")
    const model = cleanModelName(request.model);

    const stream = (await client.chat.completions.create({
      model,
      messages: request.messages,
      stream: true,
      ...addThinkingArgument({}, model, request.providerId, request.enableThinking),
    })) as Stream<ChatCompletionChunk>;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) yield content;
    }
  },
};
