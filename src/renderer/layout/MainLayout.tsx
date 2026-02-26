import React, { useCallback, useState, useEffect, createContext } from 'react';
import TitleBar from './TitleBar';
import { ConfigProvider, theme , message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Bootloading } from './Bootloading';
import { MessageInstance } from 'antd/es/message/interface';

import { useLocation } from 'react-router-dom';

export const MessageContext = createContext<MessageInstance | undefined>(undefined);

type MainLayoutProps = {
  children: React.ReactNode;
};
export const MainLayout: React.FC<MainLayoutProps> = props => {
  const location = useLocation();
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  const [messageApi, contextHolder] = message.useMessage();

  // Initialize theme on component mount - default to light theme
  useEffect(() => {
    // Remove any existing dark class to ensure light theme is default
    document.documentElement.classList.remove('dark');
    setIsDarkTheme(false);
    console.log('Initialize theme on component mount - default to light theme');
  }, []);

  const onToggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkTheme(isDark);
  };

  const { i18n } = useTranslation();

  const onToggleLanguage = useCallback(() => {
    const newLang = i18n.language.startsWith('en') ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
  }, [i18n]);

  const isFlowTranslate = location.pathname.includes('/flow-translate');
  const isUpdateDialog = location.pathname.includes('/update-dialog');
  
  const MainLayoutWindows: React.FC = () =>
    isFlowTranslate || isUpdateDialog ? (
      <>{props.children}</>
    ) : (
      <div className={`flex h-[100vh] flex-col ${isFlowTranslate ? 'bg-transparent' : 'bg-background-primary'}`}>
        <TitleBar isDarkTheme={isDarkTheme} onToggleTheme={onToggleTheme} onToggleLanguage={onToggleLanguage} />
        <main className={`flex-1 ${isFlowTranslate ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Bootloading>{props.children}</Bootloading>
        </main>
      </div>
    );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
        algorithm: isDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      {contextHolder}
      <MessageContext.Provider value={messageApi}>
        <MainLayoutWindows />
      </MessageContext.Provider>
    </ConfigProvider>
  );
};
