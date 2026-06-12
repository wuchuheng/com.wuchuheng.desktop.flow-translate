import { useState, useEffect } from 'react';
import type { ThemeConfig } from '@/shared/constants';
import { DEFAULT_THEME_CONFIG, CONFIG_KEYS } from '@/shared/constants';
import { useTheme } from './useTheme';

/**
 * Provides the application theme configuration and resolved dark mode state.
 *
 * Loads the persisted theme from the main process and listens for live updates.
 * When mode is "system", the dark state follows the OS preference.
 */
export const useAppTheme = () => {
  const isSystemDark = useTheme();
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);

  useEffect(() => {
    window.electron.config.get(CONFIG_KEYS.THEME).then(val => {
      if (val) setTheme(val as ThemeConfig);
    });

    const unsubscribe = window.electron.config.onThemeUpdate(val => {
      if (val) setTheme(val as ThemeConfig);
    });

    return unsubscribe;
  }, []);

  const isDarkMode = theme.mode === 'dark' || (theme.mode === 'system' && isSystemDark);

  return { theme, isDarkMode };
};
