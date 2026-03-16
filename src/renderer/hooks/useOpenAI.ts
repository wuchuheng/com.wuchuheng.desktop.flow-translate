import { useState, useCallback } from 'react';
import { message } from 'antd';
import { AI_PROVIDER_CATALOG, PARSERS, AiConfig } from '@/shared/constants';

export const useOpenAI = () => {
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelOptions, setModelOptions] = useState<{ value: string }[]>([]);

  const fetchModels = useCallback(async (values: AiConfig) => {
    try {
      setFetchingModels(true);

      const provider = AI_PROVIDER_CATALOG.find(p => p.id === values.providerId);
      const baseUrl = values.customBaseUrl || provider?.baseUrl;
      const parser = PARSERS[provider?.parser || 'openai'];

      if (!baseUrl) {
        throw new Error('Base URL is missing');
      }

      const models = await parser.fetchModels(baseUrl, values.apiKey);
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

  return { fetchingModels, modelOptions, fetchModels };
};
