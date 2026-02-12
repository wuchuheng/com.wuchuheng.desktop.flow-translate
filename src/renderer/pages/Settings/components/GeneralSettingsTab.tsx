import React, { useEffect } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useConfig } from '../../../hooks/useConfig';
import { CONFIG_KEYS } from '../../../../shared/constants';

const DEFAULT_HOTKEY = { toggleWindow: 'CommandOrControl+Alt+T' };

export const GeneralSettingsTab: React.FC = () => {
  const { config, saveConfig, loading } = useConfig<{ toggleWindow: string }>(CONFIG_KEYS.HOTKEYS, DEFAULT_HOTKEY);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!loading) form.setFieldsValue(config);
  }, [config, loading, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    await saveConfig(values);
    await window.electron.system.reloadHotkeys();
    messageApi.success('General settings saved successfully');
  };

  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1e1e2e]">
      {contextHolder}
      <h3 className="mb-6 font-semibold text-gray-700 dark:text-gray-200">General Settings</h3>
      <Form form={form} layout="vertical" initialValues={DEFAULT_HOTKEY}>
        <Form.Item
          label="Toggle Window Shortcut"
          name="toggleWindow"
          help="Format: CommandOrControl+Alt+T. Applied immediately."
        >
          <Input />
        </Form.Item>
        <Button type="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </Form>
    </div>
  );
};
