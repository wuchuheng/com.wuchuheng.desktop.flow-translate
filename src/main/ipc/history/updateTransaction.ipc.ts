import { updateTransaction } from '../../database/repositories/history.repository';

const updateTxn = async (payload: { id: number; transaction: string }) => {
  await updateTransaction(payload.id, payload.transaction);
};

export default updateTxn;
