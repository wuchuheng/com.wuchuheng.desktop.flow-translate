import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Switch, Button, AutoComplete, Spin, message, Tooltip } from 'antd';
import { InfoCircleOutlined, SendOutlined, LoadingOutlined } from '@ant-design/icons';
import { Stream } from 'openai/streaming';
import type { ChatCompletionCreateParams, ChatCompletionChunk } from 'openai/resources/chat/completions';
import { useConfig } from '../../../hooks/useConfig';
import { useOpenAI } from '../../../hooks/useOpenAI';
import { AI_PROVIDER_CATALOG, AiConfig, DEFAULT_AI_CONFIG, CONFIG_KEYS } from '../../../../shared/constants';

const { TextArea } = Input;
const { Option } = Select;

// Define custom types to handle non-standard API fields (like 'thinking')
type CustomChatParams = ChatCompletionCreateParams & {
  thinking?: { type: 'enabled' | 'disabled' };
};

type CustomDelta = ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
};

export const AiSettingsTab: React.FC = () => {
  const { config, saveConfig, loading: configLoading } = useConfig<AiConfig>(CONFIG_KEYS.AI, DEFAULT_AI_CONFIG);
  const { fetchingModels, modelOptions, fetchModels, createClient } = useOpenAI();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Playground State
  const [testInput, setTestInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      const values = await form.validateFields();
      const client = createClient(values);

      // Resolve thinking config
      const currentProvider = AI_PROVIDER_CATALOG.find(p => p.id === values.providerId);
      let thinkingParams = {};
      if (currentProvider?.thinkingConfig) {
        thinkingParams = values.enableThinking
          ? currentProvider.thinkingConfig.enable
          : currentProvider.thinkingConfig.disable;
      }

      const promptTemplate = values.systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
      
      const newMessages: ChatMessage[] = [...chatMessages];
      
      // If first message, handle system prompt logic
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

      const params: CustomChatParams = {
        model: values.model,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        ...thinkingParams,
      };

      const stream = (await client.chat.completions.create(
        params as unknown as ChatCompletionCreateParams
      )) as Stream<ChatCompletionChunk>;

      let fullContent = '';
      let fullReasoning = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as CustomDelta;

        if (delta?.content) {
          fullContent += delta.content;
          setChatMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            last.content = fullContent;
            return next;
          });
        }

        if (delta?.reasoning_content) {
          fullReasoning += delta.reasoning_content;
          setChatMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            last.reasoning = fullReasoning;
            return next;
          });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `[Error: ${msg}]` }
      ]);
    } finally {
      setIsTesting(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await saveConfig(values);
      messageApi.success('AI configuration saved successfully');
    } catch (e) {
      // validation failed
    }
  };

  const selectedProviderId = Form.useWatch('providerId', form);
  const enableThinking = Form.useWatch('enableThinking', form);

  return (
    <div className="relative grid h-full grid-cols-1 overflow-hidden lg:grid-cols-12 gap-6">
      {contextHolder}
      {/* LEFT: CONFIG */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1e2e] lg:col-span-7">
        <div className="flex items-center justify-between border-b bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <h3 className="m-0 font-semibold text-gray-700 dark:text-gray-200">Provider Configuration</h3>
          <Button type="primary" onClick={handleSave}>
            Save Changes
          </Button>
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

            {(() => {
              const currentProvider = AI_PROVIDER_CATALOG.find(p => p.id === selectedProviderId);
              return currentProvider?.docsUrl ? (
                <div className="mb-4 -mt-4 flex items-start gap-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs text-gray-500 dark:border-blue-900/30 dark:bg-blue-900/20">
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
              ) : null;
            })()}

            {selectedProviderId === 'custom' && (
              <Form.Item label="Base URL" name="customBaseUrl" rules={[{ required: true }]}>
                <Input placeholder="https://api.example.com/v1" />
              </Form.Item>
            )}

            <Form.Item label="API Key" name="apiKey" rules={[{ required: true }]}>
              <Input.Password placeholder="sk-..." />
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
          <Button size="small" onClick={clearChat} className="text-xs">Clear Chat</Button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-[#11111b] flex flex-col gap-4">
          {chatMessages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Start a conversation to test your settings...
            </div>
          )}
          
          {chatMessages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : m.role === 'system'
                  ? 'bg-gray-200 text-gray-600 italic rounded-tl-none dark:bg-gray-800 dark:text-gray-400'
                  : 'bg-white text-gray-800 rounded-tl-none dark:bg-[#252539] dark:text-gray-200'
              }`}>
                {enableThinking && m.reasoning && (
                  <div className="mb-2 rounded border-l-2 border-blue-400 bg-blue-50/50 p-2 text-xs italic text-gray-500 dark:bg-blue-900/10">
                    <div className="font-bold text-blue-500 text-[10px] uppercase mb-1">Reasoning</div>
                    {m.reasoning}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content || (isTesting && i === chatMessages.length - 1 ? '...' : '')}</div>
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
              className="absolute right-2 bottom-1 shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
