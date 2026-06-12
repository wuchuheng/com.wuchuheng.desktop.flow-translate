# History Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add translation history persistence (DB + JSON files), Ctrl+Up/Down navigation, Ctrl+Left/Right input↔result toggle, and lazy AI translation for incomplete history items.

**Architecture:** Follows the existing hybrid pattern — main process owns data (TypeORM entity + JSON file I/O), renderer owns UI state via a `useHistory` hook. IPC channels auto-register via the `.ipc.ts` convention. The `useShortcuts` hook is extended with history-aware callbacks.

**Tech Stack:** TypeScript, TypeORM (better-sqlite3), React 19, Electron IPC

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/main/utils/path.util.ts:16-37` | Add `history` path |
| Create | `src/main/database/entities/history.entity.ts` | TypeORM entity (id, createdAt, updatedAt) |
| Modify | `src/main/database/data-source.ts:33` | Register History entity |
| Create | `src/main/database/repositories/history.repository.ts` | CRUD + JSON file read/write |
| Create | `src/main/ipc/history/create.ipc.ts` | IPC: create history record |
| Create | `src/main/ipc/history/updateTransaction.ipc.ts` | IPC: update transaction result |
| Create | `src/main/ipc/history/getAll.ipc.ts` | IPC: list all history (id, createdAt) |
| Create | `src/main/ipc/history/getById.ipc.ts` | IPC: get full record by id |
| Modify | `src/main/ipc/translation/startTranslation.ipc.ts:13-74` | Integrate history create/update |
| Create | `src/renderer/hooks/useHistory.ts` | History state machine + navigation |
| Modify | `src/renderer/hooks/useShortcuts.ts:36-106` | Add Ctrl+Up/Down/Left/Right + history Enter |
| Modify | `src/renderer/hooks/useTranslation.ts:12-61` | Track original input for error recovery |
| Modify | `src/renderer/pages/FlowTranslate/FlowTranslate.tsx:25-191` | Wire useHistory, footer changes |

---

### Task 1: Add history directory to paths

**Files:**
- Modify: `src/main/utils/path.util.ts:16-37`

- [ ] **Step 1: Add history path to getPaths()**

In `src/main/utils/path.util.ts`, modify the `getPaths()` function to add the `history` directory:

```typescript
export const getPaths = () => {
  const baseDir = getBaseDir();
  const storage = path.join(baseDir, 'storage');

  const paths = {
    database: path.join(storage, 'database.sqlite'),
    logs: path.join(storage, 'logs'),
    history: path.join(storage, 'history'),
  };

  [storage, paths.logs, paths.history].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return paths;
};
```

- [ ] **Step 2: Verify the change compiles**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/main/utils/path.util.ts
git commit -m "feat: add history directory to app storage paths"
```

---

### Task 2: Create History entity

**Files:**
- Create: `src/main/database/entities/history.entity.ts`

- [ ] **Step 1: Write the History entity**

Create `src/main/database/entities/history.entity.ts`:

```typescript
import { CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('history')
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/main/database/entities/history.entity.ts
git commit -m "feat: add History entity for translation history records"
```

---

### Task 3: Register History entity in data-source

**Files:**
- Modify: `src/main/database/data-source.ts:33`

- [ ] **Step 1: Add History to entities array**

In `src/main/database/data-source.ts`, add the import and register the entity:

```typescript
import { History } from './entities/history.entity';
```

Change line 33 from:
```typescript
entities: [Welcome, Config],
```
to:
```typescript
entities: [Welcome, Config, History],
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/main/database/data-source.ts
git commit -m "feat: register History entity in data-source"
```

---

### Task 4: Create history repository

**Files:**
- Create: `src/main/database/repositories/history.repository.ts`

- [ ] **Step 1: Write the repository with CRUD + JSON file I/O**

Create `src/main/database/repositories/history.repository.ts`:

