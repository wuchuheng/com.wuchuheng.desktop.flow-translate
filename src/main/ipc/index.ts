import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { EventHandler, registerEvent } from '../utils/ipc-helper';

type IpcModule = {
  default: ((...args: unknown[]) => unknown) & Partial<EventHandler>;
};

const IPC_FILE_PATTERN = /\.ipc\.ts$/;

const normalizeChannel = (filename: string) => {
  const cleaned = filename.replace(/^\.\//, '').replace(IPC_FILE_PATTERN, '');
  const [moduleName, ...rest] = cleaned.split('/');
  const methodName = rest.join('/');

  if (!moduleName || !methodName) {
    throw new Error(`Invalid IPC file path "${filename}". Expected structure: <module>/<function>.ipc.ts`);
  }

  return {
    channel: `${moduleName}:${methodName}`,
    moduleName,
    methodName,
  };
};

/**
 * Sets up all IPC handlers automatically using webpack's require.context
 */
export const setupAllIpcHandlers = (): void => {
  logger.info('Setting up all IPC handlers');

  try {
    const ipcModules = import.meta.glob('./**/*.ipc.ts', { eager: true });
    const ipcModuleFiles = Object.keys(ipcModules);

    ipcModuleFiles.forEach((filename: string) => {
      try {
        const { channel, moduleName, methodName } = normalizeChannel(filename);
        const imported = ipcModules[filename] as IpcModule;
        const handler = imported?.default;

        if (!handler) {
          logger.warn(`No default export found for IPC module ${filename}`);
          return;
        }

        if ((handler as EventHandler)._isEvent) {
          registerEvent(channel, handler as EventHandler);
          logger.verbose(`Registered IPC event: ${moduleName}.${methodName}`);
          return;
        }

        ipcMain.handle(channel, async (_event, ...args) => handler(...args));
        logger.verbose(`Registered IPC handler: ${moduleName}.${methodName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting up IPC handler for ${filename}: ${message}`);
        if (process.env.NODE_ENV === 'development') {
          throw error;
        }
      }
    });

    logger.info(`All IPC handlers set up successfully (${ipcModuleFiles.length} modules)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to set up IPC handlers: ${message}`);
  }
};
