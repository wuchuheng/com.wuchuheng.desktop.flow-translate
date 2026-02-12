import React, { useEffect, useState } from 'react';
import { Typography, Space, Divider, Spin } from 'antd';
import { GithubOutlined, GlobalOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface AppInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  website: string;
}

export const AboutTab: React.FC = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electron.system.getAppInfo().then(res => {
      setInfo(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-500 shadow-xl shadow-blue-500/20">
         <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
         </svg>
      </div>

      <Title level={2} className="mb-1 dark:text-white">
        {info?.name}
      </Title>
      
      <Text type="secondary" className="mb-6 block font-mono">
        v{info?.version}
      </Text>

      <Paragraph className="max-w-md text-base leading-relaxed text-gray-600 dark:text-gray-400">
        {info?.description || t('about.version.description')}
      </Paragraph>

      <Divider className="my-8" />

      <Space size="large" className="text-gray-500">
        <Space direction="vertical" size={2}>
           <Text strong className="dark:text-gray-300">{t('about.version.author')}</Text>
           <Text type="secondary">{info?.author}</Text>
        </Space>
        
        <Divider type="vertical" className="h-10" />

        <Space direction="vertical" size={2}>
           <Text strong className="dark:text-gray-300">{t('about.version.license')}</Text>
           <Text type="secondary">MIT</Text>
        </Space>
      </Space>

      <div className="mt-10 flex gap-4">
        {info?.website && (
          <a 
            href={info.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-all hover:border-blue-500 hover:text-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-blue-500"
          >
            <GithubOutlined /> {t('about.contact.github')}
          </a>
        )}
        <a 
          href="https://wuchuheng.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-all hover:border-blue-500 hover:text-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-blue-500"
        >
          <GlobalOutlined /> {t('about.contact.support')}
        </a>
      </div>

      <div className="mt-12 flex items-center gap-2 text-xs text-gray-400">
        <InfoCircleOutlined />
        <span>{t('about.subtitle')}</span>
      </div>
    </div>
  );
};
