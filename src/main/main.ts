import { app, BrowserWindow, globalShortcut, screen, shell } from 'electron';
import * as dotenv from 'dotenv';
import * as childProcess from 'child_process';
import { setupAllIpcHandlers } from './ipc';
import { createWindow, createFloatingWindow, openGrammarlyAuthWindow } from './windows/windowFactory';
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
  try {
    childProcess.execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // Fail silently if chcp is not available
  }
}

dotenv.config();

// Add command line switches for better extension support
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Global handler for all WebContents
app.on('web-contents-created', (_event, contents) => {
  const contentsType = contents.getType();
  const contentsId = contents.id;
  logger.info(`WebContents created: ${contentsType} [${contentsId}]`);

  // Extension service workers / background pages run freely — no nav interceptors.
  const contentsTypeStr = contentsType as string;
  const isExtensionWorker =
    contentsTypeStr === 'backgroundPage' || contentsTypeStr === 'service_worker' || contentsTypeStr === 'offscreen';

  if (isExtensionWorker) {
    logger.info(`Extension worker [${contentsId}] (${contentsType}) — skipping interceptors`);
    return;
  }

  // Navigation guard: only intercept when the webContents is showing OUR OWN app pages
  // (localhost dev server or file:// in production). External pages (e.g. grammarly.com
  // auth windows created by the extension's chrome.tabs.create) navigate freely.
  const isOurAppPage = () => {
    const url = contents.getURL();
    return url.includes('localhost') || url.startsWith('file://');
  };

  contents.setWindowOpenHandler(({ url }) => {
    if (url.includes('grammarly.com') || url.includes('grammarly.io')) {
      logger.info(`Routing Grammarly window.open to internal window: ${url}`);
      openGrammarlyAuthWindow(url);
      return { action: 'deny' };
    }

    if (isOurAppPage() && (url.startsWith('http:') || url.startsWith('https:'))) {
      logger.info(`window.open from app [${contentsId}] → external: ${url}`);
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // Allow popups from external pages (OAuth flows, grammarly.com login)
    logger.info(`window.open from external [${contentsId}] → allow: ${url}`);
    return { action: 'allow' };
  });

  contents.on('will-navigate', (event, url) => {
    if (contents.getURL().startsWith('chrome-extension://')) return;
    if (!isOurAppPage()) return; // Let external windows navigate freely
    if (url.startsWith('http:') || url.startsWith('https:')) {
      const currentUrl = contents.getURL();
      if (currentUrl && !url.startsWith(currentUrl) && !currentUrl.startsWith('devtools://')) {
        if (url.includes('grammarly.com') || url.includes('grammarly.io')) {
          logger.info(`will-navigate intercepted [${contentsId}] → internal Grammarly window: ${url}`);
          event.preventDefault();
          openGrammarlyAuthWindow(url);
          return;
        }

        logger.info(`will-navigate intercepted [${contentsId}] → ${url}`);
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  contents.on('will-redirect', (event, url) => {
    if (contents.getURL().startsWith('chrome-extension://')) return;
    if (!isOurAppPage()) return;
    if (url.startsWith('http:') || url.startsWith('https:')) {
      const currentUrl = contents.getURL();
      if (currentUrl && !url.startsWith(currentUrl) && !currentUrl.startsWith('devtools://')) {
        if (url.includes('grammarly.com') || url.includes('grammarly.io')) {
          logger.info(`will-redirect intercepted [${contentsId}] → internal Grammarly window: ${url}`);
          event.preventDefault();
          openGrammarlyAuthWindow(url);
          return;
        }

        logger.info(`will-redirect intercepted [${contentsId}] → ${url}`);
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });
});

app.on('before-quit', () => {
  global.isForceQuitting = true;
  handleAppQuitUpdate();
});

let mainWindow: BrowserWindow | null = null;
export let floatingWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

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

export const registerGlobalShortcut = async () => {
  try {
    const repo = getDataSource().getRepository(Config);
    const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.HOTKEYS });
    const shortcut = (configEntity?.value as { toggleWindow?: string })?.toggleWindow || 'CommandOrControl+Alt+T';

    globalShortcut.unregisterAll();
    const success = globalShortcut.register(shortcut, () => {
      if (floatingWindow) {
        // Run PowerShell window capture immediately to capture the correct window
        capturePreviousWindow();

        const cursorPoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursorPoint);
        const windowBounds = floatingWindow.getBounds();
        const x = Math.round(display.bounds.x + (display.bounds.width - windowBounds.width) / 2);
        const bottomMargin = Math.round(display.bounds.height * 0.2);
        const y = Math.round(display.bounds.y + display.bounds.height - windowBounds.height - bottomMargin);

        floatingWindow.setPosition(x, y);
        floatingWindow.show();
        if (!floatingWindow.isDestroyed()) {
          floatingWindow.focus();
        }
        onShow();
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

    // 2.1 Create the main window
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
  if (mainWindow === null) recreateMainWindow();
});
