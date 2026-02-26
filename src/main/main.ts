import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as dotenv from 'dotenv';
import * as childProcess from 'child_process';
import { setupAllIpcHandlers } from './ipc';
import { createWindow, createFloatingWindow } from './windows/windowFactory';
import { initDB, getDataSource } from './database/data-source';
import { logger } from './utils/logger';
import { capturePreviousWindow } from './utils/win-api-helper';
import { onShow } from './ipc/window/onShow.ipc';
import { Config } from './database/entities/config.entity';
import { CONFIG_KEYS, AppConfig, DEFAULT_APP_CONFIG } from '../shared/constants';
import { createTray } from './utils/tray-helper';
import { initUpdateService, checkForUpdates, handleAppQuitUpdate } from './services/update.service';
import { registerBootTask, runBootTasks } from './services/bootload.service';

declare global {
  // eslint-disable-next-line no-var
  var isForceQuitting: boolean | undefined;
}

// Ensure UTF-8 encoding on Windows
if (process.platform === 'win32') {
  process.env.LANG = 'en_US.UTF-8';
  // Force set console code page to UTF-8 for child processes and logging
  try {
    // Using child_process module directly
    childProcess.execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // Fail silently if chcp is not available
  }
}

dotenv.config();

app.on('before-quit', () => {
  global.isForceQuitting = true;
  // EMERGENCY UPDATE CHECK: If an update is downloaded, install it now!
  handleAppQuitUpdate();
});

let mainWindow: BrowserWindow | null = null;
export let floatingWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

/**
 * Recreates the main window if it has been closed.
 */
export const recreateMainWindow = async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  try {
    mainWindow = await createWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    return mainWindow;
  } catch (error) {
    logger.error(`Failed to recreate main window: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

/**
 * Registers the global shortcut for toggling the floating window.
 * Reads configuration from the database.
 */
export const registerGlobalShortcut = async () => {
  try {
    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.HOTKEYS });
    const shortcut = (configEntity?.value as { toggleWindow?: string })?.toggleWindow || 'CommandOrControl+Alt+T';

    globalShortcut.unregisterAll();
    const success = globalShortcut.register(shortcut, () => {
      if (floatingWindow) {
        capturePreviousWindow();
        const cursorPoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursorPoint);
        const windowBounds = floatingWindow.getBounds();
        const x = Math.round(display.bounds.x + (display.bounds.width - windowBounds.width) / 2);
        const bottomMargin = Math.round(display.bounds.height * 0.2);
        const y = Math.round(display.bounds.y + display.bounds.height - windowBounds.height - bottomMargin);

        floatingWindow.setPosition(x, y);
        floatingWindow.show();
        onShow();
        setTimeout(() => {
          if (floatingWindow && !floatingWindow.isDestroyed()) {
            floatingWindow.focus();
          }
        }, 50);
      }
    });

    if (success) {
      logger.info(`Successfully registered shortcut: ${shortcut}`);
    } else {
      logger.error(`Failed to register shortcut: ${shortcut}`);
    }
  } catch (error) {
    logger.error(`Error registering shortcut: ${error instanceof Error ? error.message : String(error)}`);
  }
};

app.on('ready', async () => {
  try {
    // 1. Initialize Tray
    createTray(getMainWindow, recreateMainWindow);

    // 2. Handle the logic.
    // 2.1 Create the main window.
    mainWindow = await createWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // 2.2 Create floating window (hidden by default)
    floatingWindow = await createFloatingWindow();

    // 2.3 Setup all IPC handlers
    setupAllIpcHandlers();

    // 2.4 Initialize Update Service
    initUpdateService();
    checkForUpdates().catch(err => {
      logger.error('Initial update check failed:', err);
    });

    // 2.5 Bootload the application
    registerBootTask({ title: 'Initializing Database ...', load: initDB });
    await runBootTasks();

    // 2.6 Register global shortcut after DB is ready
    await registerGlobalShortcut();
  } catch (error) {
    logger.error(`Startup failed: ${error instanceof Error ? error.message : String(error)}`);
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  const repo = getDataSource().getRepository(Config);
  const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.APP });
  const appConfig = (configEntity?.value as AppConfig) || DEFAULT_APP_CONFIG;

  if (process.platform !== 'darwin' && !appConfig.runInBackground) {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    recreateMainWindow();
  }
});
