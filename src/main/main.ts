import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as dotenv from 'dotenv';
import { setupAllIpcHandlers } from './ipc';
import { createWindow, createFloatingWindow } from './windows/windowFactory';
import { bootload } from './services/bootload.service';
import { initDB } from './database/data-source';
import { logger } from './utils/logger';
import { capturePreviousWindow } from './utils/win-api-helper';
import { onShow } from './ipc/window/onShow.ipc';

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  try {
    // 2. Handle the logic.
    // 2.1 Create the main window.
    mainWindow = await createWindow();

    // 2.2 Create floating window (hidden by default)
    floatingWindow = await createFloatingWindow();

    // 2.3 Setup all IPC handlers
    setupAllIpcHandlers();

    // 2.4 Register global shortcut
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      if (floatingWindow) {
        // Capture the current window (Word, Chrome, etc.) BEFORE we take focus
        capturePreviousWindow();

        // Get the display where the cursor is currently located (Active Screen)
        const cursorPoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursorPoint);

        // Calculate position
        // Horizontal: Center of the active display
        // Vertical: Fixed margin from bottom (20% of screen height)
        const windowBounds = floatingWindow.getBounds();

        const x = Math.round(display.bounds.x + (display.bounds.width - windowBounds.width) / 2);

        // "Height from the bottom of the popup to the screen bottom must be fixed (20% height of current screen)"
        const bottomMargin = Math.round(display.bounds.height * 0.2);
        const y = Math.round(display.bounds.y + display.bounds.height - windowBounds.height - bottomMargin);

        floatingWindow.setPosition(x, y);
        floatingWindow.show();

        // Notify renderer to reset state
        onShow();

        // Give focus with a slight delay to ensure it "sticks"
        setTimeout(() => {
          if (floatingWindow && !floatingWindow.isDestroyed()) {
            floatingWindow.focus();
          }
        }, 50);
      }
    });

    // 2.5 Bootload the application
    bootload.register({ title: 'Initializing Database ...', load: initDB });
    await bootload.boot();
  } catch (error) {
    logger.error(`Startup failed: ${error instanceof Error ? error.message : String(error)}`);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
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
