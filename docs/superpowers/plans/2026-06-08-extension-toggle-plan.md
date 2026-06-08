# Grammarly Extension Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent toggle in General settings to enable/disable the Grammarly extension, with restart-on-change.

**Architecture:** Extend `AppConfig` with `extensionEnabled` field, conditionally load the extension in `createWindow()`, add IPC restart handler, and add a Switch + restart Modal in the General settings tab.

**Tech Stack:** Electron, TypeScript, React, Ant Design, TypeORM (SQLite)

---

### Task 1: Extend AppConfig type and default

**Files:**
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Add `extensionEnabled` to AppConfig type and default**

```ts
export type AppConfig = {
  runInBackground: boolean;
  autoStart: boolean;
  extensionEnabled: boolean;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  runInBackground: true,
  autoStart: false,
  extensionEnabled: true,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/constants.ts
git commit -m "feat: add extensionEnabled to AppConfig type and default"
```

---

### Task 2: Add system restart IPC

**Files:**
- Create: `src/main/ipc/system/restart.ipc.ts`
- Modify: `src/shared/ipc-manifest.json`

- [ ] **Step 1: Create restart IPC handler**

```ts
import { app } from 'electron';

const restart = () => {
  app.relaunch();
  app.quit();
};

export default restart;
```

- [ ] **Step 2: Add restart to IPC manifest**

In `src/shared/ipc-manifest.json`, add to the `system` object:

```json
"restart": {
  "channel": "system:restart",
  "type": "invoke"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/system/restart.ipc.ts src/shared/ipc-manifest.json
git commit -m "feat: add system restart IPC handler"
```

---

### Task 3: Conditional extension loading in main process

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/windows/windowFactory.ts`

- [ ] **Step 1: Read AppConfig before creating main window**

In `src/main/main.ts`, change the `app.on('ready')` handler to read config and pass flag:

```ts
app.on('ready', async () => {
  try {
    createTray(getMainWindow, recreateMainWindow);

    // Read app config before creating windows
    const configRepo = getDataSource().getRepository(Config);
    const configEntity = await configRepo.findOneBy({ key: CONFIG_KEYS.APP });
    const appConfig = (configEntity?.value as AppConfig) ?? DEFAULT_APP_CONFIG;

    mainWindow = await createWindow(appConfig.extensionEnabled);
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    floatingWindow = await createFloatingWindow();

    setupAllIpcHandlers();

    initUpdateService();
    checkForUpdates().catch(err => {
      logger.error('Initial update check failed:', err);
    });

    registerBootTask({ title: 'Initializing Database ...', load: initDB });
    await runBootTasks();

    await registerGlobalShortcut();
  } catch (error) {
    logger.error(`Startup failed: ${error instanceof Error ? error.message : String(error)}`);
    app.quit();
  }
});
```

- [ ] **Step 2: Make `createWindow` accept extensionEnabled param**

In `src/main/windows/windowFactory.ts`:

```ts
export const createWindow = async (extensionEnabled = true): Promise<BrowserWindow> => {
  logger.info('Creating main window');

  const mainWindowEntry = getMainWindowEntry();
  const preloadEntry = getPreloadEntry();
  const entryMeta = parseEntryPort(mainWindowEntry);

  if (process.env.NODE_ENV === 'development') {
    try {
      await ensureRendererAvailable(mainWindowEntry, entryMeta);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Renderer entry not reachable: ${message}`);
      dialog.showErrorBox('Renderer failed to load', message);
      throw error;
    }
  }

  try {
    const grammarlySession = getGrammarlySession();

    if (extensionEnabled) {
      const extensions = getExtensions();
      await loadExtension(grammarlySession);
    }

    // ... rest of window creation unchanged ...
```

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts src/main/windows/windowFactory.ts
git commit -m "feat: conditionally load Grammarly extension based on config"
```

---

### Task 4: Add toggle UI to General settings

**Files:**
- Modify: `src/renderer/pages/Settings/components/GeneralSettingsTab.tsx`

- [ ] **Step 1: Add Switch, restart Modal, and update save logic**

Replace the component with:

```tsx
import React, { useEffect } from 'react';
import { Form, Input, Button, message, Switch, Divider, Modal } from 'antd';
import { useConfig } from '../../../hooks/useConfig';
import { CONFIG_KEYS, AppConfig, DEFAULT_APP_CONFIG } from '@/shared/constants';

const DEFAULT_HOTKEY = { toggleWindow: 'CommandOrControl+Alt+T' };

export const GeneralSettingsTab: React.FC = () => {
  const {
    config: hotkeyConfig,
    saveConfig: saveHotkeyConfig,
    loading: hotkeyLoading,
  } = useConfig<{ toggleWindow: string }>(CONFIG_KEYS.HOTKEYS, DEFAULT_HOTKEY);
  const {
    config: appConfig,
    saveConfig: saveAppConfig,
    loading: appLoading,
  } = useConfig<AppConfig>(CONFIG_KEYS.APP, DEFAULT_APP_CONFIG);

  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!hotkeyLoading && !appLoading) {
      form.setFieldsValue({
        ...hotkeyConfig,
        ...appConfig,
      });
    }
  }, [hotkeyConfig, appConfig, hotkeyLoading, appLoading, form]);

  const handleSave = async () => {
    const values = await form.validateFields();

    const hotkeyValues = { toggleWindow: values.toggleWindow };
    const appValues = {
      runInBackground: values.runInBackground,
      autoStart: values.autoStart,
      extensionEnabled: values.extensionEnabled,
    };

    await saveHotkeyConfig(hotkeyValues);
    await saveAppConfig(appValues);

    await window.electron.system.reloadHotkeys();

    // Prompt restart if extension toggle changed
    if (values.extensionEnabled !== appConfig.extensionEnabled) {
      Modal.confirm({
        title: 'Restart Required',
        content: 'Extension settings will take effect after restart. Restart now?',
        okText: 'Restart Now',
        cancelText: 'Later',
        onOk: () => window.electron.system.restart(),
      });
    }

    messageApi.success('General settings saved successfully');
  };

  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1e1e2e]">
      {contextHolder}
      <h3 className="mb-6 font-semibold text-gray-700 dark:text-gray-200">General Settings</h3>
      <Form form={form} layout="vertical" initialValues={{ ...DEFAULT_HOTKEY, ...DEFAULT_APP_CONFIG }}>
        <Form.Item
          label="Toggle Window Shortcut"
          name="toggleWindow"
          help="Format: CommandOrControl+Alt+T. Applied immediately."
        >
          <Input placeholder="e.g. CommandOrControl+Alt+T" />
        </Form.Item>

        <Divider />

        <Form.Item
          label="Run in background"
          name="runInBackground"
          valuePropName="checked"
          help="When enabled, closing the window will hide it to the system tray instead of quitting."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Auto-start on boot"
          name="autoStart"
          valuePropName="checked"
          help="Automatically start the application when you log in to your computer."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Enable Grammarly Extension"
          name="extensionEnabled"
          valuePropName="checked"
          help="Load the Grammarly extension. Requires restart to take effect."
        >
          <Switch />
        </Form.Item>

        <div className="mt-8">
          <Button type="primary" onClick={handleSave} size="large">
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/Settings/components/GeneralSettingsTab.tsx
git commit -m "feat: add Grammarly extension toggle in General settings"
```
