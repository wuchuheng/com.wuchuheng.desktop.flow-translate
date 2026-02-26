import { useState, useCallback } from 'react';
import OpenAI from 'openai';
import { message } from 'antd';
import { AI_PROVIDER_CATALOG, AiConfig } from '@/shared/constants';

export const useOpenAI = () => {
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelOptions, setModelOptions] = useState<{ value: string }[]>([]);

  const getBaseUrl = useCallback((providerId: string, customUrl?: string) => {
    if (providerId === 'custom') return customUrl;
    const provider = AI_PROVIDER_CATALOG.find(p => p.id === providerId);
    return provider?.baseUrl;
  }, []);

  const createClient = useCallback(
    (values: AiConfig) => {
      const baseURL = getBaseUrl(values.providerId, values.customBaseUrl);
      if (!baseURL) throw new Error('Base URL is missing');
      if (!values.apiKey) throw new Error('API Key is missing');

      return new OpenAI({
        apiKey: values.apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      });
    },
    [getBaseUrl]
  );

  const fetchModels = useCallback(
    async (values: AiConfig) => {
      try {
        setFetchingModels(true);
        const client = createClient(values);
        const list = await client.models.list();
        const options = list.data.map(m => ({ value: m.id }));
        setModelOptions(options);
        return options;
      } catch (error) {
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        message.error(`Failed to fetch models: ${msg}`);
        return [];
      } finally {
        setFetchingModels(false);
      }
    },
    [createClient]
  );

  return { fetchingModels, modelOptions, fetchModels, createClient };
};
