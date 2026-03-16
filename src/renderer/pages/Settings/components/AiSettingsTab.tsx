import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Switch, Button, AutoComplete, Spin, message, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
  SendOutlined,
  LoadingOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useConfig } from '../../../hooks/useConfig';
import { useOpenAI } from '../../../hooks/useOpenAI';
import { AI_PROVIDER_CATALOG, PARSERS, AiConfig, DEFAULT_AI_CONFIG, CONFIG_KEYS } from '@/shared/constants';
import type { ChatRequest } from '@/shared/types';
import { KEEP_ALIVE_OPTIONS } from '@/shared/types';
import { getProviderById, getBaseUrl, isOllamaProvider } from '@/shared/ai-helper';

const { TextArea } = Input;
const { Option } = Select;

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
};

type SaveStatus = {
  type: 'success' | 'error' | null;
  message: string;
};

export const AiSettingsTab: React.FC = () => {
  const { config, saveConfig, loading: configLoading } = useConfig<AiConfig>(CONFIG_KEYS.AI, DEFAULT_AI_CONFIG);
  const { fetchingModels, modelOptions, fetchModels } = useOpenAI();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Playground State
  const [testInput, setTestInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save Status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: null, message: '' });

  useEffect(() => {
    if (!configLoading) {
      form.setFieldsValue(config);
    }
  }, [config, configLoading, form]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFetchModels = async () => {
    const values = await form.validateFields(['providerId', 'apiKey', 'customBaseUrl']);
    const options = await fetchModels(values as AiConfig);
    if (options.length > 0) {
      messageApi.success(`Found ${options.length} models`);
    }
  };

  const handleTestChat = async () => {
    if (!testInput.trim() || isTesting) return;

    const currentInput = testInput;
    setTestInput('');
    setIsTesting(true);

    try {
      const values = (await form.validateFields()) as AiConfig;
      const provider = getProviderById(values.providerId);
      const parser = PARSERS[provider?.parser || 'openai'];
      const baseUrl = getBaseUrl(values);

      if (!baseUrl) {
        throw new Error('Base URL is missing');
      }

      const promptTemplate = values.systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;

      const newMessages: ChatMessage[] = [...chatMessages];

      if (newMessages.length === 0) {
        if (promptTemplate.includes('{text}')) {
          newMessages.push({ role: 'user', content: promptTemplate.replace('{text}', currentInput) });
        } else {
          newMessages.push({ role: 'system', content: promptTemplate });
          newMessages.push({ role: 'user', content: `<content>\n${currentInput}\n</content>` });
        }
      } else {
        newMessages.push({ role: 'user', content: currentInput });
      }

      setChatMessages([...newMessages, { role: 'assistant', content: '' }]);

      const chatRequest: ChatRequest = {
        model: values.model,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        enableThinking: !!values.enableThinking,
        providerId: values.providerId,
      };

      let fullContent = '';

      for await (const chunk of parser.streamChat(baseUrl, values.apiKey || '', chatRequest)) {
        fullContent += chunk;
        setChatMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          last.content = fullContent;
          return next;
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `[Error: ${msg}]` }]);
    } finally {
      setIsTesting(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  /**
   * Handle Ollama model lifecycle (free old, set keep-alive for new)
   */
  const handleOllamaLifecycle = async (oldConfig: AiConfig, newConfig: AiConfig): Promise<void> => {
    const ollamaParser = PARSERS.ollama;

    // Free old model if switching away from Ollama or changing model
    if (isOllamaProvider(oldConfig.providerId) && oldConfig.model) {
      const modelChanged = newConfig.model !== oldConfig.model;
      const providerChanged = !isOllamaProvider(newConfig.providerId);

      if (modelChanged || providerChanged) {
        const oldBaseUrl = getBaseUrl(oldConfig);
        if (oldBaseUrl) {
          try {
            await ollamaParser.freeModel(oldBaseUrl, oldConfig.model);
          } catch {
            // Ignore errors when freeing old model
          }
        }
      }
    }

    // Set keep-alive for new Ollama model
    if (isOllamaProvider(newConfig.providerId) && newConfig.model) {
      const baseUrl = getBaseUrl(newConfig);
      if (baseUrl) {
        await ollamaParser.setKeepAlive(baseUrl, newConfig.model, newConfig.keepAlive ?? -1);
      }
    }
  };

  const handleSave = async () => {
    setSaveStatus({ type: null, message: '' });

    try {
      const newConfig = (await form.validateFields()) as AiConfig;
      const oldConfig = config;

      // Save config to database
      await saveConfig(newConfig);

      // Handle Ollama model lifecycle
      if (isOllamaProvider(oldConfig.providerId) || isOllamaProvider(newConfig.providerId)) {
        try {
          await handleOllamaLifecycle(oldConfig, newConfig);
          setSaveStatus({ type: 'success', message: 'Ollama model locked in memory' });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          setSaveStatus({ type: 'error', message: `Failed to set keep-alive: ${msg}` });
          return;
        }
      }

      messageApi.success('AI configuration saved successfully');
    } catch {
      // validation failed
    }
  };

  const handleManualLogin = () => {
    window.electron.grammarly.openAuth();
  };

  const selectedProviderId = Form.useWatch('providerId', form);
  const enableThinking = Form.useWatch('enableThinking', form);
  const currentProvider = getProviderById(selectedProviderId);

  // Clear/pre-fill customBaseUrl when provider changes
  useEffect(() => {
    if (currentProvider && !currentProvider.allowCustomBaseUrl) {
      form.setFieldValue('customBaseUrl', undefined);
    } else if (currentProvider?.allowCustomBaseUrl && currentProvider.baseUrl) {
      form.setFieldValue('customBaseUrl', currentProvider.baseUrl);
    }
  }, [selectedProviderId, currentProvider, form]);

  const isApiKeyRequired = !isOllamaProvider(selectedProviderId);

  return (
    <div className="relative grid h-full grid-cols-1 gap-6 overflow-hidden lg:grid-cols-12">
      {contextHolder}
      {/* LEFT: CONFIG */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1e2e] lg:col-span-7">
        <div className="flex items-center justify-between border-b bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <h3 className="m-0 font-semibold text-gray-700 dark:text-gray-200">Provider Configuration</h3>
          <div className="flex items-center gap-2">
            {saveStatus.type && (
              <span className={`text-sm ${saveStatus.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {saveStatus.type === 'success' ? (
                  <CheckCircleOutlined className="mr-1" />
                ) : (
                  <CloseCircleOutlined className="mr-1" />
                )}
                {saveStatus.message}
              </span>
            )}
            <Button icon={<UserOutlined />} onClick={handleManualLogin}>
              Grammarly Login
            </Button>
            <Button type="primary" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <Form form={form} layout="vertical" initialValues={DEFAULT_AI_CONFIG}>
            <Form.Item label="AI Provider" name="providerId" rules={[{ required: true }]}>
              <Select>
                {AI_PROVIDER_CATALOG.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {currentProvider?.docsUrl && (
              <div className="-mt-4 mb-4 flex items-start gap-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs text-gray-500 dark:border-blue-900/30 dark:bg-blue-900/20">
                <InfoCircleOutlined className="mt-0.5 text-blue-500" />
                <span>
                  Need an API Key? Check the{' '}
                  <a
                    href={currentProvider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    official documentation
                  </a>{' '}
                  for {currentProvider.name}.
                </span>
              </div>
            )}

            {currentProvider?.allowCustomBaseUrl && (
              <Form.Item label="Base URL" name="customBaseUrl" rules={[{ required: true }]}>
                <Input placeholder={currentProvider.baseUrl || 'https://api.example.com/v1'} />
              </Form.Item>
            )}

            <Form.Item label="API Key" name="apiKey" rules={[{ required: isApiKeyRequired }]}>
              <Input.Password placeholder={isApiKeyRequired ? 'sk-...' : 'Optional for Ollama'} />
            </Form.Item>

            <Form.Item label="Model Name" name="model" rules={[{ required: true }]}>
              <AutoComplete options={modelOptions} onFocus={handleFetchModels} placeholder="Select or type model name">
                <Input
                  suffix={
                    <span style={{ opacity: fetchingModels ? 1 : 0, transition: 'opacity 0.2s', display: 'flex' }}>
                      <Spin indicator={<LoadingOutlined spin />} size="small" />
                    </span>
                  }
                />
              </AutoComplete>
            </Form.Item>

            {/* Ollama Settings */}
            {isOllamaProvider(selectedProviderId) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Ollama Settings</h4>
                <Form.Item
                  label="Keep-Alive"
                  name="keepAlive"
                  className="mb-0"
                  help="How long to keep the model in memory"
                >
                  <Select style={{ width: '100%' }}>
                    {KEEP_ALIVE_OPTIONS.map(opt => (
                      <Option key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
            )}

            <div className="mb-4 flex items-center gap-4">
              <Form.Item name="enableThinking" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <span className="text-gray-700 dark:text-gray-300">Enable Thinking / Reasoning Process</span>
              <Tooltip title="If the model supports Chain of Thought (like DeepSeek R1), enabling this will visualize the reasoning process.">
                <InfoCircleOutlined className="text-gray-400" />
              </Tooltip>
            </div>

            <Form.Item label="System Prompt" name="systemPrompt" help="Default prompt used for translation task.">
              <TextArea rows={4} />
            </Form.Item>
          </Form>
        </div>
      </div>

      {/* RIGHT: PLAYGROUND */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1e2e] lg:col-span-5">
        <div className="flex items-center justify-between border-b bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <h3 className="m-0 font-semibold text-gray-700 dark:text-gray-200">Test Playground</h3>
          <Button size="small" onClick={clearChat} className="text-xs">
            Clear Chat
          </Button>
        </div>

        <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto bg-gray-50 p-4 dark:bg-[#11111b]">
          {chatMessages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Start a conversation to test your settings...
            </div>
          )}

          {chatMessages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-tr-none bg-blue-600 text-white'
                    : m.role === 'system'
                      ? 'rounded-tl-none bg-gray-200 italic text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      : 'rounded-tl-none bg-white text-gray-800 dark:bg-[#252539] dark:text-gray-200'
                }`}
              >
                {enableThinking && m.reasoning && (
                  <div className="mb-2 rounded border-l-2 border-blue-400 bg-blue-50/50 p-2 text-xs italic text-gray-500 dark:bg-blue-900/10">
                    <div className="mb-1 text-[10px] font-bold uppercase text-blue-500">Reasoning</div>
                    {m.reasoning}
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {m.content || (isTesting && i === chatMessages.length - 1 ? '...' : '')}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t bg-white p-4 dark:border-white/5 dark:bg-[#1e1e2e]">
          <div className="relative">
            <TextArea
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTestChat();
                }
              }}
              placeholder="Send a message..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="pr-12"
            />
            <Button
              type="primary"
              shape="circle"
              icon={isTesting ? <LoadingOutlined /> : <SendOutlined />}
              onClick={handleTestChat}
              disabled={isTesting || !testInput.trim()}
              className="absolute bottom-1 right-2 shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
