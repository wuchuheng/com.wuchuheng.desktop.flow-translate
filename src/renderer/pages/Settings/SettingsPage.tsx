import React from 'react';
import { Tabs } from 'antd';
import { AiSettingsTab } from './components/AiSettingsTab';
import { ThemeSettingsTab } from './components/ThemeSettingsTab';
import { GeneralSettingsTab } from './components/GeneralSettingsTab';
import { AboutTab } from './components/AboutTab';
import { useTranslation } from 'react-i18next';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    { label: 'AI Intelligence', key: 'ai', children: <AiSettingsTab /> },
    { label: 'Theme & Appearance', key: 'theme', children: <ThemeSettingsTab /> },
    { label: 'General', key: 'general', children: <GeneralSettingsTab /> },
    { label: t('about.title'), key: 'about', children: <AboutTab /> },
  ];

  return (
    <div className="h-full bg-gray-50 p-6 dark:bg-[#11111b]">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
        <Tabs items={items} type="card" className="flex-1 custom-tabs" />
      </div>
      <style>{`
        .custom-tabs .ant-tabs-content {
          height: 100%;
        }
        .custom-tabs .ant-tabs-tabpane {
          height: 100%;
        }
        /* Custom Tab Styles */
        .custom-tabs .ant-tabs-nav::before {
           border-bottom-color: transparent !important;
        }
      `}</style>
    </div>
  );
};
