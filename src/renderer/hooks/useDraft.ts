import { useRef, useCallback, useEffect } from 'react';

export const useDraft = () => {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const saveDraft = useCallback((text: string, cursorPos: number) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      window.electron.draft.save({ text, cursorPos });
    }, 100);
  }, []);

  const restoreDraft = useCallback(async () => {
    return window.electron.draft.get();
  }, []);

  return { saveDraft, restoreDraft };
};
