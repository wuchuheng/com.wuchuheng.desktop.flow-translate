import { BrowserWindow, dialog } from 'electron';
import net from 'node:net';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getDataSource } from '../database/data-source';
import { Config } from '../database/entities/config.entity';
import { CONFIG_KEYS, AppConfig, DEFAULT_APP_CONFIG } from '../../shared/constants';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare global {
  // eslint-disable-next-line no-var
  var isForceQuitting: boolean | undefined;
}

const parseEntryPort = () => {
  try {
    const url = new URL(MAIN_WINDOW_WEBPACK_ENTRY);
    const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    return { host: url.hostname, port, isHttp, isLocalhost, description: `${url.hostname}:${port}` };
  } catch {
    return null;
  }
};

const isPortReachable = (host: string, port: number, timeoutMs = 750): Promise<boolean> => {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });
    const onError = () => {
      cleanup();
      resolve(false);
    };
    socket.once('error', onError);
    socket.once('timeout', onError);
  });
};

const ensureRendererAvailable = async (entryUrl: string, entryMeta: ReturnType<typeof parseEntryPort>) => {
  if (!entryMeta?.isHttp || !entryMeta.isLocalhost) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(entryUrl, { method: 'HEAD', signal: controller.signal });
    if (response.ok) return;

    const reachable = await isPortReachable(entryMeta.host, entryMeta.port);
    const reason = reachable
      ? `Port ${entryMeta.port} is serving a different app (HTTP ${response.status}).`
      : `Renderer dev server is not running on ${entryMeta.description}.`;
    throw new Error(reason);
  } catch (error) {
    const reachable = entryMeta ? await isPortReachable(entryMeta.host, entryMeta.port) : false;
    const details = error instanceof Error ? error.message : String(error);
    const reason = reachable
      ? `Port ${entryMeta?.port ?? 'unknown'} is already in use by another process.`
      : `Renderer dev server is not reachable at ${entryMeta?.description ?? entryUrl}.`;
    throw new Error(`${reason} (${details})`);
  } finally {
    clearTimeout(timeout);
  }
};

export const createWindow = async (): Promise<BrowserWindow> => {
  logger.info('Creating main window');

  const entryMeta = parseEntryPort();

  if (process.env.NODE_ENV === 'development') {
    try {
      await ensureRendererAvailable(MAIN_WINDOW_WEBPACK_ENTRY, entryMeta);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Renderer entry not reachable: ${message}`);
      dialog.showErrorBox('Renderer failed to load', message);
      throw error;
    }
  }

  try {
    // Create the browser window.
    logger.info(`Creating BrowserWindow with preload path: ${MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY}`);
    logger.info(`Main window entry: ${MAIN_WINDOW_WEBPACK_ENTRY}`);

    const mainWindow = new BrowserWindow({
      height: 800 * 1.5,
      width: 1200 * 1.5,
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
      // Use frameless window for custom title bar
      frame: false,
      // No need for autoHideMenuBar with frameless window
      // autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      // Add background color to prevent white flash during loading
      backgroundColor: '#1e1e2e',
    });

    logger.info('BrowserWindow created successfully');

    // Hide the menu bar completely
    mainWindow.setMenuBarVisibility(false);
    logger.info('Menu bar visibility set to false');

    // Verify contentView is created
    logger.info(`Main window contentView exists: ${!!mainWindow.contentView}`);

    // Log some window properties for debugging
    logger.info(`Window bounds: ${JSON.stringify(mainWindow.getBounds())}`);
    logger.info(`Window is visible: ${mainWindow.isVisible()}`);
    logger.info(`Window is minimized: ${mainWindow.isMinimized()}`);
    logger.info(`Window is maximized: ${mainWindow.isMaximized()}`);
    logger.info(`Window is fullscreen: ${mainWindow.isFullScreen()}`);

    // and load the index.html of the app.
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    logger.info(`Loading URL: ${MAIN_WINDOW_WEBPACK_ENTRY}`);

    // Give a clearer hint when the renderer fails to load (often a dev-server port clash)
    if (entryMeta?.isHttp && entryMeta.isLocalhost) {
      mainWindow.webContents.on(
        'did-fail-load',
        async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (!isMainFrame) return;

          const reachable = await isPortReachable(entryMeta.host, entryMeta.port);
          const base = `${errorCode}: ${errorDescription} while loading ${validatedURL || MAIN_WINDOW_WEBPACK_ENTRY}`;
          const hint = reachable
            ? `Port ${entryMeta.port} is already in use by another process. Stop that process or set WEBPACK_DEV_SERVER_PORT to a free port.`
            : `Renderer dev server is not reachable at ${entryMeta.description}. It may have failed to start.`;
          const message = `${base}.\n${hint}`;

          logger.error(message);
          dialog.showErrorBox('Renderer failed to load', message);
        }
      );
    }

    // Open the DevTools in development mode only
    if (process.env.NODE_ENV === 'development') {
      logger.info('Opening DevTools in development mode');
      mainWindow.webContents.openDevTools();
    }

    // Log when the window is ready to show
    mainWindow.once('ready-to-show', () => {
      logger.info('Main window is ready to show');
    });

    // Log window lifecycle events
    mainWindow.on('show', () => {
      logger.info('Main window shown');
    });

    mainWindow.on('hide', () => {
      logger.info('Main window hidden');
    });

    mainWindow.on('focus', () => {
      logger.info('Main window focused');
    });

    mainWindow.on('blur', () => {
      logger.info('Main window blurred');
    });

    mainWindow.on('close', async event => {
      if (!global.isForceQuitting) {
        try {
          const repo = getDataSource().getRepository(Config);
          const configEntity = await repo.findOneBy({ key: CONFIG_KEYS.APP });
          const appConfig = (configEntity?.value as AppConfig) || DEFAULT_APP_CONFIG;

          if (appConfig.runInBackground) {
            event.preventDefault();
            mainWindow.hide();
            logger.info('Main window hidden instead of closed');
            return;
          }
        } catch (error) {
          logger.error('Error checking runInBackground config:', error);
        }
      }
      logger.info('Main window closing');
    });

    return mainWindow;
  } catch (error) {
    logger.error(`Error creating main window: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack available'}`);
    throw error;
  }
};

export const createFloatingWindow = async (): Promise<BrowserWindow> => {
  logger.info('Creating floating window');

  try {
    const floatingWindow = new BrowserWindow({
      alwaysOnTop: true,
      transparent: true,
      icon: path.join(__dirname, 'icon.ico'),

      resizable: false,
      skipTaskbar: true,
      show: false,

      width: 600,
      height: 400,
      title: 'FlowTranslatePopup',
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
      // Use frameless window for custom title bar
      frame: false,
      // No need for autoHideMenuBar with frameless window
      // autoHideMenuBar: true,
      titleBarStyle: 'hidden',
    });

    floatingWindow.loadURL(`${MAIN_WINDOW_WEBPACK_ENTRY}#/flow-translate`);

    floatingWindow.on('blur', () => {
      floatingWindow.hide();
    });

    // Enable debugging for the floating window
    // if (process.env.NODE_ENV === 'development') {
    //   floatingWindow.webContents.openDevTools({ mode: 'detach' });
    // }

    // Remove the title bar and menu for the floating window
    floatingWindow.setMenu(null);

    return floatingWindow;
  } catch (error) {
    logger.error(`Error creating floating window: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};
