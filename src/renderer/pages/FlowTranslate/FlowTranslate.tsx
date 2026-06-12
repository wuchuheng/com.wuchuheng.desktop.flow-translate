import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Key } from '../../components/Key';
import { useTranslation } from '../../hooks/useTranslation';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useHistory } from '../../hooks/useHistory';
import { hexToRgba } from '@/shared/utils';

/** Custom scrollbar styles for the textarea (light + dark variants) */
const SCROLLBAR_STYLES = `
  .custom-scrollbar::-webkit-scrollbar { width: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.2); }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.1); }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.2); }
`;

/**
 * Floating translation window — the primary UI of the app.
 *
 * Auto-focuses on show, streams translation results in real-time,
 * and resizes the Electron BrowserWindow to fit content.
 * Supports history navigation via Ctrl+Up/Down/Left/Right.
 */
export const FlowTranslate: React.FC = () => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { theme, isDarkMode } = useAppTheme();
  const {
    translation, isTranslating, hasError, startTranslation, resetTranslation, getOriginalInput,
    elapsedMs, charsReceived, tokensUsed,
  } = useTranslation();
  const {
    mode, activeId, showingSide, historyList, activeContent,
    navigate, toggleSide, onEditInHistory, cacheLatest, getCachedLatest,
    isTransactionEmpty, getTextareaValue, resetToLatest,
  } = useHistory();

  // Handle Enter in history mode: copy stored result, lazy AI if empty
  const handleHistorySubmit = useCallback((closeWindow: boolean) => {
    if (activeContent?.transaction) {
      // Transaction exists — copy directly
      window.electron.system.copyAndPaste(activeContent.transaction);
      if (closeWindow) {
        window.electron.window.hide();
      }
    } else if (activeContent?.input && isTransactionEmpty()) {
      // Lazy AI: transaction is empty, translate first then copy
      const text = activeContent.input;
      resetToLatest();
      setInput(text);
      startTranslation(text, closeWindow);
    }
  }, [activeContent, isTransactionEmpty, startTranslation, resetToLatest]);

  // Handle toggle to transaction side that's empty → lazy AI
  const handleToggleSide = useCallback(() => {
    const newSide = toggleSide();
    if (newSide === 'transaction' && isTransactionEmpty() && activeContent?.input) {
      const text = activeContent.input;
      resetToLatest();
      setInput(text);
      startTranslation(text);
    }
  }, [toggleSide, isTransactionEmpty, activeContent, startTranslation, resetToLatest]);

  const submitTranslation = useCallback((closeWindow: boolean = false) => {
    if (mode === 'history') {
      handleHistorySubmit(closeWindow);
      return;
    }
    if (input.trim() && !isTranslating) {
      startTranslation(input.trim(), closeWindow);
      if (closeWindow) {
        setInput('');
      }
    }
  }, [mode, input, isTranslating, startTranslation, handleHistorySubmit]);

  // Wire shortcuts with history callbacks
  const { handleKeyDown } = useShortcuts(
    input,
    setInput,
    {
      onSubmit: submitTranslation,
      onClose: () => window.electron.window.hide(),
      onNavigate: (dir) => {
        if (dir === 'up') {
          if (input.trim()) {
            cacheLatest(input);
          }
          navigate(dir);
        } else {
          navigate(dir);
        }
      },
      onToggleSide: handleToggleSide,
      isHistoryMode: mode === 'history',
      isTransactionEmpty: isTransactionEmpty(),
    },
    textareaRef
  );

  // determine the textarea value
  const textareaValue = mode === 'latest'
    ? (isTranslating ? translation : input)
    : getTextareaValue(input);

  // When translation streams, populate the input
  useEffect(() => {
    if (isTranslating && translation && !hasError) {
      setInput(translation);
    }
  }, [translation, isTranslating, hasError]);

  // Auto-scroll to latest text during AI streaming
  useEffect(() => {
    if (isTranslating && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [translation, isTranslating]);

  // Observe textarea for content-driven height changes (field-sizing:content)
  // and resize the Electron window accordingly
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const FOOTER_RESERVE = 90;
    const MIN_WIN = 100;
    const MAX_WIN = 400;

    const observer = new ResizeObserver(() => {
      const contentHeight = ta.scrollHeight;
      const desiredHeight = contentHeight + FOOTER_RESERVE;
      const winHeight = Math.min(Math.max(MIN_WIN, desiredHeight), MAX_WIN);

      window.electron.window.resize({ width: 600, height: winHeight });

      // Only clamp textarea when window is at the ceiling
      if (winHeight >= MAX_WIN - 10) {
        ta.style.maxHeight = `${MAX_WIN - FOOTER_RESERVE}px`;
      } else {
        ta.style.maxHeight = '';
      }
    });

    observer.observe(ta);
    return () => observer.disconnect();
  }, []);

  // Restore original input on AI error
  useEffect(() => {
    if (hasError && getOriginalInput()) {
      setInput(getOriginalInput());
    }
  }, [hasError, getOriginalInput]);

  // When returning to "latest" mode, restore cached text
  useEffect(() => {
    if (mode === 'latest') {
      const cached = getCachedLatest();
      if (cached) {
        setInput(cached);
      }
    }
  }, [mode, getCachedLatest]);

  // Setup window styles and focus handler on show
  useEffect(() => {
    const app = document.getElementById('app') as HTMLDivElement | null;
    if (app) {
      app.style.display = 'block';
      app.style.height = '100vh';
      app.style.width = '100vw';
      document.title = 'FlowTranslatePopup';
    }

    const unsubscribeOnShow = window.electron.window.onShow(() => {
      setInput('');
      resetTranslation();
      resetToLatest();
      textareaRef.current?.focus();
    });

    return unsubscribeOnShow;
  }, [resetTranslation, resetToLatest]);

  // Handle edits in history mode
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (mode === 'history') {
      onEditInHistory();
      setInput(newValue);
      return;
    }
    setInput(newValue);
  }, [mode, onEditInHistory]);

  const dynamicBgStyle = { backgroundColor: hexToRgba(theme.backgroundColor, theme.opacity) };

  return (
    <div
      className={`w-full font-sans ${isDarkMode ? 'dark text-white' : 'text-gray-900'}`}
    >
      <style>{SCROLLBAR_STYLES}</style>
      <div
        className="flex w-full flex-col rounded-2xl border border-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_24px_48px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.5)]"
        style={dynamicBgStyle}
      >
        <div className="relative flex flex-col">
          <textarea
            ref={textareaRef}
            className="custom-scrollbar min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent p-4 text-lg font-medium leading-relaxed text-inherit placeholder-gray-400 outline-none [field-sizing:content] focus:ring-0 dark:placeholder-white/20"
            placeholder="Ask Flow..."
            value={textareaValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            readOnly={mode === 'history'}
            autoFocus
          />

          {hasError && translation && (
            <div className="mx-4 mb-2 flex items-center gap-1.5 text-xs font-medium text-red-500/90">
              <span className="font-bold uppercase tracking-wider opacity-70">Error:</span>
              <span className="flex-1 truncate">{translation}</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  resetTranslation();
                }}
                className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-red-500/10"
                title="Clear error"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex min-h-[60px] flex-none items-center justify-between border-t border-black/5 bg-black/[0.02] px-3 py-1.5 text-[11px] font-medium text-gray-400 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
          {isTranslating ? (
            <div className="flex w-full items-center justify-center gap-6 py-1 font-mono text-[11px] tracking-tight">
              <span className="tabular-nums text-blue-500">
                {(elapsedMs / 1000).toFixed(2)}<span className="ml-0.5 text-[9px] text-gray-400">s</span>
              </span>
              <span className="tabular-nums text-blue-500">
                {charsReceived}<span className="ml-0.5 text-[9px] text-gray-400">ch</span>
              </span>
              <span className="tabular-nums text-blue-500">
                {tokensUsed !== undefined ? tokensUsed : `~${Math.max(1, Math.round(charsReceived / 4))}`}<span className="ml-0.5 text-[9px] text-gray-400">tk</span>
              </span>
            </div>
          ) : mode === 'history' && activeId !== null ? (
            <div className="flex w-full items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-amber-500">
                History #{activeId}{historyList.length > 0 ? ` of ${historyList.length}` : ''} — {showingSide === 'input' ? 'Input' : 'Translation'}
              </span>
              <span className="text-[10px] opacity-50">
                Ctrl+← toggle · Ctrl+↑↓ navigate · Enter to copy
              </span>
            </div>
          ) : (
            <div className="grid w-full grid-cols-3 gap-x-2 gap-y-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Enter">Enter</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">trans, copy & close</span>
                </div>
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="Enter">Enter</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">translate only</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Shift">Shift</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="Enter">⏎</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">/</span>
                  <Key title="Ctrl">^</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="J">J</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">new line</span>
                </div>
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="D">D</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">clear content</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="C">C</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">copy & close</span>
                </div>
                <div
                  className="group flex cursor-pointer items-center"
                  onClick={e => {
                    e.stopPropagation();
                    window.electron.window.hide();
                  }}
                >
                  <Key onClick={() => window.electron.window.hide()} title="Click to close">
                    Esc
                  </Key>
                  <span className="ml-0.5 transition-colors group-hover:text-red-400">close only</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
