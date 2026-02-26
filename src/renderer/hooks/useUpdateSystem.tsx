import { useState, useEffect, useCallback } from 'react';
import type { UpdateState } from '@/shared/update-types';

/**
 * Single hook for all update-related state.
 * Main process is the source of truth; renderer just reflects it.
 */
export const useUpdateSystem = () => {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    info: null,
    progress: null,
    error: null,
  });

  useEffect(() => {
    // Fetch current state on mount
    const fetchState = async () => {
      try {
        const result = await window.electron.update.getState();
        if (result) {
          setState(result as UpdateState);
        }
      } catch (err) {
        console.error('Failed to fetch update state:', err);
      }
    };

    fetchState();

    // Subscribe to state changes
    const unsubscribe = window.electron.update.onStatusChange(
      (newState: UpdateState) => {
        setState(newState);
      }
    );

    return () => unsubscribe();
  }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      await window.electron.update.check();
    } catch (err) {
      console.error('Update check failed:', err);
    }
  }, []);

  const installAndRestart = useCallback(async () => {
    try {
      await window.electron.update.install();
    } catch (err) {
      console.error('Install failed:', err);
      throw err;
    }
  }, []);

  const openUpdateWindow = useCallback(async () => {
    try {
      await window.electron.window.openUpdate();
    } catch (err) {
      console.error('Failed to open update window:', err);
    }
  }, []);

  return {
    ...state,
    checkForUpdates,
    installAndRestart,
    openUpdateWindow,
  };
};