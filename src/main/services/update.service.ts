import { autoUpdater, UpdateInfo } from 'electron-updater';
import { logger } from '../utils/logger';
import { BrowserWindow, app } from 'electron';
import { onStatusChange, UpdateStatus } from '../ipc/update/onStatusChange.ipc';

export class UpdateService {
  private static instance: UpdateService;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    this.init();
    this.setupListeners();
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private getUpdateUrl(): string {
    const isDev = !app.isPackaged;
    const defaultBaseUrl = 'http://localhost:6003/apps/29/staticFiles';

    const baseUrl = isDev
      ? process.env.DEV_UPDATE_SERVER_URL || defaultBaseUrl
      : process.env.PROD_UPDATE_SERVER_URL || defaultBaseUrl;

    // Standard: Return the directory path. electron-updater will append /latest.yml automatically.
    return `${baseUrl}/${process.platform}/${process.arch}`;
  }

  private init() {
    autoUpdater.autoDownload = false; // Set to false for manual triggering
    autoUpdater.logger = logger;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: this.getUpdateUrl(),
    });
  }

  private setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-available', info);
      logger.info('Update available.');
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-not-available', info);
    });

    autoUpdater.on('error', err => {
      this.sendStatusToWindow('update-error', err);
      logger.error(`Update error: ${err.message}`);
    });

    autoUpdater.on('download-progress', progressObj => {
      this.sendStatusToWindow('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-downloaded', info);
      logger.info('Update downloaded.');
    });
  }

  private sendStatusToWindow(channel: UpdateStatus['channel'], data?: unknown) {
    onStatusChange({ channel, data });
  }

  public async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Check for updates failed:', error);
      throw error;
    }
  }

  public async downloadUpdate() {
    try {
      return await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Download update failed:', error);
      throw error;
    }
  }

  public quitAndInstall() {
    autoUpdater.quitAndInstall();
  }
}
