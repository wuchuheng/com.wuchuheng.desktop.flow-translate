import { useState, useEffect } from 'react';

/**
 * Reactive hook that tracks the system color scheme preference.
 * @returns `true` when the OS is in dark mode
 */
export const useTheme = (): boolean => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(query.matches);

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    query.addEventListener('change', handler);

    return () => query.removeEventListener('change', handler);
  }, []);

  return isDarkMode;
};
