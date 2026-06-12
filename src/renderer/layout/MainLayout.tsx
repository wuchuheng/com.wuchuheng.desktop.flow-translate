import React, { useCallback, useState, useEffect, createContext } from 'react';
import TitleBar from './TitleBar';
import { ConfigProvider, theme, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Bootloading } from './Bootloading';
import type { MessageInstance } from 'antd/es/message/interface';
import { useLocation } from 'react-router-dom';

export const MessageContext = createContext<MessageInstance | undefined>(undefined);

type MainLayoutProps = {
  children: React.ReactNode;
};

/**
 * Root layout that wraps all pages.
 *
 * - Full chrome (title bar + boot loading) for settings pages
 * - Bare output for the floating translation window and update dialog
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Ensure light theme on mount
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    setIsDarkTheme(false);
  }, []);

  const onToggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkTheme(document.documentElement.classList.contains('dark'));
  };

  const { i18n } = useTranslation();

  const onToggleLanguage = useCallback(() => {
    const newLang = i18n.language.startsWith('en') ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
  }, [i18n]);

  const isBare = location.pathname.includes('/flow-translate') || location.pathname.includes('/update-dialog');

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#1890ff', borderRadius: 6 },
        algorithm: isDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      {contextHolder}
      <MessageContext.Provider value={messageApi}>
        {isBare ? (
          <>{children}</>
        ) : (
          <div className="flex h-[100vh] flex-col bg-background-primary">
            <TitleBar isDarkTheme={isDarkTheme} onToggleTheme={onToggleTheme} onToggleLanguage={onToggleLanguage} />
            <main className="flex-1 overflow-y-auto">
              <Bootloading>{children}</Bootloading>
            </main>
          </div>
        )}
      </MessageContext.Provider>
    </ConfigProvider>
  );
};
