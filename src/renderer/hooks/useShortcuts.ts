import { useRef } from 'react';

export const useShortcuts = (onSubmit: () => void, onClose: () => void) => {
  const spacePressTimes = useRef<number[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      if (e.repeat) return;
      onSubmit();
      return;
    }

    if (e.key === ' ') {
      const now = Date.now();
      spacePressTimes.current.push(now);
      if (spacePressTimes.current.length > 3) {
        spacePressTimes.current.shift();
      }

      if (spacePressTimes.current.length === 3) {
        const first = spacePressTimes.current[0];
        const last = spacePressTimes.current[2];
        if (last - first < 600) {
          onSubmit();
          spacePressTimes.current = [];
        }
      }
    } else {
      spacePressTimes.current = [];
    }
  };

  return { handleKeyDown, resetSpaceTimes: () => { spacePressTimes.current = []; } };
};
