import { createEvent } from '../../utils/ipc-helper';
import type { UpdateState } from '@/shared/update-types';

export const onStatusChange = createEvent<UpdateState>();
export default onStatusChange;