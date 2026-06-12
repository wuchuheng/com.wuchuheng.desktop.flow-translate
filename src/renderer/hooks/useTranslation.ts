import { useState, useEffect, useRef } from 'react';

/** Auto-dismiss error display after this many milliseconds */
const ERROR_DISPLAY_DURATION_MS = 5000;

/** Refresh interval for the streaming elapsed-time display */
const ELAPSED_TICK_MS = 100;

/**
 * Manages the translation lifecycle: start, stream chunks, display errors, reset.
 *
 * Streams chunks from the main process via IPC, tracks elapsed time and data
 * received for real-time stats display in the footer, and auto-dismisses errors
 * after {@link ERROR_DISPLAY_DURATION_MS}.
 */
export const useTranslation = () => {
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const originalInputRef = useRef<string>('');

  // Streaming stats
  const [elapsedMs, setElapsedMs] = useState(0);
  const [charsReceived, setCharsReceived] = useState(0);
  const [completionTokens, setCompletionTokens] = useState<number | undefined>(undefined);
  const [promptTokens, setPromptTokens] = useState<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);

  // Listen for streaming translation chunks from the main process
  useEffect(() => {
    const unsubscribe = window.electron.translation.onTranslateChunk(payload => {
      if (payload.isError) {
        setHasError(true);
      }
      if (payload.chunk) {
        setTranslation(prev => prev + payload.chunk);
      }
      if (payload.stats) {
        setCharsReceived(payload.stats.charsReceived);
        if (payload.stats.completionTokens !== undefined) {
          setCompletionTokens(payload.stats.completionTokens);
        }
        if (payload.stats.promptTokens !== undefined) {
          setPromptTokens(payload.stats.promptTokens);
        }
      }
      if (payload.done) {
        setIsTranslating(false);
      }
    });
    return unsubscribe;
  }, []);

  // Tick elapsed time while translating
  useEffect(() => {
    if (!isTranslating) {
      setElapsedMs(0);
      return;
    }

    startTimeRef.current = Date.now();
    setElapsedMs(0);

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, ELAPSED_TICK_MS);

    return () => clearInterval(timer);
  }, [isTranslating]);

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
    setCharsReceived(0);
    setCompletionTokens(undefined);
    setPromptTokens(undefined);
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
    setElapsedMs(0);
    setCharsReceived(0);
    setCompletionTokens(undefined);
    setPromptTokens(undefined);
    originalInputRef.current = '';
  };

  /** Returns the original input text (for error recovery). */
  const getOriginalInput = () => originalInputRef.current;

  return {
    translation,
    isTranslating,
    hasError,
    startTranslation,
    resetTranslation,
    getOriginalInput,
    elapsedMs,
    charsReceived,
    completionTokens,
    promptTokens,
  };
};
