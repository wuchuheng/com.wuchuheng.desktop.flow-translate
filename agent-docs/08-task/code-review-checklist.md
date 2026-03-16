# Code Review Checklist

> Generated: 2026-03-17
>
> ## Summary
>
> - **Source Files**: 7
> - **Config Files**: 1
> - **Docs**: 1
> - **Total**: 9 files

---

## Instructions

Process each file sequentially:

1. Find first `[ ]` task
2. Change to `[-]` (in progress)
3. Refactor the file
4. Run `npm run lint` until clean
5. Change to `[x]` (complete)
6. Spawn next agent if more tasks remain

---

## Refactoring Rules

### 1. Dead Code (Priority 1)

- Remove unused imports
- Remove unused variables
- Remove unused functions
- Remove commented code

### 2. Complexity (Priority 2)

- Extract functions > 30 lines
- Reduce nesting > 3 levels
- Limit parameters to 4

### 3. Readability (Priority 3)

- Use descriptive names
- Add TSDoc for public functions
- Remove magic numbers (use constants)
- Prefer early returns

### 4. Functional Style (Priority 4)

- Prefer pure functions
- Use `const` over `let`
- Avoid side effects

---

## Source Files

### New Files

- [x] `src/shared/types.ts` - Type definitions for parser architecture
- [x] `src/shared/parsers/openai.ts` - OpenAI-compatible parser
- [x] `src/shared/parsers/ollama.ts` - Ollama native API parser

### Modified Files

- [x] `src/shared/constants.ts` - Provider catalog with parser field
- [x] `src/main/ipc/translation/startTranslation.ipc.ts` - Translation IPC handler
- [x] `src/renderer/hooks/useOpenAI.ts` - OpenAI hook refactored
- [x] `src/renderer/pages/Settings/components/AiSettingsTab.tsx` - Settings UI

## Config Files

- [x] `package.json` - Package configuration (no changes needed - deps only)

## Docs

- [x] `agent-docs/08-task/ollama-provider-parser-spec.md` - Implementation spec

---

## Quality Checklist

After all files are reviewed, verify:

- [x] `npm run lint` passes with no errors
- [x] No `any` types without justification
- [x] All public functions have TSDoc
- [x] No console.log in production code
- [x] Error handling is consistent

---

## Review Summary

All files reviewed. No issues found:

| File | Status | Notes |
|------|--------|-------|
| `types.ts` | ✅ Clean | Proper TSDoc, clean types |
| `openai.ts` | ✅ Clean | Uses `addThinkingArgument` for thinking config |
| `ollama.ts` | ✅ Clean | Native NDJSON streaming, proper error handling |
| `constants.ts` | ✅ Clean | PARSERS registry, all providers have `parser` field |
| `startTranslation.ipc.ts` | ✅ Clean | Uses parser pattern, removed OpenAI SDK imports |
| `useOpenAI.ts` | ✅ Clean | Uses `parser.fetchModels()` |
| `AiSettingsTab.tsx` | ✅ Clean | Uses parser for test playground, API key optional for Ollama |