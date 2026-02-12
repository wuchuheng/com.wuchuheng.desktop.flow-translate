import { useState, useEffect, useCallback } from 'react';

export const useConfig = <T>(key: string, defaultValue: T) => {
  const [config, setConfig] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electron.config.get(key).then(val => {
      if (val !== null && val !== undefined) {
        setConfig(val as T);
      }
      setLoading(false);
    });
  }, [key]);

  const saveConfig = useCallback(
    async (newConfig: T) => {
      setConfig(newConfig);
      await window.electron.config.save({ key, value: newConfig });
    },
    [key]
  );

  return { config, saveConfig, loading };
};
