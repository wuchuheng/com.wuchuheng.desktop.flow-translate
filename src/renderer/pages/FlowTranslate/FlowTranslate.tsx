import React, { useState, useEffect, useRef } from 'react';
import { Key } from '../../components/Key';
import { useTranslation } from '../../hooks/useTranslation';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useAppTheme } from '../../hooks/useAppTheme';
import { hexToRgba } from '../../../shared/utils';

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
      className={`font-sans w-full max-h-screen overflow-hidden ${isDarkMode ? 'dark text-white' : 'text-gray-900'}`}
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
        className="h-full w-full flex flex-col overflow-hidden rounded-2xl backdrop-blur-2xl border border-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_24px_48px_rgba(0,0,0,0.1)] dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.5)]"
        style={dynamicBgStyle}
      >
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          {!isTranslating && !translation && (
            <textarea
              ref={textareaRef}
              className="w-full min-h-[60px] max-h-full [field-sizing:content] bg-transparent text-lg font-medium leading-relaxed p-4 border-none focus:ring-0 resize-none outline-none overflow-y-auto custom-scrollbar text-inherit placeholder-gray-400 dark:placeholder-white/20"
              placeholder="Ask Flow..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}

          {(isTranslating || translation) && (
            <div className="p-4 flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar">
              <div
                className={`mb-1 text-xs font-bold uppercase tracking-widest ${hasError ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}
              >
                {hasError ? 'Error' : 'Translation'}
              </div>
              <div className="text-lg leading-relaxed font-light text-inherit">
                {translation || 'Thinking...'}
                {isTranslating && (
                  <span className="ml-1 inline-block h-5 w-1.5 animate-pulse rounded-full align-middle bg-blue-500 dark:bg-blue-400" />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-none flex items-center justify-between px-4 py-3 border-t text-xs font-medium bg-black/[0.02] border-black/5 text-gray-400 dark:bg-white/5 dark:border-white/5 dark:text-white/40">
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
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-blue-500 dark:bg-blue-400"></span>
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
