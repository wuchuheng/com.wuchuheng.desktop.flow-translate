# History Feature Design

## Summary

Add a translation history system to Flow Translate. Every translation is persisted as a JSON file + DB record. Users can navigate past translations with `Ctrl+Up/Down`, toggle between viewing the original input and the AI result with `Ctrl+Left/Right`, and copy stored results without re-calling the AI. Incomplete history items (no transaction yet) trigger lazy AI translation on demand.

## Data Model

### New Entity: `History`

**File:** `src/main/database/entities/history.entity.ts`

```typescript
@Entity('history')
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
```

The DB table stores only metadata (`id`, `createdAt`, `updatedAt`). Content lives in JSON files.

### JSON Files: `storage/history/<id>.json`

```json
{
  "input": "Hello world",
  "transaction": "你好世界",
  "createdAt": "2026-06-13 14:30:00",
  "updatedAt": "2026-06-13 14:30:05"
}
```

- `input` — the user's original text
- `transaction` — the AI translation result (can be `null` if pending)
- Timestamps in human-readable format

### Changes to existing files

- `src/main/database/data-source.ts` — add `History` to entities array
- `src/main/utils/path.util.ts` — add `history` directory to `getPaths()` return value

## History Item States

- **Pending:** `input` filled, `transaction` is `null`. Created before the AI call.
- **Complete:** `input` filled, `transaction` filled. Updated after AI responds.
- A pending item stays pending on AI error (no retry without user action).

## IPC Layer

### New files (auto-registered via `.ipc.ts` convention)

- `src/main/database/repositories/history.repository.ts` — `create()`, `getAll()`, `getById()`, `updateTransaction()` + JSON file I/O
- `src/main/ipc/history/create.ipc.ts` — creates DB row + writes `<id>.json` with input
- `src/main/ipc/history/updateTransaction.ipc.ts` — patches the `transaction` field in the JSON file
- `src/main/ipc/history/getAll.ipc.ts` — returns `{id, createdAt}[]` ordered by newest first
- `src/main/ipc/history/getById.ipc.ts` — returns full `{input, transaction, createdAt, updatedAt}`

### Method signatures (exposed on `window.electron.history.*`)

```
history.create({ input: string }) → { id: number }
history.updateTransaction({ id: number, transaction: string }) → void
history.getAll() → { id: number, createdAt: string }[]
history.getById({ id: number }) → { input: string, transaction: string | null, createdAt: string, updatedAt: string }
```

## Translation Flow Changes

**Modified:** `src/main/ipc/translation/startTranslation.ipc.ts`

1. **Before** AI call: `history.create({ input: text })` → get new `id`
2. Stream AI chunks to renderer via `onTranslateChunk` (unchanged)
3. **After** AI completes: `history.updateTransaction({ id, transaction: fullText })`
4. **On error:** send error chunk; history record stays as "pending" (input saved, transaction empty)

## Renderer: useHistory Hook

**New file:** `src/renderer/hooks/useHistory.ts`

### State

```
mode: "latest" | "history"
activeId: number | null
showingSide: "input" | "transaction"
latestCache: string          // cached "latest" text when navigating to history
historyList: { id, createdAt }[]
```

### Methods

- `navigate(direction: "up" | "down")` — move through history list or back to "latest"
- `toggleSide()` — flip between `showingSide: "input"` ↔ `"transaction"`; triggers lazy AI if transaction is empty
- `submitHistory(closeWindow: boolean)` — Enter/Ctrl+Enter in history mode; copies transaction result, calls AI lazily if empty
- `setLatestText(text: string)` — updates latest input; called on every keystroke in "latest" mode
- `onEditInHistory()` — called when user types while viewing history; auto-saves original latest cache as new history item, switches to "latest" mode

### Navigation State Machine

- **"latest"** is the starting/default mode — represents unsaved current input
- **Ctrl+Up from "latest":** cache current input → fetch history list → switch to "history" mode → load newest item
- **Ctrl+Up from oldest history item:** no-op
- **Ctrl+Down from newest history item:** switch to "latest" mode → restore cached text
- **Ctrl+Down from "latest":** no-op (can't go past latest)
- **Editing while in history mode:** the edited text becomes new "latest"; the previously cached "latest" text gets saved as a new history item (input only, no transaction)

### Lazy AI Translation

When the user triggers an action that needs the `transaction` but it's empty (and `input` is not empty):
- Call `startTranslation(input)` — same as normal mode
- Stream result into display
- Update the JSON file with the result
- Then proceed with the original action (copy)

Triggers for lazy AI:
- `Enter` / `Ctrl+Enter` in history mode when transaction is empty
- `Ctrl+Left` / `Ctrl+Right` (toggleSide) when transaction is empty

## Keyboard Shortcuts

**Modified:** `src/renderer/hooks/useShortcuts.ts`

| Keys | Mode | Action |
|------|------|--------|
| `Ctrl+Up` | All | Navigate to previous (older) history item |
| `Ctrl+Down` | All | Navigate to next (newer) history item, or back to "latest" |
| `Ctrl+Left` | History | Toggle between input ↔ transaction display |
| `Ctrl+Right` | History | Same as Ctrl+Left (toggle) |
| `Enter` | Latest | AI translate → copy result → close (unchanged) |
| `Enter` | History | Copy transaction result → close (lazy AI if empty) |
| `Ctrl+Enter` | Latest | AI translate only → keep open (unchanged) |
| `Ctrl+Enter` | History | Copy transaction result → keep open (lazy AI if empty) |

## Component: FlowTranslate Changes

**Modified:** `src/renderer/pages/FlowTranslate/FlowTranslate.tsx`

- Wire `useHistory` hook alongside existing `useTranslation`
- Textarea value depends on `mode` and `showingSide`:
  - "latest" mode: current user input (editable)
  - "history" mode + "input" side: history item's `input` (read-only)
  - "history" mode + "transaction" side: history item's `transaction` (read-only)
- Footer bar shows different content per mode:
  - **Normal mode:** existing keyboard shortcut hints (unchanged)
  - **History mode:** `History #3 of 12 — 📝 Input` with `Ctrl+← toggle · Ctrl+↑↓ navigate · Enter to copy`

## Error Recovery

When the AI responds with an HTTP error:
1. Show error message in the textarea (existing behavior)
2. Restore the input box to the original submitted text (new)
3. The history record stays as "pending" (input saved, transaction empty)

## Files Summary

| Action | File |
|--------|------|
| **New** | `src/main/database/entities/history.entity.ts` |
| **New** | `src/main/database/repositories/history.repository.ts` |
| **New** | `src/main/ipc/history/create.ipc.ts` |
| **New** | `src/main/ipc/history/updateTransaction.ipc.ts` |
| **New** | `src/main/ipc/history/getAll.ipc.ts` |
| **New** | `src/main/ipc/history/getById.ipc.ts` |
| **New** | `src/renderer/hooks/useHistory.ts` |
| **Modify** | `src/main/database/data-source.ts` |
| **Modify** | `src/main/utils/path.util.ts` |
| **Modify** | `src/main/ipc/translation/startTranslation.ipc.ts` |
| **Modify** | `src/renderer/hooks/useShortcuts.ts` |
| **Modify** | `src/renderer/pages/FlowTranslate/FlowTranslate.tsx` |
| **Modify** | `src/renderer/hooks/useTranslation.ts` |
