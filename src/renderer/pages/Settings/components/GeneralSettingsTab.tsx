import React, { useEffect } from 'react';
import { Form, Input, Button, message, Switch, Divider } from 'antd';
import { useConfig } from '../../../hooks/useConfig';
import { CONFIG_KEYS, AppConfig, DEFAULT_APP_CONFIG } from '../../../../shared/constants';

const DEFAULT_HOTKEY = { toggleWindow: 'CommandOrControl+Alt+T' };

export const GeneralSettingsTab: React.FC = () => {
  const { config: hotkeyConfig, saveConfig: saveHotkeyConfig, loading: hotkeyLoading } = useConfig<{ toggleWindow: string }>(CONFIG_KEYS.HOTKEYS, DEFAULT_HOTKEY);
  const { config: appConfig, saveConfig: saveAppConfig, loading: appLoading } = useConfig<AppConfig>(CONFIG_KEYS.APP, DEFAULT_APP_CONFIG);
  
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!hotkeyLoading && !appLoading) {
      form.setFieldsValue({
        ...hotkeyConfig,
        ...appConfig,
      });
    }
  }, [hotkeyConfig, appConfig, hotkeyLoading, appLoading, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    
    // Split values back into their respective configs
    const hotkeyValues = { toggleWindow: values.toggleWindow };
    const appValues = { 
      runInBackground: values.runInBackground,
      autoStart: values.autoStart 
    };

    await saveHotkeyConfig(hotkeyValues);
    await saveAppConfig(appValues);
    
    await window.electron.system.reloadHotkeys();
    messageApi.success('General settings saved successfully');
  };

  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1e1e2e]">
      {contextHolder}
      <h3 className="mb-6 font-semibold text-gray-700 dark:text-gray-200">General Settings</h3>
      <Form form={form} layout="vertical" initialValues={{ ...DEFAULT_HOTKEY, ...DEFAULT_APP_CONFIG }}>
        <Form.Item
          label="Toggle Window Shortcut"
          name="toggleWindow"
          help="Format: CommandOrControl+Alt+T. Applied immediately."
        >
          <Input placeholder="e.g. CommandOrControl+Alt+T" />
        </Form.Item>

        <Divider />

        <Form.Item
          label="Run in background"
          name="runInBackground"
          valuePropName="checked"
          help="When enabled, closing the window will hide it to the system tray instead of quitting."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Auto-start on boot"
          name="autoStart"
          valuePropName="checked"
          help="Automatically start the application when you log in to your computer."
        >
          <Switch />
        </Form.Item>

        <div className="mt-8">
          <Button type="primary" onClick={handleSave} size="large">
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
};
