import { app } from 'electron';
import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';
import { onThemeUpdate } from './onThemeUpdate.ipc';
import { CONFIG_KEYS, type AppConfig } from '@/shared/constants';
import { logger } from '../../utils/logger';

type ConfigPayload = { key: string; value: unknown };

const saveConfig = async (payload: ConfigPayload) => {
  const repo = getDataSource().getRepository(Config);
  await repo.save({ key: payload.key, value: payload.value as Config['value'] });

  if (payload.key === CONFIG_KEYS.THEME) {
    onThemeUpdate(payload.value);
  }

  if (payload.key === CONFIG_KEYS.APP) {
    const appConfig = payload.value as AppConfig;
    try {
      app.setLoginItemSettings({
        openAtLogin: appConfig.autoStart,
        path: app.getPath('exe'),
      });
      logger.info(`Auto-start set to: ${appConfig.autoStart}`);
    } catch (error) {
      logger.error('Failed to set login item settings:', error);
    }
  }

  return true;
};

export default saveConfig;
