import { spawn, spawnSync } from 'child_process';
import { screen } from 'electron';
import { logger } from './logger';

/**
 * Gets the caret position using PowerShell and Windows API.
 * Falls back to mouse position if caret position cannot be determined.
 */
export const getCaretPosition = (): { x: number; y: number } => {
  try {
    const psScript = `
      Add-Type -TypeDefinition '
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
          [StructLayout(LayoutKind.Sequential)]
          public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
          [StructLayout(LayoutKind.Sequential)]
          public struct GUITHREADINFO {
              public int cbSize;
              public int flags;
              public IntPtr hwndActive;
              public IntPtr hwndFocus;
              public IntPtr hwndCapture;
              public IntPtr hwndMenu;
              public IntPtr hwndMoveSize;
              public IntPtr hwndCaret;
              public RECT rcCaret;
          }
          [DllImport("user32.dll")]
          public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO lpgui);
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId);
          [DllImport("user32.dll")]
          public static extern bool ClientToScreen(IntPtr hWnd, ref System.Drawing.Point lpPoint);
      }';
      $gui = New-Object Win32+GUITHREADINFO;
      $gui.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($gui);
      $fgWin = [Win32]::GetForegroundWindow();
      $threadId = [Win32]::GetWindowThreadProcessId($fgWin, [IntPtr]::Zero);
      if ([Win32]::GetGUIThreadInfo($threadId, [ref]$gui)) {
          $p = New-Object System.Drawing.Point($gui.rcCaret.Left, $gui.rcCaret.Top);
          if ([Win32]::ClientToScreen($gui.hwndCaret, [ref]$p)) {
              Write-Output "$($p.X),$($p.Y)"
          }
      }
    `;

    const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], { encoding: 'utf8' });
    const output = result.stdout.trim();

    if (output && output.includes(',')) {
      const [x, y] = output.split(',').map(Number);
      if (!isNaN(x) && !isNaN(y) && (x !== 0 || y !== 0)) {
        return { x, y };
      }
    }
  } catch (error) {
    logger.warn('Failed to get caret position via PowerShell:', error);
  }

  // Fallback to mouse position
  const cursor = screen.getCursorScreenPoint();
  return cursor;
};

// --- Window Focus Management ---

let lastActiveWindowHandle = '0';

/**
 * Captures the currently active window handle (hWnd).
 * Call this BEFORE showing the floating window.
 */
export const capturePreviousWindow = (): void => {
  try {
    const psScript = `
      Add-Type -TypeDefinition '
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
        }
      ';
      [Win32]::GetForegroundWindow()
    `;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], { encoding: 'utf8' });
    const handle = result.stdout.trim();
    if (handle && handle !== '0') {
      lastActiveWindowHandle = handle;
      logger.info(`Captured active window handle: ${handle}`);
    }
  } catch (error) {
    logger.error(`Failed to capture window handle: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Restores focus to the previously captured window.
 * Call this AFTER hiding the floating window and BEFORE typing.
 */
export const restorePreviousWindow = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!lastActiveWindowHandle || lastActiveWindowHandle === '0') {
      resolve();
      return;
    }

    logger.info(`Restoring focus to window handle: ${lastActiveWindowHandle}`);
    
    const psScript = `
      Add-Type -TypeDefinition '
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
        }
      ';
      [Win32]::SetForegroundWindow([IntPtr]${lastActiveWindowHandle})
    `;

    const ps = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    
    ps.on('close', () => {
      // Give a tiny buffer for the OS to actually switch the context
      setTimeout(resolve, 100);
    });
    
    ps.on('error', (err) => {
      logger.error(`Failed to restore focus: ${err instanceof Error ? err.message : String(err)}`);
      resolve();
    });
  });
};

/**
 * Prepares the target app by deleting the original content (Backspaces).
 */
export const prepareTargetApp = (count: number): Promise<void> => {
  return new Promise((resolve) => {
    if (count <= 0) {
      resolve();
      return;
    }
    logger.info(`Sending ${count} backspaces...`);
    const ps = spawn('powershell', [
      '-NoProfile', 
      '-Command', 
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE ${count}}');`
    ]);
    ps.on('close', () => resolve());
    ps.on('error', (err) => {
      logger.error(`Error sending backspaces: ${err instanceof Error ? err.message : String(err)}`);
      resolve(); 
    });
  });
};

/**
 * Pastes text using the clipboard and Ctrl+V.
 */
export const pasteText = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }

    logger.info(`Pasting text (len: ${text.length})...`);

    // We use a PowerShell script to handle clipboard operations robustly.
    // 1. Set Clipboard
    // 2. Send Ctrl+V
    const escapedText = text.replace(/'/g, "''");
    
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.Clipboard]::SetText('${escapedText}');
      Start-Sleep -Milliseconds 50;
      [System.Windows.Forms.SendKeys]::SendWait('^v');
    `;

    const ps = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    
    ps.on('close', () => resolve());
    ps.on('error', (err) => {
      logger.error(`Error pasting text: ${err instanceof Error ? err.message : String(err)}`);
      resolve();
    });
  });
};
