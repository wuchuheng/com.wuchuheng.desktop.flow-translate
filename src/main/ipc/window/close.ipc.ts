import { getMainWindow } from '../../main';
import { restorePreviousWindow } from '@/main/utils/win-api-helper';

const closeWindow = async () => {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    await restorePreviousWindow();
  }
};

export default closeWindow;
