import { getHistoryById } from '../../database/repositories/history.repository';

const getById = async (payload: { id: number }) => {
  return getHistoryById(payload.id);
};

export default getById;
