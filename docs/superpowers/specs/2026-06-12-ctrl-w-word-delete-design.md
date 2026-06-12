# Ctrl+W Word Delete in Floating Window Input

**Date:** 2026-06-12
**Status:** Draft

## Problem

Pressing `Ctrl+W` in the floating translation window closes the window (Electron's default behavior). Users expect `Ctrl+W` to delete the word before the cursor — the standard behavior in terminals, editors, and most text inputs.

## Goal

Intercept `Ctrl+W` / `Cmd+W` in the floating window's textarea so it deletes the word before the cursor instead of closing the window. When the input is empty, `Ctrl+W` should do nothing (not close the window).

## Approach

Add a `Ctrl+W` handler in the existing `useShortcuts` hook. This keeps the logic centralized with other keyboard shortcuts and requires minimal changes.

## Changes

### 1. `src/renderer/hooks/useShortcuts.ts`

- Add `textareaRef: React.RefObject<HTMLTextAreaElement>` as a parameter
- Add a new handler before the existing key checks:

```typescript
if (e.key === 'w' && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  e.stopPropagation();

  if (!input) return;

  const textarea = textareaRef.current;
  if (!textarea) return;

  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = input.slice(0, cursorPos);
  const textAfterCursor = input.slice(cursorPos);

  // Remove trailing whitespace, then remove the last word
  const trimmed = textBeforeCursor.replace(/\s+$/, '');
  const wordRemoved = trimmed.replace(/\S+\s*$/, '');

  const newValue = wordRemoved + textAfterCursor;
  setInput(newValue);

  // Restore cursor position after React re-renders
  const newCursorPos = wordRemoved.length;
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  });

  return;
}
```

### 2. `src/renderer/pages/FlowTranslate/FlowTranslate.tsx`

- Pass `textareaRef` as the first argument to `useShortcuts`:

```typescript
const { handleKeyDown } = useShortcuts(input, setInput, submitTranslation, () => window.electron.window.hide(), textareaRef);
```

## Word Deletion Algorithm

For text `"hello world|"` (cursor at end):

1. Text before cursor: `"hello world"`
2. Strip trailing whitespace: `"hello world"`
3. Remove last word + any preceding whitespace: `"hello "`
4. Result: `"hello "` (preserves the space, cursor at position 6)

Edge cases:
- **Empty input:** do nothing, don't close window
- **Only whitespace:** clears to empty
- **Cursor in middle of text:** deletes word before cursor, preserves text after cursor
- **Cursor at start of text:** does nothing (nothing to delete before cursor)

## Testing

- Verify `Ctrl+W` deletes word before cursor
- Verify `Ctrl+W` on empty input does nothing (window stays open)
- Verify `Ctrl+W` with cursor in middle of text works correctly
- Verify cursor position is restored after deletion
- Verify `Ctrl+W` on macOS (`Cmd+W`) also works
- Verify other shortcuts (`Escape`, `Ctrl+C`, `Ctrl+D`, `Enter`, etc.) still work
- Verify the window does NOT close when pressing `Ctrl+W`
