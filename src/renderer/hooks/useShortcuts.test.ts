import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useShortcuts } from './useShortcuts';

const createKeyEvent = (overrides: Partial<React.KeyboardEvent<HTMLTextAreaElement>> = {}) => ({
  key: 'j',
  ctrlKey: true,
  metaKey: false,
  preventDefault: vi.fn(),
  ...overrides,
}) as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

describe('useShortcuts Ctrl/Cmd+J newline insertion', () => {
  it('inserts a newline at the caret and places the caret after it', async () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'selectionStart', { value: 1, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 1, configurable: true });
    textarea.setSelectionRange = vi.fn();
    const textareaRef = { current: textarea };
    let input = 'ab';
    const setInput = (value: string) => {
      input = value;
    };
    const preventDefault = vi.fn();
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    const { result } = renderHook(() =>
      useShortcuts(input, setInput, { onSubmit: vi.fn(), onClose: vi.fn() }, textareaRef)
    );

    await act(async () => {
      await result.current.handleKeyDown(createKeyEvent({ preventDefault }));
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(input).toBe('a\nb');
    expect(requestFrame).toHaveBeenCalledOnce();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(2, 2);
  });

  it('replaces the selected text with one newline', async () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'selectionStart', { value: 1, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 3, configurable: true });
    textarea.setSelectionRange = vi.fn();
    const textareaRef = { current: textarea };
    let input = 'abcd';
    const setInput = (value: string) => {
      input = value;
    };
    const { result } = renderHook(() =>
      useShortcuts(input, setInput, { onSubmit: vi.fn(), onClose: vi.fn() }, textareaRef)
    );

    await act(async () => {
      await result.current.handleKeyDown(createKeyEvent({ metaKey: true, ctrlKey: false }));
    });

    expect(input).toBe('a\nd');
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(2, 2);
  });
});
