import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import { logger } from '../utils/logger';
import { onStatusChange } from '../ipc/update/onStatusChange.ipc';
import { createUpdateWindow } from '../windows/windowFactory';
import type { UpdateState } from '@/shared/update-types';

// --- Internal State ---
let state: UpdateState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
};
let updateWindowInstance: BrowserWindow | null = null;

const setState = (partial: Partial<UpdateState>) => {
  state = { ...state, ...partial };
  onStatusChange(state);
};

const getUpdateUrl = (): string => {
  // Use environment variables (injected at build time via electron-vite define)
  const baseUrl = app.isPackaged
    ? process.env.PROD_UPDATE_SERVER_URL
    : process.env.DEV_UPDATE_SERVER_URL;

  if (!baseUrl) {
    throw new Error('Update server URL is not configured. Please set DEV_UPDATE_SERVER_URL or PROD_UPDATE_SERVER_URL in .env');
  }

  return new URL(`${baseUrl}/${process.platform}/${process.arch}`).toString();
};

const setupListeners = () => {
  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null });
    logger.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({ status: 'downloading', info, error: null });
    logger.info(`Update v${info.version} found. Downloading...`);
    autoUpdater.downloadUpdate().catch((err) => {
      setState({ status: 'error', error: err.message });
      logger.error(`Download failed: ${err.message}`);
    });
  });

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle', info: null });
    logger.info('No update available.');
  });

  autoUpdater.on('download-progress', (progress) => {
    state = {
      ...state,
      progress: {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      },
    };
    onStatusChange(state);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({
      status: 'ready',
      info,
      progress: { percent: 100, transferred: 0, total: 0 },
    });
    logger.info(`Update v${info.version} downloaded.`);
    showUpdateDialog(info).catch((err) => {
      logger.error(`Failed to show update dialog: ${err.message}`);
    });
  });

  autoUpdater.on('error', (err: Error) => {
    setState({ status: 'error', error: err.message });
    logger.error(`Update error: ${err.message}`);
  });
};

const showUpdateDialog = async (info: UpdateInfo) => {
  try {
    await openUpdateWindow();
  } catch {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the application to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  }
};

// --- Public API ---

export const initUpdateService = () => {
  autoUpdater.autoDownload = false;
  autoUpdater.logger = logger;
  if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true;

  try {
    autoUpdater.setFeedURL({ provider: 'generic', url: getUpdateUrl() });
    setupListeners();
    logger.info('Update service initialized');
  } catch (err) {
    logger.error(`Failed to initialize update service: ${err}`);
  }
};

export const handleAppQuitUpdate = () => {
  if (state.status === 'ready') {
    logger.info('Installing pending update on quit...');
    autoUpdater.quitAndInstall(false, true);
  }
};

export const getUpdateState = (): UpdateState => state;

export const openUpdateWindow = async () => {
  if (updateWindowInstance && !updateWindowInstance.isDestroyed()) {
    updateWindowInstance.show();
    updateWindowInstance.focus();
    return updateWindowInstance;
  }

  updateWindowInstance = await createUpdateWindow();
  updateWindowInstance.on('closed', () => {
    updateWindowInstance = null;
  });
  return updateWindowInstance;
};

export const checkForUpdates = async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ status: 'error', error: message });
    throw err;
  }
};

export const quitAndInstall = () => {
  if (state.status === 'ready') {
    autoUpdater.quitAndInstall(false, true);
  } else {
    logger.warn('quitAndInstall called but no update is ready');
  }
};