```typescript
import path from 'path';
import fs from 'fs';
import { getDataSource } from '../data-source';
import { History } from '../entities/history.entity';
import { getPaths } from '../../utils/path.util';

interface HistoryContent {
  input: string;
  transaction: string | null;
  createdAt: string;
  updatedAt: string;
}

const getHistoryDir = () => getPaths().history;

const getJsonPath = (id: number) => path.join(getHistoryDir(), `${id}.json`);

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export const createHistory = async (input: string): Promise<number> => {
  const repo = getDataSource().getRepository(History);
  const record = new History();
  await repo.save(record);

  const timestamp = now();
  const content: HistoryContent = {
    input,
    transaction: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  fs.writeFileSync(getJsonPath(record.id), JSON.stringify(content, null, 2), 'utf-8');

  return record.id;
};

export const updateTransaction = async (id: number, transaction: string): Promise<void> => {
  const repo = getDataSource().getRepository(History);
  await repo.update(id, {});

  const jsonPath = getJsonPath(id);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`History file not found: ${id}`);
  }

  const content: HistoryContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  content.transaction = transaction;
  content.updatedAt = now();
  fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2), 'utf-8');
};

export const getAllHistory = async (): Promise<{ id: number; createdAt: string }[]> => {
  const repo = getDataSource().getRepository(History);
  const records = await repo.find({ order: { id: 'DESC' } });
  return records.map(r => ({
    id: r.id,
    createdAt: r.createdAt.toISOString().replace('T', ' ').slice(0, 19),
  }));
};

export const getHistoryById = async (id: number): Promise<HistoryContent | null> => {
  const jsonPath = getJsonPath(id);
  if (!fs.existsSync(jsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/main/database/repositories/history.repository.ts
git commit -m "feat: add history repository with DB and JSON file storage"
```

---

### Task 5: Create history IPC handlers

**Files:**
- Create: `src/main/ipc/history/create.ipc.ts`
- Create: `src/main/ipc/history/updateTransaction.ipc.ts`
- Create: `src/main/ipc/history/getAll.ipc.ts`
- Create: `src/main/ipc/history/getById.ipc.ts`

- [ ] **Step 1: Write create.ipc.ts**

Create `src/main/ipc/history/create.ipc.ts`:

```typescript
import { createHistory } from '../../database/repositories/history.repository';

const create = async (payload: { input: string }) => {
  const id = await createHistory(payload.input);
  return { id };
};

export default create;
```

- [ ] **Step 2: Write updateTransaction.ipc.ts**

Create `src/main/ipc/history/updateTransaction.ipc.ts`:

```typescript
import { updateTransaction } from '../../database/repositories/history.repository';

const updateTxn = async (payload: { id: number; transaction: string }) => {
  await updateTransaction(payload.id, payload.transaction);
};

export default updateTxn;
```

- [ ] **Step 3: Write getAll.ipc.ts**

Create `src/main/ipc/history/getAll.ipc.ts`:

```typescript
import { getAllHistory } from '../../database/repositories/history.repository';

const getAll = async (): Promise<{ id: number; createdAt: string }[]> => {
  return getAllHistory();
};

export default getAll;
```

- [ ] **Step 4: Write getById.ipc.ts**

Create `src/main/ipc/history/getById.ipc.ts`:

```typescript
import { getHistoryById } from '../../database/repositories/history.repository';

const getById = async (payload: { id: number }) => {
  return getHistoryById(payload.id);
};

export default getById;
```

- [ ] **Step 5: Regenerate IPC types and manifest**

```bash
npm run ipc:sync
```

