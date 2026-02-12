import React, { useEffect } from 'react';
import { Form, Radio, Slider, ColorPicker, Button, message } from 'antd';
import { useConfig } from '../../../hooks/useConfig';
import { ThemeConfig, DEFAULT_THEME_CONFIG, CONFIG_KEYS } from '../../../../shared/constants';
import { hexToRgba } from '../../../../shared/utils';

export const ThemeSettingsTab: React.FC = () => {
  const { config, saveConfig, loading } = useConfig<ThemeConfig>(CONFIG_KEYS.THEME, DEFAULT_THEME_CONFIG);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Watch values for live preview
  const mode = Form.useWatch('mode', form) || DEFAULT_THEME_CONFIG.mode;
  const bgColor = Form.useWatch('backgroundColor', form); // Color object or string
  const opacity = Form.useWatch('opacity', form);

  useEffect(() => {
    if (!loading) {
      form.setFieldsValue(config);
    }
  }, [config, loading, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    // Convert color object to hex string if needed
    if (typeof values.backgroundColor === 'object') {
      values.backgroundColor = values.backgroundColor.toHexString();
    }
    await saveConfig(values);
    messageApi.success('Theme settings saved successfully');
  };

  // Compute preview styles
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const bgHex = typeof bgColor === 'string' ? bgColor : bgColor?.toHexString() || '#ffffff';

  const previewStyle = {
    backgroundColor: hexToRgba(bgHex, opacity || 0.8),
  };

  return (
    <div className="relative grid h-full grid-cols-1 lg:grid-cols-12 gap-6">
      {contextHolder}
      {/* LEFT: CONFIG */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1e2e] lg:col-span-5">
        <div className="flex items-center justify-between border-b bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/5">
          <h3 className="m-0 font-semibold text-gray-700 dark:text-gray-200">Appearance</h3>
          <Button type="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
        <div className="overflow-y-auto p-6">
          <Form form={form} layout="vertical" initialValues={DEFAULT_THEME_CONFIG}>
            <Form.Item label="Theme Mode" name="mode">
              <Radio.Group buttonStyle="solid">
                <Radio.Button value="system">System</Radio.Button>
                <Radio.Button value="light">Light</Radio.Button>
                <Radio.Button value="dark">Dark</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="Background Color" name="backgroundColor">
              <ColorPicker showText format="hex" />
            </Form.Item>

            <Form.Item label="Opacity" name="opacity">
              <Slider min={0.1} max={1.0} step={0.05} marks={{ 0.1: 'Glass', 0.8: 'Standard', 1: 'Solid' }} />
            </Form.Item>
          </Form>
        </div>
      </div>

      {/* RIGHT: PREVIEW */}
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 p-8 dark:border-white/10 lg:col-span-7">
        <div className="absolute left-4 top-4 text-xs font-bold uppercase tracking-widest text-gray-500">Live Preview</div>

        {/* Checkerboard Pattern CSS */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        ></div>

        {/* MOCK WINDOW */}
        <div
          className={`relative z-10 flex w-[400px] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.2)] backdrop-blur-2xl ${isDark ? 'dark text-white' : 'text-gray-900'}`}
          style={previewStyle}
        >
          <div className="flex min-h-[120px] items-center justify-center p-6 text-lg font-medium opacity-90">
            Sample translation content...
          </div>
          <div className="flex justify-between border-t border-black/5 bg-black/5 p-3 text-xs font-medium opacity-60 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-center gap-1">
              <span>Flow Translate</span>
            </div>
            <div className="flex gap-2">
              <span className="rounded bg-white/50 px-1 shadow-sm">Space x 3</span>
              <span className="rounded bg-white/50 px-1 shadow-sm">Esc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
