# Reasoning Compatibility and Focus Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one Reasoning switch work safely across the supported provider families, surface provider-reported reasoning-token usage, and identify a visible popup that cannot accept keyboard input.

**Architecture:** Replace generic reasoning-field injection with a resolver that returns exactly one request profile. The OpenAI parser applies that profile, retries once without it only for reasoning-parameter validation failures, and normalizes usage into a shared `reasoningTokens` field. The renderer observes window focus and uses normalized final usage to render the footer.

**Tech Stack:** Electron 36, React 19, TypeScript 5.8, OpenAI SDK 6, Vitest (new dev dependency).

**Spec:** `docs/superpowers/specs/2026-08-22-reasoning-compatibility-and-focus-feedback-design.md`

## Global Constraints

- Support OpenAI-compatible, GLM, OpenRouter, Qwen, DeepSeek, Ollama, vLLM, and llama.cpp.
- Emit only one reasoning request dialect per request.
- Unknown OpenAI-compatible endpoints receive no reasoning field.
- Never estimate reasoning tokens; display only provider-reported values.
- Cache fallback capability by normalized endpoint + model for the current app session.
- Reserve `reasoning`, `reasoning_effort`, `thinking`, `enable_thinking`, and `think` from advanced request overrides.

---

### Task 1: Add a test runner and a pure capability resolver

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/shared/reasoning.ts`
- Create: `src/shared/reasoning.test.ts`
- Modify: `src/shared/constants.ts`
- Modify: `src/shared/ai-helper.ts`

**Interfaces:**
- Produces: `resolveReasoningProfile(providerId, model, enabled): ReasoningProfile | null`.
- Produces: `buildReasoningRequestFields(profile): Record<string, unknown>`.
- Produces: `normalizeEndpointKey(baseUrl, model): string`.
- Produces: `isReasoningParameterError(error): boolean`.

- [ ] **Step 1: Install Vitest and add a focused test command.**

  Add `vitest` to `devDependencies`, a `test` script of `vitest run`, and `vitest.config.ts` with `resolve.alias['@'] = path.resolve(__dirname, 'src')`.

- [ ] **Step 2: Write failing resolver tests.**

  Test that OpenRouter uses only `reasoning`; DeepSeek and GLM use only `thinking`; Qwen uses only `enable_thinking`; and OpenAI, vLLM, llama.cpp, and custom return `null`. Test both enabled and disabled variants and assert forbidden dialect keys are absent.

- [ ] **Step 3: Run the resolver tests and confirm they fail before the resolver exists.**

  Run: `npm test -- src/shared/reasoning.test.ts`

  Expected: failure because `src/shared/reasoning.ts` does not export the required resolver.

- [ ] **Step 4: Implement the resolver.**

  Define `ReasoningProfile` with `id`, `enableFields`, and `disableFields`. Map built-in provider IDs to profiles, with `openai`, `vllm`, `llamacpp`, and `custom` deliberately returning `null`. Move GLM model-prefix matching from `thinkingConfig.ts` into this resolver or delete it if provider ID is authoritative. Delete the unknown-provider `reasoning_effort: 'low'` fallback from `addThinkingArgument`; retain only non-reasoning helpers from `ai-helper.ts`.

- [ ] **Step 5: Add fallback-key and validation-error tests.**

  Verify `normalizeEndpointKey('https://api.example.com/v1/', 'model-a')` is stable and includes the model. Verify `isReasoningParameterError` accepts 400-style messages naming a reserved key and rejects 401, 429, timeout, and generic 500 errors.

- [ ] **Step 6: Implement the cache helpers and error classifier.**

  Add module-local `Set<string>` storage with `isReasoningDisabledForTarget` and `markReasoningUnsupportedForTarget`. Match only HTTP 400/422 validation errors whose message contains a reserved key or an explicit unsupported-parameter marker.

- [ ] **Step 7: Run unit tests and typecheck.**

  Run: `npm test -- src/shared/reasoning.test.ts && npm run typecheck`

- [ ] **Step 8: Commit the isolated resolver work.**

  Commit message: `feat(reasoning): add provider capability resolver`

### Task 2: Apply one request profile and normalize streamed usage

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/parsers/openai.ts`
- Modify: `src/shared/parsers/ollama.ts`
- Create: `src/shared/parsers/openai.test.ts`
- Create: `src/shared/parsers/ollama.test.ts`

**Interfaces:**
- Consumes: Task 1 resolver and session fallback cache.
- Produces: `StreamChunk.usage.reasoningTokens?: number`.
- Produces: parser requests containing either one profile or no reasoning fields.

