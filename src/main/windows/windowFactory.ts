import { BrowserWindow, dialog, app, Session, session } from 'electron';
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
    createTab: async details => {
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

      if (!app.isPackaged) {
        tabWindow.webContents.openDevTools({ mode: 'detach' });
      }

      if (details.url) tabWindow.loadURL(details.url);

      return [tabWindow.webContents, tabWindow];
    },
    selectTab: () => {
      // Intentionally do nothing.
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
      height: 1200,
      width: 1800,
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

    // Auto-open DevTools
    mainWindow.webContents.openDevTools();

    extensions.addTab(mainWindow.webContents, mainWindow);

    logger.info('BrowserWindow created successfully');

    // Hide the menu bar completely
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(mainWindowEntry);

    return mainWindow;
  } catch (error) {
    logger.error(`Error creating main window: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

export const createFloatingWindow = async (): Promise<BrowserWindow> => {
  logger.info('Creating floating window');

  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();
  const grammarlySession = getGrammarlySession();
  const extensions = getExtensions();

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

    // Open DevTools for floating window
    floatingWindow.webContents.openDevTools({ mode: 'detach' });

    // Register the floating window as a tab so extension APIs like
    // chrome.tabs.query() return it and content scripts attach to it.
    // extensions.addTab(floatingWindow.webContents, floatingWindow);

    floatingWindow.loadURL(`${mainWindowEntry}#/flow-translate`);

    floatingWindow.on('blur', () => {
      floatingWindow.hide();
    });

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
  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();

  const updateWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    alwaysOnTop: true,
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

  // Auto-open DevTools
  updateWindow.webContents.openDevTools({ mode: 'detach' });

  updateWindow.loadURL(`${mainWindowEntry}#/update-dialog`);
  updateWindow.once('ready-to-show', () => updateWindow.show());
  return updateWindow;
};

/**
 * Opens a Grammarly sign-in window in the persist:grammarly session.
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

  // Always open DevTools
  authWindow.webContents.openDevTools({ mode: 'detach' });

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
