import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as dotenv from 'dotenv';
import { setupAllIpcHandlers } from './ipc';
import { createWindow, createFloatingWindow } from './windows/windowFactory';
import { bootload } from './services/bootload.service';
import { initDB, getDataSource } from './database/data-source';
import { logger } from './utils/logger';
import { capturePreviousWindow } from './utils/win-api-helper';
import { onShow } from './ipc/window/onShow.ipc';
import { Config } from './database/entities/config.entity';
import { CONFIG_KEYS } from '../shared/constants';

// Ensure UTF-8 encoding on Windows
if (process.platform === 'win32') {
  process.env.LANG = 'en_US.UTF-8';
}

dotenv.config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
export let floatingWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

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
    // 2. Handle the logic.
    // 2.1 Create the main window.
    mainWindow = await createWindow();

    // 2.2 Create floating window (hidden by default)
    floatingWindow = await createFloatingWindow();

    // 2.3 Setup all IPC handlers
    setupAllIpcHandlers();

    // 2.4 Bootload the application
    bootload.register({ title: 'Initializing Database ...', load: initDB });
    await bootload.boot();

    // 2.5 Register global shortcut after DB is ready
    await registerGlobalShortcut();
  } catch (error) {
    logger.error(`Startup failed: ${error instanceof Error ? error.message : String(error)}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
      .then(window => {
        mainWindow = window;
      })
      .catch(error => {
        logger.error(`Failed to re-create window: ${error instanceof Error ? error.message : String(error)}`);
      });
  }
});
