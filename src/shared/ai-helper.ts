import { AI_PROVIDER_CATALOG, type AiConfig, type AiProviderConfig } from './constants';
import { thinkingConfig } from './config/thinkingConfig';

/** Provider lookup by ID */
export const getProviderById = (providerId: string): AiProviderConfig | undefined => {
  return AI_PROVIDER_CATALOG.find(p => p.id === providerId);
};

/** Resolve base URL — custom override takes priority over provider default */
export const getBaseUrl = (config: AiConfig): string | undefined => {
  const provider = getProviderById(config.providerId);
  return config.customBaseUrl || provider?.baseUrl;
};

/** Check whether a provider uses the Ollama parser */
export const isOllamaProvider = (providerId: string): boolean => {
  return getProviderById(providerId)?.parser === 'ollama';
};

/**
 * Strip the tag suffix from an Ollama-style model name.
 * e.g. "glm-4.7-flash:latest" → "glm-4.7-flash"
 */
export const cleanModelName = (model: string): string => {
  return model ? model.split(':')[0] : '';
};

/** Parse an optional provider-specific OpenAI request-body JSON object. */
export const parseAdditionalRequestBody = (value: string | undefined): Record<string, unknown> => {
  if (!value?.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Additional request body must be valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Additional request body must be a JSON object.');
  }

  const body = parsed as Record<string, unknown>;
  const reservedKeys = Object.keys(body).filter(key => RESERVED_ADDITIONAL_BODY_KEYS.has(key));
  if (reservedKeys.length > 0) {
    throw new Error(`Additional request body cannot set: ${reservedKeys.join(', ')}.`);
  }

  return body;
};

const RESERVED_ADDITIONAL_BODY_KEYS = new Set([
  'model',
  'messages',
  'stream',
  'stream_options',
  'reasoning',
  'reasoning_effort',
  'thinking',
  'enable_thinking',
  'think',
]);

/** Nested config object used by addThinkingArgument */
type NestedConfig = Record<string, unknown>;

/**
 * Inject or remove the thinking/reasoning parameter into a chat request payload.
 *
 * Priority:
 * 1. Provider-level thinkingConfig (from the catalog)
 * 2. Model-level config (from thinkingConfig map, with glm- prefix fallback)
 */
export const addThinkingArgument = (
  requestConfig: NestedConfig,
  model: string,
  providerId: string | undefined,
  enable: boolean
): NestedConfig => {
  const cleanedModel = cleanModelName(model);

  // 1. Provider-specific config
  if (providerId) {
    const providerThinking = getProviderById(providerId)?.thinkingConfig;
    if (providerThinking) {
      const config = enable ? providerThinking.enable : providerThinking.disable;
      deepMerge(requestConfig, config);
      return requestConfig;
    }
  }

  // 2. Model-level config (case-insensitive lookup)
  const modelConfig = findModelThinkingConfig(cleanedModel);
  if (modelConfig) {
    applyNestedConfig(requestConfig, modelConfig.query, enable ? modelConfig.enable : modelConfig.disable);
    return requestConfig;
  }

  return requestConfig;
};

/** Deep-merge source into target (mutates target) */
const deepMerge = (target: NestedConfig, source: NestedConfig): void => {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      target[key] = { ...(target[key] as NestedConfig), ...(value as NestedConfig) };
    } else {
      target[key] = value;
    }
  }
};

/** Set a dot-separated path (e.g. "thinking.type") to a value in the config */
const applyNestedConfig = (config: NestedConfig, dotPath: string, value: string | undefined): void => {
  if (value === undefined) return;

  const parts = dotPath.split('.');
  let current: NestedConfig = config;

  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      current[parts[i]] = value;
    } else {
      if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as NestedConfig;
    }
  }
};

/** Case-insensitive model config lookup with glm- prefix fallback */
const findModelThinkingConfig = (model: string) => {
  const normalized = model.toLowerCase();

  // Build lowercase → original key map once per call
  const lowerMap = new Map<string, string>();
  for (const key of Object.keys(thinkingConfig)) {
    lowerMap.set(key.toLowerCase(), key);
  }

  const exactKey = lowerMap.get(normalized);
  if (exactKey) return thinkingConfig[exactKey];

  // Fallback for glm- family models not in the map
  if (normalized.startsWith('glm-')) {
    return thinkingConfig['glm-4-flash'] ?? null;
  }

  return null;
};
