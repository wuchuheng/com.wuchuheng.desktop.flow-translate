export type ReasoningFields = Record<string, unknown>;

export type ReasoningProfile = {
  id: 'openrouter' | 'thinking' | 'enable_thinking';
  enableFields: ReasoningFields;
  disableFields: ReasoningFields;
  requestFields: ReasoningFields;
};

type ReasoningProfileDefinition = Omit<ReasoningProfile, 'requestFields'>;

const reasoningProfiles: Record<ReasoningProfile['id'], ReasoningProfileDefinition> = {
  openrouter: {
    id: 'openrouter',
    enableFields: { reasoning: { effort: 'medium' } },
    disableFields: { reasoning: { effort: 'none' } },
  },
  thinking: {
    id: 'thinking',
    enableFields: { thinking: { type: 'enabled' } },
    disableFields: { thinking: { type: 'disabled' } },
  },
  enable_thinking: {
    id: 'enable_thinking',
    enableFields: { enable_thinking: true },
    disableFields: { enable_thinking: false },
  },
};

const unsupportedReasoningTargets = new Set<string>();
const reservedReasoningParameterPattern =
  /(?:\b(?:parameter|field|argument)\s*[:=]?\s*['"`]?\s*(?:reasoning|reasoning_effort|thinking|enable_thinking|think)\b|\b(?:reasoning|reasoning_effort|thinking|enable_thinking|think)\b\s*(?:(?:parameter|field|argument)\s*)?(?:is\s+)?(?:unsupported|unknown|unrecognized|invalid|not allowed|not supported)\b|\b(?:unsupported|unknown|unrecognized|invalid|not allowed|not supported)\s+(?:(?:parameter|field|argument)\s*[:=]?\s*)?(?:reasoning|reasoning_effort|thinking|enable_thinking|think)\b)/i;

/**
 * Returns the one request dialect supported by a provider, if its OpenAI-compatible
 * transport has an explicit reasoning capability.
 */
export const resolveReasoningProfile = (
  providerId: string | undefined,
  model: string,
  enabled: boolean
): ReasoningProfile | null => {
  const profileId = getProfileId(providerId, model);
  if (!profileId) return null;

  const profile = reasoningProfiles[profileId];
  const enableFields = structuredClone(profile.enableFields);
  const disableFields = structuredClone(profile.disableFields);

  return {
    ...profile,
    enableFields,
    disableFields,
    requestFields: structuredClone(enabled ? enableFields : disableFields),
  };
};

/** Returns a new payload fragment so callers cannot mutate profile definitions. */
export const buildReasoningRequestFields = (profile: ReasoningProfile): ReasoningFields => {
  return structuredClone(profile.requestFields);
};

/** Builds a stable session-cache key from an endpoint and model. */
export const normalizeEndpointKey = (baseUrl: string, model: string): string => {
  return `${baseUrl.replace(/\/+$/, '')}::${model}`;
};

/** Checks session-only capability fallback state for a target. */
export const isReasoningDisabledForTarget = (key: string): boolean => {
  return unsupportedReasoningTargets.has(key);
};

/** Remembers that a target rejected its reasoning parameter during this app session. */
export const markReasoningUnsupportedForTarget = (key: string): void => {
  unsupportedReasoningTargets.add(key);
};

/**
 * Limits fallback retries to parameter-validation errors that clearly identify a
 * reasoning parameter as unsupported.
 */
export const isReasoningParameterError = (error: unknown): boolean => {
  const { status, message } = getErrorDetails(error);
  return (status === 400 || status === 422) && reservedReasoningParameterPattern.test(message);
};

const getProfileId = (providerId: string | undefined, model: string): ReasoningProfile['id'] | null => {
  void model;

  switch (providerId?.toLowerCase()) {
    case 'openrouter':
      return 'openrouter';
    case 'deepseek':
    case 'zhipu':
    case 'glm':
      return 'thinking';
    case 'qwen':
      return 'enable_thinking';
    default:
      return null;
  }
};

const getErrorDetails = (error: unknown): { status: number | undefined; message: string } => {
  if (!error || typeof error !== 'object') return { status: undefined, message: '' };

  const candidate = error as { status?: unknown; message?: unknown; error?: { message?: unknown } };
  const message =
    typeof candidate.message === 'string'
      ? candidate.message
      : typeof candidate.error?.message === 'string'
        ? candidate.error.message
        : '';

  return { status: typeof candidate.status === 'number' ? candidate.status : undefined, message };
};
