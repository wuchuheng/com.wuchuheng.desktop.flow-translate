import { createEvent } from '../../utils/ipc-helper';

export type UpdateStatus = {
  channel: 'checking-for-update' | 'update-available' | 'update-not-available' | 'update-error' | 'download-progress' | 'update-downloaded';
  data?: unknown;
};

export const onStatusChange = createEvent<UpdateStatus>();
export default onStatusChange;