- [ ] **Step 6: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/history/ src/types/generated-electron-api.d.ts src/shared/ipc-manifest.json
git commit -m "feat: add history IPC handlers (create, updateTransaction, getAll, getById)"
```

---

### Task 6: Integrate history into translation flow

**Files:**
- Modify: `src/main/ipc/translation/startTranslation.ipc.ts:13-74`

- [ ] **Step 1: Wrap translation with history create/update**

In `src/main/ipc/translation/startTranslation.ipc.ts`, add imports and wrap the translation logic:

Add imports at top (line 6-7 area):
```typescript
import { createHistory, updateTransaction } from '../../database/repositories/history.repository';
```

Modify the `startTranslation` function (lines 13-74). The key change is wrapping the try block:

```typescript
const startTranslation = async (payload: { text: string; backspaceCount: number; closeAfter?: boolean }) => {
  const { text, closeAfter = true } = payload;

  let historyId: number | null = null;
  try {
    // 1. Create history record before AI call
    historyId = await createHistory(text);

    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.AI });
    const config = (configEntity?.value || {}) as AiConfig;
    const { apiKey, model, enableThinking, systemPrompt } = config;

    const provider = getProviderById(config.providerId);
    const parser = PARSERS[provider?.parser || 'openai'];
    const baseUrl = getBaseUrl(config);

    if (!baseUrl) {
      throw new Error(`Base URL not found for provider: ${config.providerId}`);
    }

    logger.info(`Starting translation: provider=${config.providerId}, model=${model}, thinking=${enableThinking}`);

    const promptTemplate = systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
    const messages: ChatRequest['messages'] = promptTemplate.includes('{text}')
      ? [{ role: 'user', content: promptTemplate.replace('{text}', text) }]
      : [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: `<content>\n${text}\n</content>` },
        ];

    const chatRequest: ChatRequest = {
      model: model || 'gpt-3.5-turbo',
      messages,
      enableThinking: !!enableThinking,
      providerId: config.providerId,
    };

    let fullTranslation = '';
    for await (const chunk of parser.streamChat(baseUrl, apiKey || '', chatRequest)) {
      fullTranslation += chunk;
      onTranslateChunk({ chunk, done: false });
    }

    onTranslateChunk({ chunk: '', done: true });

    // 2. Update history with transaction result
    if (historyId !== null) {
      await updateTransaction(historyId, fullTranslation);
    }

    if (closeAfter) {
      const wins = BrowserWindow.getAllWindows();
      const floatingWindow = wins.find(w => w.webContents.getURL().includes('flow-translate'));

      if (floatingWindow) {
        floatingWindow.hide();
      }

      await restorePreviousWindow();

      if (fullTranslation) {
        await pasteText(fullTranslation);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Translation failed: ${message}`);
    onTranslateChunk({ chunk: `Error: ${message}`, done: true, isError: true });
  }
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/translation/startTranslation.ipc.ts
git commit -m "feat: integrate history create/update into translation flow"
```

---

### Task 7: Create useHistory hook

**Files:**
- Create: `src/renderer/hooks/useHistory.ts`

- [ ] **Step 1: Write the useHistory hook**

Create `src/renderer/hooks/useHistory.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';

type HistoryMode = 'latest' | 'history';
type ShowingSide = 'input' | 'transaction';

interface HistoryItem {
  id: number;
  createdAt: string;
}

interface HistoryContent {
  input: string;
  transaction: string | null;
  createdAt: string;
  updatedAt: string;
}

export const useHistory = () => {
  const [mode, setMode] = useState<HistoryMode>('latest');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showingSide, setShowingSide] = useState<ShowingSide>('input');
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [activeContent, setActiveContent] = useState<HistoryContent | null>(null);
  const latestCacheRef = useRef<string>('');
  const listFetchedRef = useRef<boolean>(false);

  const fetchList = useCallback(async () => {
    const list = await window.electron.history.getAll();
    setHistoryList(list || []);
    listFetchedRef.current = true;
  }, []);

  const loadItem = useCallback(async (id: number) => {
    const content = await window.electron.history.getById({ id });
    setActiveContent(content);
    setActiveId(id);
    setShowingSide('input');
  }, []);

  const navigate = useCallback(
    async (direction: 'up' | 'down') => {
      if (!listFetchedRef.current) {
        await fetchList();
      }

      if (direction === 'up') {
        // From "latest": cache current input, go to newest history
        if (mode === 'latest') {
          if (historyList.length === 0) return;
          setMode('history');
          const newest = historyList[0];
          await loadItem(newest.id);
          return;
        }

        // In history: go to older item
        if (activeId === null) return;
        const currentIdx = historyList.findIndex(h => h.id === activeId);
        if (currentIdx === -1) return;
        const nextIdx = currentIdx + 1; // older = higher index
        if (nextIdx >= historyList.length) return; // at oldest
        await loadItem(historyList[nextIdx].id);
        return;
      }

      if (direction === 'down') {
        if (mode === 'latest') return; // can't go past latest

        if (activeId === null) return;
        const currentIdx = historyList.findIndex(h => h.id === activeId);
        if (currentIdx === -1) return;
        const nextIdx = currentIdx - 1; // newer = lower index

        if (nextIdx < 0) {
          // Switch back to "latest"
          setMode('latest');
          setActiveId(null);
          setActiveContent(null);
          return;
        }
        await loadItem(historyList[nextIdx].id);
        return;
      }
    },
    [mode, activeId, historyList, fetchList, loadItem]
  );

  const toggleSide = useCallback(() => {
    if (mode !== 'history' || !activeContent) return;
    const newSide: ShowingSide = showingSide === 'input' ? 'transaction' : 'input';
    setShowingSide(newSide);
    return newSide;
  }, [mode, activeContent, showingSide]);

  const onEditInHistory = useCallback(async () => {
    // Save original latest cache as new history item
    const cached = latestCacheRef.current.trim();
    if (cached) {
      await window.electron.history.create({ input: cached });
      latestCacheRef.current = '';
    }
    // Switch to latest mode
    setMode('latest');
    setActiveId(null);
    setActiveContent(null);
  }, []);

  const cacheLatest = useCallback((text: string) => {
    latestCacheRef.current = text;
  }, []);

  const getCachedLatest = useCallback(() => {
    return latestCacheRef.current;
  }, []);

  const isTransactionEmpty = useCallback(() => {
    return !activeContent?.transaction;
  }, [activeContent]);

  const getTextareaValue = useCallback(
    (latestText: string) => {
      if (mode === 'latest') return latestText;
      if (!activeContent) return '';
      return showingSide === 'input' ? activeContent.input : (activeContent.transaction || '');
    },
    [mode, activeContent, showingSide]
  );

  const resetToLatest = useCallback(() => {
    setMode('latest');
    setActiveId(null);
    setActiveContent(null);
    setShowingSide('input');
    listFetchedRef.current = false;
  }, []);

  return {
    mode,
    activeId,
    showingSide,
    historyList,
    activeContent,
    navigate,
    toggleSide,
    onEditInHistory,
    cacheLatest,
    getCachedLatest,
    isTransactionEmpty,
    getTextareaValue,
    resetToLatest,
  };
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useHistory.ts
git commit -m "feat: add useHistory hook for history navigation state machine"
```

---

### Task 8: Extend useShortcuts with history key bindings

**Files:**
- Modify: `src/renderer/hooks/useShortcuts.ts:36-106`

- [ ] **Step 1: Add history-aware callbacks to useShortcuts**

Extend `src/renderer/hooks/useShortcuts.ts`. Add new handlers and modify Enter logic:

Change the type `ShortcutHandlers` to include optional history callbacks:

```typescript
type ShortcutHandlers = {
  onSubmit: (closeWindow?: boolean) => void;
  onClose: () => void;
  /** Called when pressing Ctrl+Up or Ctrl+Down */
  onNavigate?: (direction: 'up' | 'down') => void;
  /** Called when pressing Ctrl+Left or Ctrl+Right in history mode */
  onToggleSide?: () => void;
  /** Whether we're in history mode */
  isHistoryMode?: boolean;
  /** Whether the current history item has an empty transaction */
  isTransactionEmpty?: boolean;
};
```

Add a second parameter `mode` to the hook:

```typescript
export const useShortcuts = (
  input: string,
  setInput: (value: string) => void,
  handlers: ShortcutHandlers,
  textareaRef: RefObject<HTMLTextAreaElement | null>
) => {
```

Inside `handleKeyDown`, add the new key bindings **before** the Enter handler:

```typescript
    // Ctrl+Up: Navigate to previous (older) history item
    if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlers.onNavigate?.('up');
      return;
    }

    // Ctrl+Down: Navigate to next (newer) history item
    if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlers.onNavigate?.('down');
      return;
    }

    // Ctrl+Left / Ctrl+Right: Toggle input ↔ transaction in history mode
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.ctrlKey || e.metaKey)) {
      if (handlers.isHistoryMode) {
        e.preventDefault();
        handlers.onToggleSide?.();
        // If toggling to transaction side and it's empty, trigger translation
        // The parent handles the lazy AI logic
      }
      return;
    }
```

Modify the Enter handler to account for history mode:

```typescript
    // Enter: Translate (with or without closing)
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      if (e.repeat) return;

      if (handlers.isHistoryMode) {
        // In history mode, copy the stored transaction result
        // If transaction is empty, trigger lazy AI first
        handlers.onSubmit(!(e.ctrlKey || e.metaKey));
      } else {
        handlers.onSubmit(!(e.ctrlKey || e.metaKey));
      }
      return;
    }
```

The rest of the file (deleteWordBackward, Ctrl+W, Escape, Ctrl+C, Ctrl+J, Ctrl+D) stays unchanged.

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useShortcuts.ts
git commit -m "feat: add Ctrl+Up/Down/Left/Right history navigation shortcuts"
```

---

### Task 9: Add error recovery to useTranslation

**Files:**
- Modify: `src/renderer/hooks/useTranslation.ts:12-61`

- [ ] **Step 1: Track original input for error recovery**

Modify `src/renderer/hooks/useTranslation.ts` to track the original input text:

```typescript
import { useState, useEffect, useRef } from 'react';

const ERROR_DISPLAY_DURATION_MS = 5000;

export const useTranslation = () => {
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const originalInputRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = window.electron.translation.onTranslateChunk(payload => {
      if (payload.isError) {
        setHasError(true);
      }
      if (payload.chunk) {
        setTranslation(prev => prev + payload.chunk);
      }
      if (payload.done) {
        setIsTranslating(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasError) return;
    const timer = setTimeout(() => setHasError(false), ERROR_DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hasError]);

  const startTranslation = (text: string, closeAfter: boolean = true) => {
    originalInputRef.current = text;
    setTranslation('');
    setHasError(false);
    setIsTranslating(true);
    window.electron.translation.startTranslation({
      text,
      backspaceCount: 0,
      closeAfter,
    });
  };

  const resetTranslation = () => {
    setTranslation('');
    setIsTranslating(false);
    setHasError(false);
    originalInputRef.current = '';
  };

  const getOriginalInput = () => originalInputRef.current;

  return { translation, isTranslating, hasError, startTranslation, resetTranslation, getOriginalInput };
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --incremental
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useTranslation.ts
git commit -m "feat: track original input for error recovery in useTranslation"
```

---

### Task 10: Wire everything in FlowTranslate component

**Files:**
- Modify: `src/renderer/pages/FlowTranslate/FlowTranslate.tsx:25-191`

- [ ] **Step 1: Rewrite FlowTranslate with history integration**

Replace the content of `src/renderer/pages/FlowTranslate/FlowTranslate.tsx`:

```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Key } from '../../components/Key';
import { useTranslation } from '../../hooks/useTranslation';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useHistory } from '../../hooks/useHistory';
import { hexToRgba } from '@/shared/utils';

const SCROLLBAR_STYLES = `
  .custom-scrollbar::-webkit-scrollbar { width: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.2); }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.1); }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.2); }
`;

export const FlowTranslate: React.FC = () => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { theme, isDarkMode } = useAppTheme();
  const { translation, isTranslating, hasError, startTranslation, resetTranslation, getOriginalInput } = useTranslation();
  const {
    mode, activeId, showingSide, historyList, activeContent,
    navigate, toggleSide, onEditInHistory, cacheLatest, getCachedLatest,
    isTransactionEmpty, getTextareaValue, resetToLatest,
  } = useHistory();

  useAutoResize(containerRef, { minHeight: 100, maxHeight: 600 });

  // Handle Enter in history mode: copy stored result, lazy AI if empty
  const handleHistorySubmit = useCallback((closeWindow: boolean) => {
    if (activeContent?.transaction) {
      // Transaction exists — copy directly
      window.electron.system.copyAndPaste(activeContent.transaction);
      if (closeWindow) {
        window.electron.window.hide();
      }
    } else if (activeContent?.input && isTransactionEmpty()) {
      // Lazy AI: transaction is empty, translate first then copy
      const text = activeContent.input;
      resetToLatest();
      setInput(text);
      // Trigger translation via existing flow — the result will populate
      startTranslation(text, closeWindow);
    }
  }, [activeContent, isTransactionEmpty, startTranslation, resetToLatest]);

  // Handle toggle to transaction side that's empty → lazy AI
  const handleToggleSide = useCallback(() => {
    const newSide = toggleSide();
    if (newSide === 'transaction' && isTransactionEmpty() && activeContent?.input) {
      // Trigger AI translation for this history item
      const text = activeContent.input;
      const id = activeId;
      resetToLatest();
      setInput(text);
      startTranslation(text);
    }
  }, [toggleSide, isTransactionEmpty, activeContent, activeId, startTranslation, resetToLatest]);

  const submitTranslation = useCallback((closeWindow: boolean = false) => {
    if (mode === 'history') {
      handleHistorySubmit(closeWindow);
      return;
    }
    if (input.trim() && !isTranslating) {
      startTranslation(input.trim(), closeWindow);
      if (closeWindow) {
        setInput('');
      }
    }
  }, [mode, input, isTranslating, startTranslation, handleHistorySubmit]);

  // Wire shortcuts with history callbacks
  const { handleKeyDown } = useShortcuts(
    input,
    setInput,
    {
      onSubmit: submitTranslation,
      onClose: () => window.electron.window.hide(),
      onNavigate: (dir) => {
        if (dir === 'up') {
          if (input.trim()) {
            cacheLatest(input);
          }
          navigate(dir);
        } else {
          navigate(dir);
        }
      },
      onToggleSide: handleToggleSide,
      isHistoryMode: mode === 'history',
      isTransactionEmpty: isTransactionEmpty(),
    },
    textareaRef
  );

  // determine the textarea value
  const textareaValue = mode === 'latest'
    ? (isTranslating ? translation : input)
    : getTextareaValue(input);

  // When translation streams in history mode (lazy AI), populate the input
  useEffect(() => {
    if (isTranslating && translation && !hasError) {
      setInput(translation);
    }
  }, [translation, isTranslating, hasError]);

  // Restore original input on AI error
  useEffect(() => {
    if (hasError && getOriginalInput()) {
      setInput(getOriginalInput());
    }
  }, [hasError, getOriginalInput]);

  // When returning to "latest" mode, restore cached text
  useEffect(() => {
    if (mode === 'latest') {
      const cached = getCachedLatest();
      if (cached) {
        setInput(cached);
      }
    }
  }, [mode]);

  // Setup window styles and focus handler on show
  useEffect(() => {
    const app = document.getElementById('app') as HTMLDivElement | null;
    if (app) {
      app.style.display = 'block';
      app.style.height = '100vh';
      app.style.width = '100vw';
      document.title = '';
    }

    const unsubscribeOnShow = window.electron.window.onShow(() => {
      setInput('');
      resetTranslation();
      resetToLatest();
      textareaRef.current?.focus();
    });

    return unsubscribeOnShow;
  }, [resetTranslation, resetToLatest]);

  // Handle edits in history mode
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (mode === 'history') {
      onEditInHistory();
      setInput(newValue);
      return;
    }
    setInput(newValue);
  }, [mode, onEditInHistory]);

  const dynamicBgStyle = { backgroundColor: hexToRgba(theme.backgroundColor, theme.opacity) };

  return (
    <div
      ref={containerRef}
      className={`max-h-screen w-full overflow-hidden font-sans ${isDarkMode ? 'dark text-white' : 'text-gray-900'}`}
    >
      <style>{SCROLLBAR_STYLES}</style>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_24px_48px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.5)]"
        style={dynamicBgStyle}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <textarea
            ref={textareaRef}
            className="custom-scrollbar max-h-full min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent p-4 text-lg font-medium leading-relaxed text-inherit placeholder-gray-400 outline-none [field-sizing:content] focus:ring-0 dark:placeholder-white/20"
            placeholder="Ask Flow..."
            value={textareaValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            readOnly={mode === 'history'}
            autoFocus
          />

          {hasError && translation && (
            <div className="mx-4 mb-2 flex items-center gap-1.5 text-xs font-medium text-red-500/90">
              <span className="font-bold uppercase tracking-wider opacity-70">Error:</span>
              <span className="flex-1 truncate">{translation}</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  resetTranslation();
                }}
                className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-red-500/10"
                title="Clear error"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex min-h-[60px] flex-none items-center justify-between border-t border-black/5 bg-black/[0.02] px-3 py-1.5 text-[11px] font-medium text-gray-400 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
          {isTranslating ? (
            <div className="col-span-3 flex w-full items-center justify-center gap-2 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-blue-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Processing...</span>
            </div>
          ) : mode === 'history' && activeId !== null ? (
            <div className="flex w-full items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-amber-500">
                History #{activeId}{historyList.length > 0 ? ` of ${historyList.length}` : ''} — {showingSide === 'input' ? 'Input' : 'Translation'}
              </span>
              <span className="text-[10px] opacity-50">
                Ctrl+&#8592; toggle · Ctrl+&#8593;&#8595; navigate · Enter to copy
              </span>
            </div>
          ) : (
            <div className="grid w-full grid-cols-3 gap-x-2 gap-y-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Enter">Enter</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">trans, copy & close</span>
                </div>
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="Enter">Enter</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">translate only</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Shift">Shift</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="Enter">&#9166;</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">/</span>
                  <Key title="Ctrl">^</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="J">J</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">new line</span>
                </div>
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="D">D</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">clear content</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Key title="Ctrl">Ctrl</Key>
                  <span className="mx-0.5 text-[10px] opacity-40">+</span>
                  <Key title="C">C</Key>
                  <span className="ml-0.5 transition-colors hover:text-blue-400">copy & close</span>
                </div>
                <div
                  className="group flex cursor-pointer items-center"
                  onClick={e => {
                    e.stopPropagation();
                    window.electron.window.hide();
                  }}
                >
                  <Key onClick={() => window.electron.window.hide()} title="Click to close">
                    Esc
                  </Key>
                  <span className="ml-0.5 transition-colors group-hover:text-red-400">close only</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Run type checker**

```bash
npx tsc --noEmit --incremental
```

Expected: potentially some errors from the new `isTransactionEmpty` usage pattern — if so, add `useCallback` wrapper. Fix any errors.

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/FlowTranslate/FlowTranslate.tsx
git commit -m "feat: wire history hook and footer status into FlowTranslate"
```

---

### Task 11: Integration test & manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run start
```

- [ ] **Step 2: Manual test checklist**

1. **Basic flow:** Type text → Enter → verify history record created. Check `storage/history/` for `<id>.json` files.
2. **Navigation:** Type "hello" → Enter (translate). Press `Ctrl+Alt+T` again → type "world" → Enter. Press `Ctrl+Alt+T` → `Ctrl+Up` → should show "world". `Ctrl+Up` again → should show "hello". `Ctrl+Down` → "world". `Ctrl+Down` → back to "latest" with cached text.
3. **Toggle:** At a history item → `Ctrl+Left` → should show the AI translation result. `Ctrl+Left` again → back to input.
4. **History copy:** At a history item showing the translation side → `Enter` → should copy result and close.
5. **Lazy AI:** Create a pending history item (stop the AI mid-response). Navigate to it → `Enter` → should trigger AI translation.
6. **Edit in history:** Navigate to a history item → type something → should switch to "latest" mode and save original cache as new history.
7. **Error recovery:** Configure an invalid API key → type text → Enter → should show error and restore original text.
8. **Footer:** In history mode, footer should show `History #N of M — Input/Translation` with hints.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

### Self-Review Checklist

- [x] **Spec coverage:** Every spec requirement maps to a task above (data model → Task 2-3, IPC → Task 5, translation flow → Task 6, useHistory → Task 7, shortcuts → Task 8, error recovery → Task 9, component → Task 10)
- [x] **No placeholders:** Every step has complete code, no TODOs or TBDs
- [x] **Type consistency:** `HistoryContent` used in both repository (Task 4) and hook (Task 7). IPC method names match across Tasks 5, 6, 7, and 10. `showingSide` values `"input" | "transaction"` consistent across all files.
- [x] **No gaps:** Error recovery (Task 9), lazy AI (Task 7/10), empty history (Task 7 `navigate`), editing history (Task 7 `onEditInHistory`) all covered.