- [ ] **Step 1: Write failing OpenAI parser tests using a mocked client.**

  Assert profile fields are included for OpenRouter, DeepSeek, Qwen, and GLM; assert they are omitted for custom/vLLM/llama.cpp. Make the first mocked call reject with a 400 unsupported `enable_thinking` error, then resolve the second call; assert exactly two calls and no reasoning fields on the retry. Repeat the request and assert one field-free call due to cache.

- [ ] **Step 2: Write failing usage-normalization tests.**

  Feed final chunks containing `usage.completion_tokens_details.reasoning_tokens`, `usage.output_tokens_details.thinking_tokens`, and no breakdown. Assert `reasoningTokens` is respectively the supplied number, the supplied number, and `undefined`.

- [ ] **Step 3: Implement shared usage types and OpenAI parser behavior.**

  Extend `StreamChunk.usage` with optional `reasoningTokens`. Build the OpenAI request object before the SDK call. Apply `buildReasoningRequestFields` only when a profile exists and the target is not cached unsupported. On a classified profile error, rebuild once with no profile fields; otherwise rethrow. Extract optional numerical counts from both documented detail shapes without calculating a value.

- [ ] **Step 4: Write a failing Ollama usage test.**

  Feed a native final NDJSON object with `prompt_eval_count`, `eval_count`, and any available reasoning count. Assert prompt/completion counts are forwarded and a missing reasoning count stays `undefined`.

- [ ] **Step 5: Implement Ollama final-chunk usage normalization.**

  On `chunk.done`, emit a `StreamChunk` even when there is no text if usage exists. Map `prompt_eval_count` to `promptTokens`, `eval_count` to `completionTokens`, and only a documented explicit thinking field to `reasoningTokens`; do not infer it.

- [ ] **Step 6: Run parser tests and typecheck.**

  Run: `npm test -- src/shared/parsers/openai.test.ts src/shared/parsers/ollama.test.ts && npm run typecheck`

- [ ] **Step 7: Commit parser changes.**

  Commit message: `feat(reasoning): apply profiles and normalize usage`

### Task 3: Forward normalized usage and compatibility notices through IPC

**Files:**
- Modify: `src/main/ipc/translation/startTranslation.ipc.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/parsers/openai.ts`
- Modify: `src/shared/ipc-manifest.json`
- Modify: `src/types/generated-electron-api.d.ts`
- Create: `src/main/ipc/translation/startTranslation.test.ts`

**Interfaces:**
- Consumes: `StreamChunk.usage.reasoningTokens` from Task 2.
- Produces: `TranslateChunkPayload.stats.reasoningTokens?: number` and `reasoningUnavailable?: boolean`.

- [ ] **Step 1: Write failing IPC payload tests.**

  Mock a parser stream yielding final usage with `reasoningTokens: 42`. Assert emitted chunk stats include it. Mock the profile fallback outcome and assert one non-error completion payload carries `reasoningUnavailable: true`.

- [ ] **Step 2: Implement payload propagation.**

  Extend `StreamChunk` with optional `reasoningUnavailable` and set it once on the
  first yielded chunk after a successful classified OpenAI profile fallback. Extend
  `TranslateChunkPayload.stats` with optional `reasoningTokens` and add optional
  `reasoningUnavailable`. Track the last reported usage in the stream loop and send
  it with every stats update. Preserve existing error delivery.

- [ ] **Step 3: Regenerate IPC types.**

  Run: `npm run ipc:sync`

- [ ] **Step 4: Run the IPC tests and typecheck.**

  Run: `npm test -- src/main/ipc/translation/startTranslation.test.ts && npm run typecheck`

- [ ] **Step 5: Commit IPC propagation.**

  Commit message: `feat(reasoning): expose usage and fallback notices`

### Task 4: Render focus feedback and reasoning usage in the popup

**Files:**
- Modify: `src/renderer/hooks/useTranslation.ts`
- Modify: `src/renderer/pages/FlowTranslate/FlowTranslate.tsx`
- Create: `src/renderer/hooks/useTranslation.test.ts`
- Create: `src/renderer/pages/FlowTranslate/FlowTranslate.test.tsx`

**Interfaces:**
- Consumes: `TranslateChunkPayload.stats.reasoningTokens` and `reasoningUnavailable`.
- Produces: `reasoningTokens`, `reasoningUsageUnavailable`, and `isWindowActive` UI state.

- [ ] **Step 1: Write failing hook tests.**

  Emit an IPC chunk with `reasoningTokens: 17` and assert the hook stores it. Emit a done payload with `reasoningUnavailable: true` and assert the hook exposes it. Start a new translation and assert both fields reset.

