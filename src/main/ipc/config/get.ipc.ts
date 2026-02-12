import { getDataSource } from '../../database/data-source';
import { Config } from '../../database/entities/config.entity';

const getConfig = async (key: string) => {
  const repo = getDataSource().getRepository(Config);
  const config = await repo.findOneBy({ key });
  return config?.value || null;
};

export default getConfig;
