import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';
import { onThemeUpdate } from './onThemeUpdate.ipc';

const saveConfig = async (payload: { key: string; value: unknown }) => {
  const repo = getDataSource().getRepository(Config);
  await repo.save(payload);

  if (payload.key === 'theme_config') {
    onThemeUpdate(payload.value);
  }

  return true;
};

export default saveConfig;
