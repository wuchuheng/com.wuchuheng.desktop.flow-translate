import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';
import { logger } from './logger';

let tray: Tray | null = null;

declare global {
  // eslint-disable-next-line no-var
  var isForceQuitting: boolean | undefined;
}

export const createTray = (
  getMainWindow: () => BrowserWindow | null,
  recreateMainWindow: () => Promise<BrowserWindow | null>
) => {
  if (tray) return tray;

  try {
    // In packaged app, the icon is typically configured in electron-builder and embedded,
    // but for the Tray, we need a physical file or native image.
    // electron-builder copies extraResources if configured, but an easier way is to just use
    // the source path in dev, and a dedicated resource path in prod.
    const finalIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(app.getAppPath(), 'src/renderer/assets/genLogo/icon.ico');

    const icon = nativeImage.createFromPath(finalIconPath);
    
    if (icon.isEmpty()) {
       logger.error(`Tray icon is empty at path: ${finalIconPath}`);
    }
    
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: async () => {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            await recreateMainWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          // Use a custom property or global variable to indicate force quit
          global.isForceQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Flow Translate');
    tray.setContextMenu(contextMenu);

    tray.on('click', async () => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        await recreateMainWindow();
      }
    });

    logger.info('System tray created successfully');
    return tray;
  } catch (error) {
    logger.error(`Failed to create tray: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};
