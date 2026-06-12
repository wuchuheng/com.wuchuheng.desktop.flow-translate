import { useEffect, useRef } from 'react';

type ResizeOptions = {
  /** Fixed width for the Electron window (default: 600) */
  width?: number;
  /** Minimum window height in pixels (default: 100) */
  minHeight?: number;
  /** Maximum window height in pixels (default: 800) */
  maxHeight?: number;
};

/**
 * Observes a container element and resizes the Electron BrowserWindow
 * to fit its content, clamped between minHeight and maxHeight.
 */
export const useAutoResize = (ref: React.RefObject<HTMLElement | null>, options: ResizeOptions = {}) => {
  const { width = 600, minHeight = 100, maxHeight = 800 } = options;
  const previousHeight = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      if (!ref.current) return;

      let height = ref.current.scrollHeight;

      if (height < minHeight) height = minHeight;
      if (height > maxHeight) height = maxHeight;

      if (height !== previousHeight.current) {
        previousHeight.current = height;
        window.electron.window.resize({ width, height });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, width, minHeight, maxHeight]);
};
