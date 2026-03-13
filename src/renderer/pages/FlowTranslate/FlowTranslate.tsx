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

  const submitTranslation = (closeWindow: boolean = false) => {
    if (input.trim() && !isTranslating) {
      startTranslation(input.trim(), closeWindow);
      if (closeWindow) {
        setInput('');
      }
    }
  };

  const { handleKeyDown } = useShortcuts(input, setInput, submitTranslation, () => window.electron.window.hide());

  // Sync translation result back into the input field in real-time
  useEffect(() => {
    if (isTranslating && translation && !hasError) {
      setInput(translation);
    }
  }, [translation, isTranslating, hasError]);

  useEffect(() => {
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
      textareaRef.current?.focus();
    });

    return () => {
      unsubscribeOnShow();
    };
  }, [resetTranslation]);

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
          <textarea
            ref={textareaRef}
            className="custom-scrollbar max-h-full min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent p-4 text-lg font-medium leading-relaxed text-inherit placeholder-gray-400 outline-none [field-sizing:content] focus:ring-0 dark:placeholder-white/20"
            placeholder="Ask Flow..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
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
          <div className="grid w-full grid-cols-3 gap-x-2 gap-y-1">
            {!isTranslating ? (
              <>
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
              </>
            ) : (
              <div className="col-span-3 flex items-center justify-center gap-2 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-blue-400"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Processing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
