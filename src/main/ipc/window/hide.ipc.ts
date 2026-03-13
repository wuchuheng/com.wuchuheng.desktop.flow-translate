import { floatingWindow } from '@/main/main';
import { restorePreviousWindow } from '@/main/utils/win-api-helper';

const hideWindow = async () => {
  floatingWindow?.hide();
  await restorePreviousWindow();
};

export default hideWindow;
