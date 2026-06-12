import { BrowserWindow } from 'electron';

const resize = async (payload: { width: number; height: number }) => {
  const { width, height } = payload;

  // Find the specific floating window by title
  const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'FlowTranslatePopup');

  if (!win) return;

  const currentBounds = win.getBounds();

  // Only resize if dimensions actually changed
  if (currentBounds.width === width && currentBounds.height === height) return;

  // Keep top edge fixed so the window grows downward
  win.setBounds(
    {
      x: currentBounds.x,
      y: currentBounds.y,
      width: Math.round(width),
      height: Math.round(height),
    },
    true
  ); // animate: true
};

export default resize;
