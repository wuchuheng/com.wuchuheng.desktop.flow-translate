# Draft Cache — Design Spec

## Summary

Cache the user's in-progress input (text + cursor position) so unsent drafts survive
translation errors and window close/reopen cycles. Cleared automatically when translation
completes successfully.

## Architecture

```
Renderer                          Main Process
─────────                         ─────────────
useDraft hook                     draft/save.ipc.ts
  saveDraft(text, cursorPos) ───►   draftCache = { text, cursorPos }
  restoreDraft() ◄─────────────── draft/get.ipc.ts
                                    returns draftCache

                                  startTranslation.ipc.ts
                                    on success → draftCache = null
```

Storage: single in-memory variable in the main process. Survives window hide/show
but not app restart.

## IPC Module: `draft`

| File                        | Channel        | Type   | Signature                                  |
|-----------------------------|----------------|--------|--------------------------------------------|
| `draft/save.ipc.ts`         | `draft:save`   | invoke | `(payload: { text: string; cursorPos: number }) => void` |
| `draft/get.ipc.ts`          | `draft:get`    | invoke | `() => { text: string; cursorPos: number } \| null`      |

### Storage

Module-level variable in `draft/save.ipc.ts` (shared via import by `get.ipc.ts`):

```ts
let draftCache: { text: string; cursorPos: number } | null = null;
```

## Hook: `useDraft`

```ts
// src/renderer/hooks/useDraft.ts

const useDraft = () => {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const saveDraft = (text: string, cursorPos: number) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      window.electron.draft.save({ text, cursorPos });
    }, 100);
  };

  const restoreDraft = async () => {
    return window.electron.draft.get();
  };

  return { saveDraft, restoreDraft };
};
```

## Integration Points in FlowTranslate.tsx

1. **On keystroke** — call `saveDraft(text, cursorPos)` in `handleInputChange`.
2. **On window show** — call `restoreDraft()`, if result exists set input + restore cursor,
   then let the draft persist (do not clear — only successful translation clears it).
3. **On error** — existing `useTranslation` error recovery via `originalInputRef` covers
   in-session restore; the draft cache covers window close/reopen after error.

## Draft Lifecycle

```
User types ──► debounce 100ms ──► draft:save
                                       │
Window hides (draft persists)          │
Window shows ◄── draft:get ────────────┘
                                       │
User submits (Enter)                   │
  └─ startTranslation                  │
       ├─ success ──► draftCache = null
       └─ error ────► draft preserved (user can reopen and restore)
```

## Files Changed

| File                                      | Change                                    |
|-------------------------------------------|-------------------------------------------|
| `src/main/ipc/draft/save.ipc.ts`          | **New** — save draft to in-memory cache   |
| `src/main/ipc/draft/get.ipc.ts`           | **New** — return cached draft             |
| `src/main/ipc/translation/startTranslation.ipc.ts` | Clear draft on success           |
| `src/renderer/hooks/useDraft.ts`          | **New** — debounced save + restore        |
| `src/renderer/pages/FlowTranslate/FlowTranslate.tsx` | Wire saveDraft, restoreDraft   |
| `src/shared/ipc-manifest.json`            | **Auto-generated** by ipc:sync            |
| `src/types/generated-electron-api.d.ts`   | **Auto-generated** by ipc:sync            |

## Edge Cases

- **Empty text**: don't save if both text is empty (avoid caching nothing). If user clears
  the input, clear the cache too.
- **Debounce on rapid typing**: 100ms timer resets on every keystroke. Only fires once
  user pauses.
- **Window show with empty cache**: `restoreDraft` returns null, no-op.
- **Cursor out of bounds**: clamp restored cursor position to the restored text length.
