/**
 * Supported API parser types
 */
export type ParserType = 'openai' | 'ollama';

/**
 * Keep-alive duration for Ollama models
 * - -1: Keep in memory indefinitely (Forever)
 * - 0: Unload immediately (Free)
 * - "1h", "2h", etc.: Duration strings
 */
export type KeepAliveValue = -1 | 0 | '1h' | '2h' | '4h' | '8h';

/**
 * Keep-alive options for UI dropdown
 */
export const KEEP_ALIVE_OPTIONS: { label: string; value: KeepAliveValue }[] = [
  { label: 'Forever', value: -1 },
  { label: '1 hour', value: '1h' },
  { label: '2 hours', value: '2h' },
  { label: '4 hours', value: '4h' },
  { label: '8 hours', value: '8h' },
  { label: 'Free', value: 0 },
];

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
  providerId?: string;
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
  streamChat(baseUrl: string, apiKey: string, request: ChatRequest): AsyncGenerator<string>;

  /**
   * Set keep-alive for a model (Ollama only)
   * @param baseUrl - API base URL
   * @param model - Model name
   * @param keepAlive - Keep-alive value
   */
  setKeepAlive?(baseUrl: string, model: string, keepAlive: KeepAliveValue): Promise<void>;

  /**
   * Free a model from memory (Ollama only)
   * @param baseUrl - API base URL
   * @param model - Model name
   */
  freeModel?(baseUrl: string, model: string): Promise<void>;
}
