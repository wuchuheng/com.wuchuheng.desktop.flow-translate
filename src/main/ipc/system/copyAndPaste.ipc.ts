import { restorePreviousWindow, pasteText } from '../../utils/win-api-helper';

const copyAndPaste = async (text: string) => {
  if (!text) return false;

  await restorePreviousWindow();
  await pasteText(text);

  return true;
};

export default copyAndPaste;
