import { getAllHistory } from '../../database/repositories/history.repository';

const getAll = async (): Promise<{ id: number; createdAt: string }[]> => {
  return getAllHistory();
};

export default getAll;
