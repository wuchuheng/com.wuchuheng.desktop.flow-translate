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
    // In production/dev with Webpack, we can copy the asset to the output dir
    const iconPath = path.join(__dirname, 'icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    
    if (icon.isEmpty()) {
       logger.error(`Tray icon is empty at path: ${iconPath}`);
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
