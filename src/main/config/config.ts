import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Resolves the path to the Chrome extension used for scraping.
 * In production, it should be in the resources folder.
 */
export const getExtensionPath = (): string => {
  // In the new template structure, we'll aim for a predictable location
  const packedExtensionPath = path.join(process.resourcesPath, 'extensions/grammarly/14.1276.0_0');
  const unpackedExtensionPath = path.resolve(app.getAppPath(), 'src/renderer/assets/extensions/grammarly/14.1276.0_0');

  const extensionPath = app.isPackaged ? packedExtensionPath : unpackedExtensionPath;

  if (!fs.existsSync(extensionPath)) {
    logger.warn(`Extension path: ${extensionPath} not found. Some scraper features may not work.`);
    // We don't throw here to allow the app to boot even if extension is missing during dev
  }
  return extensionPath;
};
