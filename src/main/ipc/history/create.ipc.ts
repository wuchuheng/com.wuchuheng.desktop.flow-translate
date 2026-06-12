import { createHistory } from '../../database/repositories/history.repository';

const create = async (payload: { input: string }) => {
  const id = await createHistory(payload.input);
  return { id };
};

export default create;
