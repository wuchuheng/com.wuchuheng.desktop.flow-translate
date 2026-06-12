import type { RefObject } from 'react';

/**
 * Deletes the word immediately before the cursor in a textarea.
 * Returns the new text and cursor position, or null if nothing to delete.
 */
const deleteWordBackward = (text: string, cursorPos: number): { text: string; cursorPos: number } | null => {
  const beforeCursor = text.slice(0, cursorPos);
  const afterCursor = text.slice(cursorPos);

  // Match: whitespace+word, whitespace-only, or a word with no preceding whitespace (first word)
  const trimmed = beforeCursor.replace(/(?:\s+\S*|\s+|\S+)$/, '');
  if (trimmed.length === beforeCursor.length) return null;

  return { text: trimmed + afterCursor, cursorPos: trimmed.length };
};

type ShortcutHandlers = {
  onSubmit: (closeWindow?: boolean) => void;
  onClose: () => void;
};

/**
 * Keyboard shortcut handler for the floating translation window.
 *
 * Shortcuts:
 * - Ctrl/Cmd+W  → Delete word before cursor (instead of closing window)
 * - Escape       → Close window
 * - Ctrl/Cmd+C   → Copy input, clear, and close
 * - Ctrl/Cmd+J   → Allow newline (passthrough)
 * - Ctrl/Cmd+D   → Clear input
 * - Enter        → Translate, copy result, and close
 * - Ctrl/Cmd+Enter → Translate only (keep window open)
 * - Shift+Enter  → Newline (passthrough)
 */
export const useShortcuts = (
  input: string,
  setInput: (value: string) => void,
  handlers: ShortcutHandlers,
  textareaRef: RefObject<HTMLTextAreaElement | null>
) => {
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+W: Delete word before cursor
    if (e.key === 'w' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();

      if (!input) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const result = deleteWordBackward(input, textarea.selectionStart);
      if (!result) return;

      setInput(result.text);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(result.cursorPos, result.cursorPos);
      });
      return;
    }

    // Escape: Close window
    if (e.key === 'Escape') {
      e.preventDefault();
      handlers.onClose();
      return;
    }

    // Ctrl/Cmd+C: Copy input content and close
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      if (input.trim()) {
        e.preventDefault();
        const textToCopy = input;
        setInput('');
        handlers.onClose();
        await window.electron.system.copyAndPaste(textToCopy);
      }
      return;
    }

    // Ctrl/Cmd+J: Allow newline (passthrough)
    if (e.key === 'j' && (e.ctrlKey || e.metaKey)) {
      return;
    }

    // Ctrl/Cmd+D: Clear input
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setInput('');
      return;
    }

    // Enter: Translate (with or without closing)
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      if (e.repeat) return;

      handlers.onSubmit(!(e.ctrlKey || e.metaKey));
      return;
    }
  };

  return { handleKeyDown };
};
