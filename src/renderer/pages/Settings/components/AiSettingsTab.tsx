import React, { useState, useEffect } from 'react';
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

export const AiSettingsTab: React.FC = () => {
  const { config, saveConfig, loading: configLoading } = useConfig<AiConfig>(CONFIG_KEYS.AI, DEFAULT_AI_CONFIG);
  const { fetchingModels, modelOptions, fetchModels, createClient } = useOpenAI();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Playground State
  const [testInput, setTestInput] = useState('你好，世界');
  const [testResult, setTestResult] = useState('');
  const [testReasoning, setTestReasoning] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!configLoading) {
      form.setFieldsValue(config);
    }
  }, [config, configLoading, form]);

  const handleFetchModels = async () => {
    const values = await form.validateFields(['providerId', 'apiKey', 'customBaseUrl']);
    const options = await fetchModels(values as AiConfig);
    if (options.length > 0) {
      messageApi.success(`Found ${options.length} models`);
    }
  };

  const handleTestChat = async () => {
    if (!testInput.trim()) return;
    setIsTesting(true);
    setTestResult('');
    setTestReasoning('');

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

      const params: CustomChatParams = {
        model: values.model,
        messages: [{ role: 'user', content: testInput }],
        stream: true,
        ...thinkingParams,
      };

      const stream = (await client.chat.completions.create(
        params as unknown as ChatCompletionCreateParams
      )) as Stream<ChatCompletionChunk>;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as CustomDelta;

        if (delta?.content) {
          setTestResult(prev => prev + delta.content);
        }

        if (delta?.reasoning_content) {
          setTestReasoning(prev => prev + delta.reasoning_content);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      setTestResult(prev => prev + `\n[Error: ${msg}]`);
    } finally {
      setIsTesting(false);
    }
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
        <div className="border-b bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <h3 className="m-0 font-semibold text-gray-700 dark:text-gray-200">Test Playground</h3>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-[#11111b]">
          {/* Reasoning Block */}
          {enableThinking && testReasoning && (
            <div className="mb-4 rounded-lg border-l-4 border-blue-400 bg-white p-3 text-xs shadow-sm dark:bg-white/5">
              <div className="mb-1 font-bold uppercase tracking-wider text-blue-500">Thinking Process</div>
              <div className="whitespace-pre-wrap text-gray-500 dark:text-gray-400">{testReasoning}</div>
            </div>
          )}

          {/* Result Block */}
          {testResult ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {testResult}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              AI response will appear here...
            </div>
          )}
        </div>

        <div className="border-t bg-white p-4 dark:border-white/5 dark:bg-[#1e1e2e]">
          <div className="relative">
            <TextArea
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder="Enter test message..."
              autoSize={{ minRows: 2, maxRows: 6 }}
              className="pr-12"
            />
            <Button
              type="primary"
              shape="circle"
              icon={isTesting ? <LoadingOutlined /> : <SendOutlined />}
              onClick={handleTestChat}
              disabled={isTesting}
              className="absolute right-2 bottom-2 shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
