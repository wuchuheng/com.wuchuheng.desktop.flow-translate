import { AI_PROVIDER_CATALOG, type AiConfig, type AiProviderConfig } from './constants';
import { thinkingConfig } from './config/thinkingConfig';

/**
 * Get provider config by ID
 */
export const getProviderById = (providerId: string): AiProviderConfig | undefined => {
  return AI_PROVIDER_CATALOG.find(p => p.id === providerId);
};

/**
 * Get base URL for a config
 * Priority: customBaseUrl > provider.baseUrl
 */
export const getBaseUrl = (config: AiConfig): string | undefined => {
  const provider = getProviderById(config.providerId);
  return config.customBaseUrl || provider?.baseUrl;
};

/**
 * Check if provider uses Ollama parser
 */
export const isOllamaProvider = (providerId: string): boolean => {
  const provider = getProviderById(providerId);
  return provider?.parser === 'ollama';
};

/**
 * Extract truth model name from string with potential suffix after : character.
 * e.g. "glm-4.7-flash:latest" -> "glm-4.7-flash"
 * @param model - The model name string.
 * @returns The cleaned model name.
 */
export const cleanModelName = (model: string): string => {
  if (!model) return '';
  return model.split(':')[0];
};

/**
 * Adapted thinking configuration for the AI agent.
 */
export const addThinkingArgument = (
  requestConfig: Record<string, unknown>,
  model: string,
  providerId: string | undefined,
  enable: boolean
): Record<string, unknown> => {
  const cleanedModel = cleanModelName(model);

  // 1. Provider-specific configuration (New Priority)
  if (providerId) {
    const provider = getProviderById(providerId);
    if (provider?.thinkingConfig) {
      const config = enable ? provider.thinkingConfig.enable : provider.thinkingConfig.disable;
      // Deep merge the config into requestConfig
      Object.keys(config).forEach(key => {
        const value = config[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          requestConfig[key] = {
            ...(requestConfig[key] as Record<string, unknown>),
            ...(value as Record<string, unknown>),
          };
        } else {
          requestConfig[key] = value;
        }
      });
      return requestConfig;
    }
  }

  // 2. Model-specific fallback
  const lowerCaseMapKey: Map<string, string> = new Map();
  Object.keys(thinkingConfig).forEach(item => {
    const lowerCaseItem = item.toLowerCase();
    lowerCaseMapKey.set(lowerCaseItem, item);
  });
  const currentModel = cleanedModel.toLowerCase();

  const exactKey = lowerCaseMapKey.get(currentModel);
  let cfg = exactKey ? thinkingConfig[exactKey] : null;

  // If not found exactly, try prefix matching for glm- family
  if (!cfg && currentModel.startsWith('glm-')) {
    cfg = thinkingConfig['glm-4-flash']; // Fallback to a standard glm config
  }

  if (cfg) {
    const queryPath = cfg.query;
    const parts = queryPath.split('.');
    let cur: Record<string, unknown> = requestConfig;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      if (i === parts.length - 1) {
        const value = enable ? cfg.enable : cfg.disable;
        cur[key] = value;
      } else {
        if (typeof cur[key] !== 'object' || cur[key] === null) {
          cur[key] = {};
        }
        cur = cur[key] as Record<string, unknown>;
      }
    }
    return requestConfig;
  }

  // 3. OpenAI Standard Fallback
  if (enable) {
    requestConfig.reasoning_effort = 'low';
  }

  return requestConfig;
};
