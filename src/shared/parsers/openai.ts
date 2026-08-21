import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { AiProviderParser, ChatRequest, StreamChunk } from '../types';
import { cleanModelName } from '../ai-helper';
import {
  buildReasoningRequestFields,
  isReasoningDisabledForTarget,
  isReasoningParameterError,
  markReasoningUnsupportedForTarget,
  normalizeEndpointKey,
  resolveReasoningProfile,
} from '../reasoning';

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

  async *streamChat(baseUrl: string, apiKey: string, request: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = createClient(baseUrl, apiKey);

    // OpenAI APIs use model name without tag suffix (e.g., "gpt-4" not "gpt-4:latest")
    const model = cleanModelName(request.model);
    const profile = resolveReasoningProfile(request.providerId, model, request.enableThinking);
    const targetKey = normalizeEndpointKey(baseUrl, model);
    const requestPayload = {
      model,
      messages: request.messages,
      stream: true as const,
      stream_options: { include_usage: true },
    };

    const createStream = (reasoningFields: Record<string, unknown>) =>
      client.chat.completions.create({
        ...requestPayload,
        ...reasoningFields,
      }) as Promise<Stream<ChatCompletionChunk>>;

    let stream: Stream<ChatCompletionChunk>;
    if (profile && !isReasoningDisabledForTarget(targetKey)) {
      try {
        stream = await createStream(buildReasoningRequestFields(profile));
      } catch (error) {
        if (!isReasoningParameterError(error)) throw error;

        markReasoningUnsupportedForTarget(targetKey);
        stream = await createStream({});
      }
    } else {
      stream = await createStream({});
    }

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const usage = chunk.usage ? normalizeUsage(chunk.usage) : undefined;
      if (content || usage) yield { content, usage };
    }
  },
};

const normalizeUsage = (usage: ChatCompletionChunk['usage']) => {
  const details = usage as ChatCompletionChunk['usage'] & {
    completion_tokens_details?: { reasoning_tokens?: unknown };
    output_tokens_details?: { thinking_tokens?: unknown };
  };
  const completionReasoningTokens = details.completion_tokens_details?.reasoning_tokens;
  const outputThinkingTokens = details.output_tokens_details?.thinking_tokens;

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    reasoningTokens:
      typeof completionReasoningTokens === 'number'
        ? completionReasoningTokens
        : typeof outputThinkingTokens === 'number'
          ? outputThinkingTokens
          : undefined,
  };
};
