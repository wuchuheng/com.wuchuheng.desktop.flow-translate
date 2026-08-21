# Reasoning Compatibility, Usage, and Focus Feedback — Design Spec

## Summary

Keep a single user-facing **Reasoning** switch while translating it into one,
provider-specific request dialect. Add truthful reasoning-token usage to the popup
footer when the provider returns it, and show a red focus-status dot when the visible
popup cannot receive keyboard input because it is not the active window.

Supported provider families are OpenAI-compatible APIs, GLM, OpenRouter, Qwen,
DeepSeek, Ollama, vLLM, and llama.cpp.

## Goals and Non-goals

### Goals

- A user turns Reasoning on or off without entering provider-specific JSON.
- Every request contains at most one reasoning dialect.
- An unsupported reasoning field never permanently breaks translation.
- Report the provider's actual reasoning-token count, when available.
- Make a visible-but-inactive popup clearly distinguishable from an input-ready one.

### Non-goals

- Support every public or private provider parameter format.
- Estimate reasoning-token usage when a provider does not report it.
- Add native Anthropic or Gemini transports in this release.
- Display chain-of-thought text; only usage metadata is shown.

## Architecture

```
AiConfig (enableThinking)
          |
          v
reasoning capability resolver
          |
          +-- request profile --> parser stream --> normalized usage
          |                                      |
          |                                      v
          +-- one retry without profile field --> translation IPC --> popup footer
```

Replace the current generic `addThinkingArgument` fallback with a capability resolver.
It receives the provider ID, normalized base URL, and model, then returns one request
profile. A profile owns its request fields and its response/usage normalization. It
must never be merged with another profile's fields.

The resolver also owns a session-only unsupported-capability cache, keyed by normalized
endpoint plus model. An entry tells the app to omit the reasoning field on later
requests for that target.

## Request Profiles

| Profile | Applies to | On | Off | Notes |
|---|---|---|---|---|
| `openrouter` | OpenRouter | `reasoning` object | OpenRouter off form | Use its unified reasoning dialect only. |
| `deepseek` | DeepSeek | `thinking: { type: 'enabled' }` | `thinking: { type: 'disabled' }` | Optional effort must use DeepSeek's supported values. |
| `qwen` | Qwen and known Qwen-compatible gateways | `enable_thinking: true` | `enable_thinking: false` | Do not mix with a `thinking` object. |
| `glm` | Zhipu GLM | `thinking: { type: 'enabled' }` | `thinking: { type: 'disabled' }` | Keep GLM matching model rules in the profile. |
| `ollama` | Ollama native API | `think: true` | `think: false` | Uses `/api/chat`, not the OpenAI parser. |
| `openai-compatible` | OpenAI, vLLM, llama.cpp, custom endpoints | no reasoning field by default | no reasoning field | A known, explicitly supported model profile may opt in later. |

`extraBody` must not overwrite profile-managed paths, including `reasoning`,
`reasoning_effort`, `thinking`, `enable_thinking`, and `think`. The UI has one switch;
advanced request JSON must not silently contradict it.

## Compatibility Fallback

1. Build a request with the selected profile's fields.
2. If it receives a parameter-validation error attributable to that reasoning field,
   retry exactly once without all reasoning-specific fields.
3. Cache that unsupported outcome for the normalized endpoint + model for the current
   app session.
4. Complete the translation and show a brief non-blocking notice that reasoning was
   unavailable for that endpoint/model.

Authentication, rate-limit, network, timeout, and ordinary model errors are not
retried. The retry is never used for an unknown endpoint, which already receives a
normal request without a reasoning field.

## Streaming Usage Normalization

Extend `StreamChunk.usage` and `TranslateChunkPayload.stats` to preserve:

```ts
type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
};
```

Profiles normalize the metadata they receive to this shape. Examples include
`completion_tokens_details.reasoning_tokens`, `output_tokens_details.thinking_tokens`,
and provider-specific equivalent fields. `reasoningTokens` is optional and is never
calculated from completion tokens or response text.

The footer shows `Reasoning: N tokens` when the final stream usage contains a count.
Because reasoning tokens are billed output tokens, the label denotes a subset of the
completion/output total, not an additional charge. If reasoning was enabled but no
count is reported, show `Reasoning: usage not reported` after completion.

## Focus Feedback

`FlowTranslate` maintains a window-active state using browser `focus` and `blur`
events, with the existing Electron `window:onShow` handler resetting it to active.

- If the popup is visible and inactive, show a small red dot at the bottom-right of
  its footer with the tooltip: `Click this window or use the shortcut to type.`
- Hide it as soon as the window regains focus.
- Do not use textarea focus as the condition: controls inside an active popup may
  temporarily own focus while the user can still interact normally.

## Files Expected to Change

| File | Change |
|---|---|
| `src/shared/ai-helper.ts` | Replace fallback injection with capability resolution and protected-key handling. |
| `src/shared/constants.ts` | Define provider capability metadata. |
| `src/shared/types.ts` | Add optional normalized reasoning usage. |
| `src/shared/parsers/openai.ts` | Apply one profile, perform the bounded fallback, normalize supported usage fields. |
| `src/shared/parsers/ollama.ts` | Normalize native Ollama usage when supplied. |
| `src/main/ipc/translation/startTranslation.ipc.ts` | Forward reasoning usage and compatibility notices. |
| `src/renderer/hooks/useTranslation.ts` | Store/reset optional reasoning usage and notices. |
| `src/renderer/pages/FlowTranslate/FlowTranslate.tsx` | Add active-window tracking, red dot, and reasoning-token footer note. |

## Tests

- Resolver table tests cover every profile and prove no request combines dialects.
- OpenAI-compatible/vLLM/llama.cpp/custom targets omit reasoning fields by default.
- A recognized validation error triggers one field-free retry, caches the result, and
  emits the compatibility notice; unrelated errors do not retry.
- Parser fixtures normalize reported reasoning usage and preserve its absence.
- Popup tests cover show, blur, focus, and footer states for reported/unreported usage.

## Acceptance Criteria

1. Each named provider family emits only its compatible reasoning form.
2. A failing known reasoning form has one safe fallback and later requests do not
   repeat the failure during the same app session.
3. The popup red dot is visible only while the visible popup is not the active window.
4. The footer shows an actual provider-reported reasoning-token count when available,
   otherwise clearly reports that the number is unavailable.
