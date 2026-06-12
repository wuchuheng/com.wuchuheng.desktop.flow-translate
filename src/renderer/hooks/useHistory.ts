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
        // From "latest": go to newest history
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
