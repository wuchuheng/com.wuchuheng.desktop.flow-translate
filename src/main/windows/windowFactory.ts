import { BrowserWindow, dialog, app, Session, session, webContents } from 'electron';
import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import net from 'node:net';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getDataSource } from '../database/data-source';
import { Config } from '../database/entities/config.entity';
import { CONFIG_KEYS, AppConfig, DEFAULT_APP_CONFIG } from '@/shared/constants';
import { getExtensionPath } from '../config/config';

const getMainWindowEntry = () => {
  if (process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL;
  }
  return `file://${path.join(__dirname, '../renderer/index.html')}`;
};

const getPreloadEntry = () => {
  return path.join(__dirname, '../preload/index.js');
};

declare global {
  // eslint-disable-next-line no-var
  var isForceQuitting: boolean | undefined;
}

/**
 * The persistent named session shared by the Grammarly extension and all windows.
 */
export const GRAMMARLY_SESSION_PARTITION = 'persist:grammarly';

export const getGrammarlySession = (): Session => {
  return session.fromPartition(GRAMMARLY_SESSION_PARTITION);
};

let extensionsInstance: ElectronChromeExtensions | null = null;

export const getExtensions = (): ElectronChromeExtensions => {
  if (extensionsInstance) return extensionsInstance;
  
  const grammarlySession = getGrammarlySession();
  extensionsInstance = new ElectronChromeExtensions({
    license: 'GPL-3.0',
    session: grammarlySession,
    // Called when Grammarly's service worker invokes chrome.tabs.create().
    createTab: async (details) => {
      logger.info(`chrome.tabs.create intercepted: ${details.url}`);
      const tabWindow = new BrowserWindow({
        width: 520,
        height: 700,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        title: details.title || 'Grammarly',
        webPreferences: {
          session: grammarlySession, // same session → shared cookies
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      if (details.url) tabWindow.loadURL(details.url);

      return [tabWindow.webContents, tabWindow];
    },
    selectTab: (webContents, browserWindow) => {
      // Intentionally do nothing.
      // ECE maps extensions' "tabs" to full Electron BrowserWindows.
      // If we call browserWindow.focus() here, Grammarly's background scripts 
      // polling or selecting tabs will aggressively yank desktop focus and steal 
      // the screen from the user. We want the user to manage their own window focus.
    },
  });
  return extensionsInstance;
};

const parseEntryPort = (entryUrl: string) => {
  try {
    const url = new URL(entryUrl);
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

  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();
  const entryMeta = parseEntryPort(mainWindowEntry);

  if (process.env.NODE_ENV === 'development') {
    try {
      await ensureRendererAvailable(mainWindowEntry, entryMeta);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Renderer entry not reachable: ${message}`);
      dialog.showErrorBox('Renderer failed to load', message);
      throw error;
    }
  }

  try {
    // Both windows use the grammarly session so extensions work everywhere
    const grammarlySession = getGrammarlySession();
    const extensions = getExtensions();
    await loadExtension(grammarlySession);

    // Create the browser window.
    logger.info(`Creating BrowserWindow with preload path: ${preloadEntry}`);
    logger.info(`Main window entry: ${mainWindowEntry}`);

    const mainWindow = new BrowserWindow({
      height: 800 * 1.5,
      width: 1200 * 1.5,
      icon: app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(app.getAppPath(), 'src/renderer/assets/genLogo/icon.ico'),
      webPreferences: {
        preload: preloadEntry,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        session: grammarlySession, // attach main window to extension session
      },
      // Use frameless window for custom title bar
      frame: false,
      titleBarStyle: 'hidden',
      // Add background color to prevent white flash during loading
      backgroundColor: '#1e1e2e',
    });

    extensions.addTab(mainWindow.webContents, mainWindow);

    logger.info('BrowserWindow created successfully');

    // Hide the menu bar completely
    mainWindow.setMenuBarVisibility(false);
    logger.info('Menu bar visibility set to false');

    // Pipe renderer console messages to main process logger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mainWindow.webContents.on('console-message', event => {
      const { level, message, sourceId, lineNumber: line } = event;
      // Filter out DevTools internal errors (Autofill is not available in Electron)
      if (sourceId?.includes('devtools://')) return;

      const lvl = level as unknown as number;
      if (lvl === 3) {
        logger.error(`[RENDERER ERROR] ${message} (${sourceId}:${line})`);
      } else if (lvl === 2) {
        logger.warn(`[RENDERER WARN] ${message} (${sourceId}:${line})`);
      } else {
        logger.info(`[RENDERER] ${message} (${sourceId}:${line})`);
      }
    });


    // Verify contentView is created
    logger.info(`Main window contentView exists: ${!!mainWindow.contentView}`);

    // Log some window properties for debugging
    logger.info(`Window bounds: ${JSON.stringify(mainWindow.getBounds())}`);
    logger.info(`Window is visible: ${mainWindow.isVisible()}`);
    logger.info(`Window is minimized: ${mainWindow.isMinimized()}`);
    logger.info(`Window is maximized: ${mainWindow.isMaximized()}`);
    logger.info(`Window is fullscreen: ${mainWindow.isFullScreen()}`);

    // and load the index.html of the app.
    mainWindow.loadURL(mainWindowEntry);
    logger.info(`Loading URL: ${mainWindowEntry}`);

    // Give a clearer hint when the renderer fails to load (often a dev-server port clash)
    if (entryMeta?.isHttp && entryMeta.isLocalhost) {
      mainWindow.webContents.on(
        'did-fail-load',
        async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (!isMainFrame) return;

          const reachable = await isPortReachable(entryMeta.host, entryMeta.port);
          const base = `${errorCode}: ${errorDescription} while loading ${validatedURL || mainWindowEntry}`;
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

  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();
  const grammarlySession = getGrammarlySession();
  const extensions = getExtensions();

  // Load the extension into the persistent session (after extensions API is ready)
  await loadExtension(grammarlySession);

  try {
    const floatingWindow = new BrowserWindow({
      alwaysOnTop: true,
      transparent: true,
      icon: app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(app.getAppPath(), 'src/renderer/assets/genLogo/icon.ico'),
      resizable: false,
      skipTaskbar: true,
      show: false,
      width: 600,
      height: 400,
      title: 'FlowTranslatePopup',
      webPreferences: {
        preload: preloadEntry,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        session: grammarlySession,
      },
      frame: false,
      titleBarStyle: 'hidden',
    });

    // Register the floating window as a tab so extension APIs like
    // chrome.tabs.query() return it and content scripts attach to it.
    extensions.addTab(floatingWindow.webContents, floatingWindow);

    floatingWindow.loadURL(`${mainWindowEntry}#/flow-translate`);

    floatingWindow.on('blur', () => {
      floatingWindow.hide();
    });

    floatingWindow.setMenu(null);

    if (process.env.NODE_ENV === 'development') {
      floatingWindow.webContents.openDevTools({ mode: 'detach' });
    }

    return floatingWindow;
  } catch (error) {
    logger.error(`Error creating floating window: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};


/**
 * Creates a dedicated, non-resizable dialog window for the software update process.
 */
export const createUpdateWindow = async (): Promise<BrowserWindow> => {
  logger.info('Creating update window');

  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();

  try {
    const updateWindow = new BrowserWindow({
      width: 450,
      height: 600,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      icon: app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(app.getAppPath(), 'src/renderer/assets/genLogo/icon.ico'),
      webPreferences: {
        preload: preloadEntry,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#1e1e2e',
      show: false,
    });

    // Navigate to the specific update-dialog route
    updateWindow.loadURL(`${mainWindowEntry}#/update-dialog`);

    updateWindow.once('ready-to-show', () => {
      updateWindow.show();
      // Optional: Open DevTools in dev mode for this window
      // updateWindow.webContents.openDevTools({ mode: 'detach' });
    });

    updateWindow.setMenu(null);

    return updateWindow;
  } catch (error) {
    logger.error(`Error creating update window: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};


/**
 * Opens a Grammarly sign-in window in the persist:grammarly session.
 * Since electron-chrome-extensions implements chrome.tabs.create at the IPC level,
 * Grammarly's service worker will call it automatically when the user clicks
 * "Log in" in its popup. This manual button is a fallback convenience.
 */
export const openGrammarlyAuthWindow = (targetUrl = 'https://www.grammarly.com/signin'): BrowserWindow => {
  logger.info(`Opening Grammarly window for ${targetUrl}`);
  const grammarlySession = getGrammarlySession();

  const authWindow = new BrowserWindow({
    width: 520,
    height: 680,
    alwaysOnTop: true,
    title: 'Grammarly',
    autoHideMenuBar: true,
    webPreferences: {
      session: grammarlySession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  authWindow.loadURL(targetUrl);

  return authWindow;
};

export const loadExtension = async (browserSession: Session) => {
  const extensionPath = getExtensionPath();
  try {
    const ext = await browserSession.extensions.loadExtension(extensionPath, {
      allowFileAccess: true,
    });
    logger.info(`Extension loaded: ${ext.name} | Version: ${ext.version} | ID: ${ext.id}`);
    
  } catch (err) {
    logger.error(`Failed to load extension from ${extensionPath}: ${err}`);
  }
};
