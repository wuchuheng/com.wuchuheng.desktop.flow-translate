# Feature Specification: Run in Background, Auto-start & System Tray Integration (Lazy Trans)

## 1. Overview
This feature enhances the Lazy Trans persistence and accessibility. It allows the app to run in the background (hidden) when the main window is closed, provides a system tray icon for quick access, and includes an option for the application to start automatically when the computer boots.

## 2. Requirements
- **Run in Background**: 
  - When enabled, closing the main window hides it instead of quitting the application.
  - **Default**: Enabled.
- **System Tray**:
  - A tray icon is visible whenever the app is running.
  - Left-clicking/Double-clicking the icon restores the main window.
  - Right-click menu includes:
    - **Show App**: Restores and focuses the main window.
    - **Quit**: Completely terminates the application, bypassing the background setting.
- **Auto-start on Boot**:
  - A configuration option to enable/disable automatic startup with the OS.
  - **Default**: Disabled (standard practice, but configurable).
- **Floating Window**:
  - Remains active and accessible via global shortcuts even when the main window is hidden in the tray.

## 3. Technical Design

### 3.1 Configuration (`src/shared/constants.ts`)
- New configuration key: `APP_CONFIG`.
- Type definition:
  ```typescript
  export type AppConfig = {
    runInBackground: boolean;
    autoStart: boolean;
  };
  ```
- Default values: `{ runInBackground: true, autoStart: false }`.

### 3.2 Main Process Changes (`src/main/main.ts`)
- **Tray Management**:
  - Initialize a `Tray` instance using `src/renderer/assets/genLogo/icon.ico` (Windows) or appropriate PNG.
  - Implement a `forceQuit` flag to distinguish between user clicking "Close" on window and user clicking "Quit" in the tray.
- **Lifecycle Management**:
  - Modify `app.on('window-all-closed')`: Do not quit if `runInBackground` is true.
  - Modify `mainWindow.on('close')`:
    ```typescript
    if (!forceQuit && config.runInBackground) {
      event.preventDefault();
      mainWindow.hide();
    }
    ```
- **Auto-start**:
  - Use `app.setLoginItemSettings({ openAtLogin: value })` to manage startup behavior.
  - Update this setting whenever the `autoStart` config is changed via IPC.

### 3.3 IPC Changes
- Add a new IPC handler (if needed) or reuse `config/save.ipc.ts` to trigger `app.setLoginItemSettings` when `autoStart` is toggled.

### 3.4 UI Changes (`src/renderer/pages/Settings/components/GeneralSettingsTab.tsx`)
- Add two new toggles in the "General Settings" tab using Ant Design `Switch` or `Checkbox`:
  - "Run in background (Hide to tray on close)"
  - "Auto-start on boot"

## 4. Implementation Plan

1.  **Constants**: Define `APP_CONFIG` key and `AppConfig` type.
2.  **Seed Data**: Update `src/main/database/seed.ts` to include default `APP_CONFIG`.
3.  **Tray Service**: Create `src/main/utils/tray-helper.ts` to handle tray creation and menu management.
4.  **Main Process Integration**:
    - Manage `forceQuit` state.
    - Setup tray in `app.ready`.
    - Implement window close interception in `windowFactory.ts`.
    - Implement auto-start logic using `app.setLoginItemSettings`.
5.  **Settings UI**: 
    - Add UI elements to `GeneralSettingsTab.tsx`.
    - Ensure settings are saved and applied (especially `autoStart`).
6.  **Verification**: 
    - Test "Close" button behavior.
    - Test "Quit" from tray.
    - Verify tray icon restoration.
    - Verify `setLoginItemSettings` (can be checked via Task Manager -> Startup).

## 5. Open Questions / Considerations
- **Icon Compatibility**: Ensure the tray icon looks good in both light and dark taskbar themes.
- **Squirrel Startup**: The app uses `electron-squirrel-startup`. Verify that `setLoginItemSettings` plays nice with it (it usually does on Windows).
