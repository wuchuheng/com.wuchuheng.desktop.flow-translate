import { BrowserWindow, screen } from 'electron';

const resize = async (payload: { width: number; height: number }) => {
  const { width, height } = payload;
  
  // Find the specific floating window by title
  const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'FlowTranslatePopup');
  
  if (!win) return;

  const currentBounds = win.getBounds();
  
  // Only resize if dimensions actually changed
  if (currentBounds.width === width && currentBounds.height === height) return;

  // We need to maintain the "bottom anchor" position.
  // The rule is: height from bottom of popup to screen bottom = 20% of screen height.
  // So: Y = ScreenHeight - BottomMargin - NewHeight
  
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  
  const bottomMargin = Math.round(display.bounds.height * 0.2);
  const newY = Math.round(display.bounds.y + display.bounds.height - height - bottomMargin);
  
  // We keep the X center position roughly the same, or re-center based on new width
  const newX = Math.round(display.bounds.x + (display.bounds.width - width) / 2);

  win.setBounds({
    x: newX,
    y: newY,
    width: Math.round(width),
    height: Math.round(height)
  }, true); // animate: true
};

export default resize;
