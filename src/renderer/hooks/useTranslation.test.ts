import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTranslation } from './useTranslation';

type TranslateChunkListener = (payload: {
  chunk: string;
  done: boolean;
  isError?: boolean;
  reasoningUnavailable?: boolean;
  stats?: {
    charsReceived: number;
    completionTokens?: number;
    promptTokens?: number;
    reasoningTokens?: number;
  };
}) => void;

let translateChunkListener: TranslateChunkListener | undefined;

const installElectronMock = () => {
  translateChunkListener = undefined;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      translation: {
        onTranslateChunk: (listener: TranslateChunkListener) => {
          translateChunkListener = listener;
          return () => {
            translateChunkListener = undefined;
          };
        },
        startTranslation: vi.fn(),
      },
    },
  });
};

describe('useTranslation reasoning usage', () => {
  beforeEach(() => {
    installElectronMock();
  });

  it('preserves reported reasoning tokens after completion and resets request reasoning state', () => {
    const { result } = renderHook(() => useTranslation(true));

    act(() => result.current.startTranslation('Original input'));

    expect(
      (result.current as typeof result.current & { reasoningEnabledForRequest?: boolean }).reasoningEnabledForRequest
    ).toBe(true);

    act(() => {
      translateChunkListener?.({
        chunk: 'Translated',
        done: true,
        stats: { charsReceived: 10, reasoningTokens: 17 },
      });
    });

    expect((result.current as typeof result.current & { reasoningTokens?: number }).reasoningTokens).toBe(17);
    expect(
      (result.current as typeof result.current & { reasoningUsageUnavailable?: boolean }).reasoningUsageUnavailable
    ).toBe(false);

    act(() => result.current.startTranslation('New input'));
    expect((result.current as typeof result.current & { reasoningTokens?: number }).reasoningTokens).toBeUndefined();

    act(() => result.current.resetTranslation());
    expect(
      (result.current as typeof result.current & { reasoningUsageUnavailable?: boolean }).reasoningUsageUnavailable
    ).toBe(false);
    expect(
      (result.current as typeof result.current & { reasoningEnabledForRequest?: boolean }).reasoningEnabledForRequest
    ).toBe(false);
  });

  it('records that a new request started with reasoning disabled', () => {
    const { result } = renderHook(() => useTranslation(false));

    act(() => result.current.startTranslation('Input'));

    expect(
      (result.current as typeof result.current & { reasoningEnabledForRequest?: boolean }).reasoningEnabledForRequest
    ).toBe(false);
  });

  it('stores the explicit reasoning usage fallback and clears it when reset', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      translateChunkListener?.({
        chunk: '',
        done: true,
        reasoningUnavailable: true,
        stats: { charsReceived: 0 },
      });
    });

    expect(
      (result.current as typeof result.current & { reasoningUsageUnavailable?: boolean }).reasoningUsageUnavailable
    ).toBe(true);

    act(() => result.current.resetTranslation());
    expect(
      (result.current as typeof result.current & { reasoningUsageUnavailable?: boolean }).reasoningUsageUnavailable
    ).toBe(false);
  });
});
