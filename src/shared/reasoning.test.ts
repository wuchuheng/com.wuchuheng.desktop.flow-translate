import { describe, expect, it } from 'vitest';
import {
  buildReasoningRequestFields,
  isReasoningDisabledForTarget,
  isReasoningParameterError,
  markReasoningUnsupportedForTarget,
  normalizeEndpointKey,
  resolveReasoningProfile,
} from './reasoning';

describe('resolveReasoningProfile', () => {
  const supportedProfiles = [
    ['openrouter', 'openrouter', 'reasoning'],
    ['deepseek', 'deepseek-chat', 'thinking'],
    ['zhipu', 'glm-4.7-flash', 'thinking'],
    ['qwen', 'qwen-plus', 'enable_thinking'],
  ] as const;

  it.each(supportedProfiles)('uses only %s %s fields when reasoning is enabled', (providerId, model, key) => {
    const profile = resolveReasoningProfile(providerId, model, true);

    expect(profile).not.toBeNull();
    expect(buildReasoningRequestFields(profile!)).toHaveProperty(key);
    expect(Object.keys(buildReasoningRequestFields(profile!))).toEqual([key]);
    expect(Object.keys(buildReasoningRequestFields(profile!)).filter(requestKey => requestKey !== key)).toEqual([]);
  });

  it.each(supportedProfiles)('uses only %s %s fields when reasoning is disabled', (providerId, model, key) => {
    const profile = resolveReasoningProfile(providerId, model, false);

    expect(profile).not.toBeNull();
    expect(buildReasoningRequestFields(profile!)).toHaveProperty(key);
    expect(Object.keys(buildReasoningRequestFields(profile!))).toEqual([key]);
    expect(Object.keys(buildReasoningRequestFields(profile!)).filter(requestKey => requestKey !== key)).toEqual([]);
  });

  it.each(['openai', 'vllm', 'llamacpp', 'custom', 'ollama', 'unknown'])(
    '%s receives no OpenAI reasoning profile',
    providerId => {
      expect(resolveReasoningProfile(providerId, 'model-a', true)).toBeNull();
      expect(resolveReasoningProfile(providerId, 'model-a', false)).toBeNull();
    }
  );
});

describe('reasoning compatibility helpers', () => {
  it('normalizes endpoint keys with a trailing slash and model', () => {
    expect(normalizeEndpointKey('https://api.example.com/v1/', 'model-a')).toBe('https://api.example.com/v1::model-a');
  });

  it('stores unsupported targets only for this module session', () => {
    const key = normalizeEndpointKey('https://api.example.com/v1', 'model-a');

    expect(isReasoningDisabledForTarget(key)).toBe(false);
    markReasoningUnsupportedForTarget(key);
    expect(isReasoningDisabledForTarget(key)).toBe(true);
  });

  it.each([
    [{ status: 400, message: 'Unsupported parameter: enable_thinking' }, true],
    [{ status: 422, message: 'reasoning is not supported for this model' }, true],
    [{ status: 400, message: 'I think the parameter temperature is invalid' }, false],
    [{ status: 422, message: 'Unsupported parameter: temperature' }, false],
    [{ status: 401, message: 'Invalid API key for reasoning endpoint' }, false],
    [{ status: 429, message: 'Rate limit exceeded for thinking requests' }, false],
    [{ status: 408, message: 'Request timeout' }, false],
    [{ status: 500, message: 'Internal server error' }, false],
    [new Error('network connection refused'), false],
  ])('classifies reasoning validation errors: %o', (error, expected) => {
    expect(isReasoningParameterError(error)).toBe(expected);
  });

  it('does not allow callers to mutate stored profile definitions', () => {
    const profile = resolveReasoningProfile('qwen', 'qwen-plus', true)!;
    profile.enableFields.enable_thinking = false;

    expect(buildReasoningRequestFields(resolveReasoningProfile('qwen', 'qwen-plus', true)!)).toEqual({
      enable_thinking: true,
    });
  });
});
