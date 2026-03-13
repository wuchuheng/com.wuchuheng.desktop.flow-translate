import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import packageJson from '../../../package.json';

/**
 * The root directory for all application-related data.
 */
export const getBaseDir = () => path.join(app.getPath('appData'), packageJson.name);

/**
 * Standardized utility for resolving all persistent data paths.
 * All paths are rooted in the Electron userData directory to ensure
 * persistence across application updates.
 */
export const getPaths = () => {
  const baseDir = getBaseDir();
  // Use a dedicated 'storage' folder in the app root to separate app data from Chromium system files.
  const storage = path.join(baseDir, 'storage');

  const paths = {
    // SQLite Database
    database: path.join(storage, 'database.sqlite'),

    // Application Logs
    logs: path.join(storage, 'logs'),
  };

  // Ensure critical directories exist
  [storage, paths.logs].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return paths;
};

/**
 * Resolves the absolute path to the application icon.
 */
export const getAppIconPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }
  return path.join(app.getAppPath(), 'src/renderer/assets/genLogo/icon.ico');
};
