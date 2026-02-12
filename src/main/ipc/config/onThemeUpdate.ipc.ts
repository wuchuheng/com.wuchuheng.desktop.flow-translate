import { createEvent } from '../../utils/ipc-helper';

export const onThemeUpdate = createEvent<unknown>();
export default onThemeUpdate;
