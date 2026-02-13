import { autoUpdater, UpdateInfo } from 'electron-updater';
import { logger } from '../utils/logger';
import { BrowserWindow } from 'electron';
import { onStatusChange } from '../ipc/update/onStatusChange.ipc';

export class UpdateService {
  private static instance: UpdateService;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
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

  private setupListeners() {
    autoUpdater.autoDownload = false; // Manual trigger for better UX
    autoUpdater.logger = logger;

    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow('update-error', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendStatusToWindow('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendStatusToWindow('update-downloaded', info);
    });
  }

  private sendStatusToWindow(channel: any, data?: any) {
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

  public downloadUpdate() {
    autoUpdater.downloadUpdate();
  }

  public quitAndInstall() {
    autoUpdater.quitAndInstall();
  }
}
