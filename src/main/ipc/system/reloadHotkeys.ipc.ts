import { registerGlobalShortcut } from '../../main';

const reloadHotkeys = async () => {
  await registerGlobalShortcut();
  return true;
};

export default reloadHotkeys;
