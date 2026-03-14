import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Resolves the path to the Chrome extension used for scraping.
 * In production, it should be in the resources folder.
 */
export const getExtensionPath = (): string => {
  // Try versioned paths first, falling back to a direct path if necessary
  const version = '14.1276.0_0';

  // In production, electron-builder puts extraResources into process.resourcesPath
  // If we asarUnpack them, they are in app.asar.unpacked/src/renderer/assets/extensions/...
  const packedPath = path.join(process.resourcesPath, `extensions/grammarly/${version}`);
  const unpackedPath = path.join(
    process.resourcesPath,
    `app.asar.unpacked/src/renderer/assets/extensions/grammarly/${version}`
  );

  // In development, they are in the source tree
  const devPath = path.resolve(app.getAppPath(), `src/renderer/assets/extensions/grammarly/${version}`);

  let extensionPath = devPath;

  if (app.isPackaged) {
    if (fs.existsSync(unpackedPath)) {
      extensionPath = unpackedPath;
    } else if (fs.existsSync(packedPath)) {
      extensionPath = packedPath;
    }
  }

  if (!fs.existsSync(extensionPath)) {
    logger.warn(`Extension path: ${extensionPath} not found. Some scraper features may not work.`);
  } else {
    logger.info(`Resolved extension path: ${extensionPath}`);
  }

  return extensionPath;
};
