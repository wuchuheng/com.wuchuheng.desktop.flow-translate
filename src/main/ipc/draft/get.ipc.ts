import { draftCache } from './save.ipc';

const get = async () => draftCache;

export default get;
