import { useState, useEffect } from 'react';

export const useTranslation = () => {
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = window.electron.translation.onTranslateChunk(payload => {
      if (payload.isError) {
        setHasError(true);
      }
      if (payload.chunk) {
        setTranslation(prev => prev + payload.chunk);
      }
      if (payload.done) {
        setIsTranslating(false);
      }
    });
    return unsubscribe;
  }, []);

  const startTranslation = (text: string) => {
    setTranslation('');
    setHasError(false);
    setIsTranslating(true);
    window.electron.translation.startTranslation({
      text,
      backspaceCount: 0,
    });
  };

  const resetTranslation = () => {
    setTranslation('');
    setIsTranslating(false);
    setHasError(false);
  };

  return { translation, isTranslating, hasError, startTranslation, resetTranslation };
};
