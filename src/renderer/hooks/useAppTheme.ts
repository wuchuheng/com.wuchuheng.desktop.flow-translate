import { useState, useEffect } from 'react';
import { ThemeConfig, DEFAULT_THEME_CONFIG, CONFIG_KEYS } from '@/shared/constants';
import { useTheme } from './useTheme';

export const useAppTheme = () => {
  const isSystemDark = useTheme();
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);

  useEffect(() => {
    // Initial load
    window.electron.config.get(CONFIG_KEYS.THEME).then(val => {
      if (val) setTheme(val as ThemeConfig);
    });

    // Listen for updates
    const unsubscribe = window.electron.config.onThemeUpdate(val => {
      if (val) setTheme(val as ThemeConfig);
    });

    return unsubscribe;
  }, []);

  const isDarkMode = theme.mode === 'dark' || (theme.mode === 'system' && isSystemDark);

  return { theme, isDarkMode };
};