- [ ] **Step 2: Implement translation state.**

  Add `reasoningTokens?: number` and `reasoningUsageUnavailable: boolean` to `useTranslation`, update them from stream payloads, reset them in `startTranslation` and `resetTranslation`, and return them to `FlowTranslate`.

- [ ] **Step 3: Write failing popup tests.**

  Simulate `window.blur` after render and assert an element with label `Input inactive` appears. Simulate `window.focus` and assert it is absent. Render final reported usage and assert `Reasoning: 17 tokens`; render unavailable usage after an enabled request and assert `Reasoning: usage not reported`.

- [ ] **Step 4: Implement footer UI.**

  In the existing `onShow` effect, add `focus` and `blur` listeners and reset `isWindowActive` to true on show. Add a bottom-right, visually red status element with `aria-label="Input inactive"` and title `Click this window or use the shortcut to type.` only when inactive. In the existing footer, display reported reasoning tokens, otherwise the unavailable message only when the switch was enabled and the request has finished.

- [ ] **Step 5: Run renderer tests, format, lint, and typecheck.**

  Run: `npm test -- src/renderer/hooks/useTranslation.test.ts src/renderer/pages/FlowTranslate/FlowTranslate.test.tsx && npm run lint`

- [ ] **Step 6: Commit UI behavior.**

  Commit message: `feat(popup): show input state and reasoning usage`

### Task 5: Full verification and documentation check

**Files:**
- Modify: `README.md` only if it already documents the Reasoning setting.

- [ ] **Step 1: Run all automated checks.**

  Run: `npm test && npm run lint && npm run build`

- [ ] **Step 2: Perform a local smoke test.**

  Run the app against a configured supported provider. Toggle Reasoning on and off, confirm a request succeeds, blur and refocus the popup, and inspect the footer after completion. Repeat with an OpenAI-compatible custom endpoint and confirm no reasoning field is sent by default.

- [ ] **Step 3: Update existing user-facing Reasoning documentation, if present.**

  Document that availability and usage counts depend on the selected endpoint/model and that unknown OpenAI-compatible endpoints do not receive reasoning fields.

- [ ] **Step 4: Commit verification-only documentation changes if any exist.**

  Commit message: `docs(reasoning): clarify provider availability`

### Task 6: Restore Ctrl+J newline insertion

**Files:**
- Modify: `src/renderer/hooks/useShortcuts.ts`
- Modify: `src/renderer/hooks/useShortcuts.test.ts`

**Interfaces:**
- Consumes: the existing `useShortcuts` handler and textarea ref.
- Produces: Ctrl/Cmd+J inserts one newline at the current selection and places the caret after it.

- [ ] **Step 1: Write a failing shortcut test.**

  Call the handler with `key: 'j'`, `ctrlKey: true`, input `"ab"`, and a textarea selection at index 1. Assert `preventDefault` is called, the state setter receives `"a\\nb"`, and the scheduled selection becomes `(2, 2)`. Add a selected-text case that replaces the selection with one newline.

- [ ] **Step 2: Run the focused test and verify it fails.**

  Run: `npm test -- src/renderer/hooks/useShortcuts.test.ts`

  Expected: the handler returns without changing controlled input state.

- [ ] **Step 3: Implement only the explicit Ctrl/Cmd+J insertion.**

  Prevent the browser default, read `selectionStart` and `selectionEnd`, set input to the prefix plus `"\\n"` plus suffix, and restore the caret to immediately after the newline in `requestAnimationFrame`.

- [ ] **Step 4: Run focused tests and the typecheck.**

  Run: `npm test -- src/renderer/hooks/useShortcuts.test.ts && npm run typecheck`

- [ ] **Step 5: Commit the regression fix.**

  Commit message: `fix(shortcuts): insert newline with ctrl-j`

### Task 7: Complete footer states and typed-lint configuration

**Files:**
- Modify: `src/renderer/hooks/useTranslation.ts`
- Modify: `src/renderer/pages/FlowTranslate/FlowTranslate.tsx`
- Modify: `src/renderer/hooks/useTranslation.test.ts`
- Modify: `src/renderer/pages/FlowTranslate/FlowTranslate.test.tsx`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing completed-footer tests** for a reported reasoning count,
  a reasoning-enabled request whose provider omits a breakdown, and a compatibility
  fallback notice. Assert these remain correct after the final `done` payload.
- [ ] **Step 2: Persist request metadata and final usage state** so a provider-reported
  count stays visible after completion; distinguish a missing usage breakdown from a
  compatibility fallback.
- [ ] **Step 3: Include `vitest.config.ts` in the typed TypeScript program** so ESLint
  does not reject the newly added Vitest configuration file.
- [ ] **Step 4: Run focused renderer tests, lint, and typecheck**, documenting any
  remaining pre-existing dependency failure separately.
