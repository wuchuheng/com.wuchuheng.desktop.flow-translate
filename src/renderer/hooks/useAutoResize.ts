import { useEffect, useRef } from 'react';

export const useAutoResize = (
  ref: React.RefObject<HTMLElement>,
  options: { width?: number; minHeight?: number; maxHeight?: number } = {}
) => {
  const { width = 600, minHeight = 100, maxHeight = 800 } = options;
  const previousHeight = useRef(0);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(() => {
      if (!ref.current) return;
      
      // Use offsetHeight to include padding/borders
      let height = ref.current.scrollHeight;
      
      // Add a tiny buffer for borders if needed, or rely on scrollHeight
      // If overflow is hidden, scrollHeight is the full content height.
      
      // Clamp height
      if (height < minHeight) height = minHeight;
      if (height > maxHeight) height = maxHeight;

      if (height !== previousHeight.current) {
        previousHeight.current = height;
        window.electron.window.resize({ width, height });
      }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, width, minHeight, maxHeight]);
};
