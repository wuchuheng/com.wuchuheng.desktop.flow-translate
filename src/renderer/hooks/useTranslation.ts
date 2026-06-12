import { useState, useEffect, useRef } from 'react';

/** Auto-dismiss error display after this many milliseconds */
const ERROR_DISPLAY_DURATION_MS = 5000;

/**
 * Manages the translation lifecycle: start, stream chunks, display errors, reset.
 *
 * Streams chunks from the main process via IPC and auto-dismisses errors
 * after {@link ERROR_DISPLAY_DURATION_MS}.
 */
export const useTranslation = () => {
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const originalInputRef = useRef<string>('');

  // Listen for streaming translation chunks from the main process
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

  // Auto-dismiss error banner after timeout
  useEffect(() => {
    if (!hasError) return;

    const timer = setTimeout(() => setHasError(false), ERROR_DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hasError]);

  /** Send text to the main process for translation. */
  const startTranslation = (text: string, closeAfter: boolean = true) => {
    originalInputRef.current = text;
    setTranslation('');
    setHasError(false);
    setIsTranslating(true);
    window.electron.translation.startTranslation({
      text,
      backspaceCount: 0,
      closeAfter,
    });
  };

  /** Reset all translation state to idle. */
  const resetTranslation = () => {
    setTranslation('');
    setIsTranslating(false);
    setHasError(false);
    originalInputRef.current = '';
  };

  /** Returns the original input text (for error recovery). */
  const getOriginalInput = () => originalInputRef.current;

  return { translation, isTranslating, hasError, startTranslation, resetTranslation, getOriginalInput };
};
