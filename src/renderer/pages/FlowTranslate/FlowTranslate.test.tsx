import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_CONFIG } from '@/shared/constants';
import { FlowTranslate } from './FlowTranslate';

const state = vi.hoisted(() => ({
  onShow: undefined as (() => Promise<void>) | undefined,
  translation: {
    translation: '',
    isTranslating: false,
    hasError: false,
    startTranslation: vi.fn(),
    resetTranslation: vi.fn(),
    getOriginalInput: vi.fn(() => ''),
    elapsedMs: 0,
    charsReceived: 0,
    completionTokens: undefined as number | undefined,
    promptTokens: undefined as number | undefined,
    reasoningTokens: undefined as number | undefined,
    reasoningUsageUnavailable: false,
  },
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => state.translation,
}));

vi.mock('../../hooks/useShortcuts', () => ({
  useShortcuts: () => ({ handleKeyDown: vi.fn() }),
}));

vi.mock('../../hooks/useAppTheme', () => ({
  useAppTheme: () => ({ theme: { mode: 'light', backgroundColor: '#ffffff', opacity: 1 }, isDarkMode: false }),
}));

vi.mock('../../hooks/useHistory', () => ({
  useHistory: () => ({
    mode: 'latest',
    activeId: null as number | null,
    showingSide: 'input',
    historyList: [] as unknown[],
    activeContent: null as { input?: string; transaction?: string } | null,
    navigate: vi.fn(),
    toggleSide: vi.fn(),
    onEditInHistory: vi.fn(),
    cacheLatest: vi.fn(),
    getCachedLatest: vi.fn(() => ''),
    isTransactionEmpty: vi.fn(() => false),
    getTextareaValue: vi.fn((input: string) => input),
    resetToLatest: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDraft', () => ({
  useDraft: () => ({ saveDraft: vi.fn(), restoreDraft: vi.fn().mockResolvedValue(null) }),
}));

const installElectronMock = (enableThinking: boolean) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      config: {
        get: vi.fn().mockResolvedValue({ ...DEFAULT_AI_CONFIG, enableThinking }),
      },
      window: {
        hide: vi.fn(),
        resize: vi.fn(),
        onShow: (listener: () => Promise<void>) => {
          state.onShow = listener;
          return vi.fn();
        },
      },
    },
  });
};

describe('FlowTranslate focus and reasoning feedback', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    state.onShow = undefined;
    Object.assign(state.translation, {
      translation: '',
      isTranslating: false,
      hasError: false,
      elapsedMs: 0,
      charsReceived: 0,
      completionTokens: undefined,
      promptTokens: undefined,
      reasoningTokens: undefined,
      reasoningUsageUnavailable: false,
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  it('shows an accessible inactive indicator only while the popup window is blurred', async () => {
    installElectronMock(false);
    render(<FlowTranslate />);

    expect(screen.queryByLabelText('Input inactive')).toBeNull();

    act(() => window.dispatchEvent(new Event('blur')));
    expect(screen.getByLabelText('Input inactive').getAttribute('title')).toBe(
      'Click this window or use the shortcut to type.'
    );

    act(() => window.dispatchEvent(new Event('focus')));
    expect(screen.queryByLabelText('Input inactive')).toBeNull();

    act(() => window.dispatchEvent(new Event('blur')));
    await act(async () => state.onShow?.());
    expect(screen.queryByLabelText('Input inactive')).toBeNull();
  });

  it('renders reported reasoning usage while translation is active', async () => {
    installElectronMock(true);
    Object.assign(state.translation, { isTranslating: true, charsReceived: 10, reasoningTokens: 17 });
    render(<FlowTranslate />);

    expect(await screen.findByText('Reasoning: 17 tokens')).not.toBeNull();
  });

  it('renders unavailable reasoning usage only for a reasoning-enabled request', async () => {
    installElectronMock(true);
    Object.assign(state.translation, { charsReceived: 10, reasoningUsageUnavailable: true });
    render(<FlowTranslate />);

    expect(await screen.findByText('Reasoning: usage not reported')).not.toBeNull();

    cleanup();
    installElectronMock(false);
    render(<FlowTranslate />);
    await act(async () => Promise.resolve());
    expect(screen.queryByText('Reasoning: usage not reported')).toBeNull();
  });
});
