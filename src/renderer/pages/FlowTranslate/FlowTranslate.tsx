import React, { useState, useEffect, useRef } from 'react';
import { Key } from '../../components/Key';
import { useTranslation } from '../../hooks/useTranslation';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useAppTheme } from '../../hooks/useAppTheme';
import { hexToRgba } from '@/shared/utils';

export const FlowTranslate: React.FC = () => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { theme, isDarkMode } = useAppTheme();
  const { translation, isTranslating, hasError, startTranslation, resetTranslation } = useTranslation();

  useAutoResize(containerRef, {
    minHeight: 100, // Input + Footer approx
    maxHeight: 600, // Max expansion
  });

  const submitTranslation = () => {
    if (input.trim() && !isTranslating) {
      startTranslation(input.trim());
      setInput('');
    }
  };

  const { handleKeyDown, resetSpaceTimes } = useShortcuts(submitTranslation, () => window.electron.window.hide());

  useEffect(() => {
    // Initial focus
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);

    // Setup window style
    const app = document.getElementById('app') as HTMLDivElement;
    if (app) {
      app.style.display = 'block';
      app.style.height = '100vh';
      app.style.width = '100vw';
      document.title = '';
    }

    // Handle show event
    const unsubscribeOnShow = window.electron.window.onShow(() => {
      setInput('');
      resetTranslation();
      resetSpaceTimes();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    });

    return () => {
      unsubscribeOnShow();
      clearTimeout(focusTimer);
    };
  }, [resetTranslation, resetSpaceTimes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const dynamicBgStyle = {
    backgroundColor: hexToRgba(theme.backgroundColor, theme.opacity),
  };

  return (
    <div
      ref={containerRef}
      className={`max-h-screen w-full overflow-hidden font-sans ${isDarkMode ? 'dark text-white' : 'text-gray-900'}`}
    >
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_24px_48px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.5)]"
        style={dynamicBgStyle}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {!isTranslating && !translation && (
            <textarea
              ref={textareaRef}
              className="custom-scrollbar max-h-full min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent p-4 text-lg font-medium leading-relaxed text-inherit placeholder-gray-400 outline-none [field-sizing:content] focus:ring-0 dark:placeholder-white/20"
              placeholder="Ask Flow..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}

          {(isTranslating || translation) && (
            <div className="custom-scrollbar flex h-full flex-col gap-2 overflow-y-auto p-4">
              <div
                className={`mb-1 text-xs font-bold uppercase tracking-widest ${hasError ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}
              >
                {hasError ? 'Error' : 'Translation'}
              </div>
              <div className="text-lg font-light leading-relaxed text-inherit">
                {translation || 'Thinking...'}
                {isTranslating && (
                  <span className="ml-1 inline-block h-5 w-1.5 animate-pulse rounded-full bg-blue-500 align-middle dark:bg-blue-400" />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-none items-center justify-between border-t border-black/5 bg-black/[0.02] px-4 py-3 text-xs font-medium text-gray-400 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
          <div className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-500 dark:text-blue-400"
            >
              <path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" />
              <path d="M12 2v20" />
              <path d="M2 12h20" />
            </svg>
            <span>Flow Translate</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Grammarly sign-in button — opens a login window in the shared Grammarly session */}
            <button
              title="Sign in to Grammarly"
              onClick={() => window.electron.grammarly.openAuth()}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-green-600 opacity-60 transition-opacity hover:opacity-100 dark:text-green-400"
            >
              {/* Grammarly G icon */}
              <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 4a10 10 0 0 1 7.94 3.94L20.5 13.38A5.98 5.98 0 0 0 16 11a5 5 0 0 0 0 10 5.02 5.02 0 0 0 4.9-4H16v-3.5h8.46c.07.48.11.97.11 1.5 0 5.523-4.477 10-10 10S6 20.523 6 16 10.477 6 16 6z"/>
              </svg>
              Grammarly
            </button>
          </div>

          <div className="flex items-center gap-3">
            {!isTranslating ? (
              <>
                <div
                  className="group flex cursor-pointer items-center"
                  onClick={e => {
                    e.stopPropagation();
                    submitTranslation();
                  }}
                >
                  <Key onClick={submitTranslation} title="Click to translate">
                    Space
                  </Key>{' '}
                  <span className="mx-0.5 text-[10px]">×</span> <Key onClick={submitTranslation}>3</Key>
                  <span className="ml-1 transition-colors group-hover:text-blue-400">to translate</span>
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
                  <span className="ml-1 transition-colors group-hover:text-red-400">to close</span>
                </div>
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-blue-400"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
                </span>
                Processing...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
