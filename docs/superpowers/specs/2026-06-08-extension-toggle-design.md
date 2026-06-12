# Grammarly Extension Toggle

## Summary

Add a persistent toggle to enable/disable the Grammarly Chrome extension in Flow Translate. When disabled, the extension does not load at all. The toggle lives in the General settings tab with a restart prompt on change.

## Motivation

Users may want to disable the Grammarly extension to reduce resource usage, avoid conflicts, or use the app without Grammarly features. Currently there is no way to control extension loading.

## Design

### Config Layer

Extend `AppConfig` in `src/shared/constants.ts`:

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

`extensionEnabled` defaults to `true` so existing users are unaffected.

### Main Process: Conditional Extension Loading

In `src/main/main.ts`, read `AppConfig` from the database before calling `loadExtension()`. The DB is initialized via `registerBootTask` + `runBootTasks` before window creation, so the config is available.

```ts
// In app.on('ready'), after runBootTasks():
const configRepo = getDataSource().getRepository(Config);
const configEntity = await configRepo.findOneBy({ key: CONFIG_KEYS.APP });
const appConfig = (configEntity?.value as AppConfig) ?? DEFAULT_APP_CONFIG;

// Pass flag to createWindow
mainWindow = await createWindow(appConfig.extensionEnabled);
```

In `src/main/windows/windowFactory.ts`, `createWindow()` accepts an `extensionEnabled` parameter:

```ts
export const createWindow = async (extensionEnabled = true): Promise<BrowserWindow> => {
  const grammarlySession = getGrammarlySession();
  if (extensionEnabled) {
    const extensions = getExtensions();
    await loadExtension(grammarlySession);
  }
  // ... rest unchanged
};
```

When `extensionEnabled` is `false`, the extension is never loaded into the session, and `getExtensions()` is not called. The session is still created (other windows may reference it), but no extension is attached.

### Settings UI

In `src/renderer/pages/Settings/components/GeneralSettingsTab.tsx`, add a new Switch:

```tsx
<Form.Item
  label="Enable Grammarly Extension"
  name="extensionEnabled"
  valuePropName="checked"
  help="Load the Grammarly extension. Requires restart to take effect."
>
  <Switch />
</Form.Item>
```

The value is included in `appValues` when saving:

```ts
const appValues = {
  runInBackground: values.runInBackground,
  autoStart: values.autoStart,
  extensionEnabled: values.extensionEnabled,
};
```

### Restart Prompt

When the `extensionEnabled` value changes, show an Ant Design `Modal.confirm`:

```ts
if (formValues.extensionEnabled !== appConfig.extensionEnabled) {
  Modal.confirm({
    title: 'Restart Required',
    content: 'Extension settings will take effect after restart. Restart now?',
    okText: 'Restart Now',
    cancelText: 'Later',
    onOk: () => window.electron.system.restart(),
  });
}
```

### Restart IPC Handler

New file `src/main/ipc/system/restart.ipc.ts`:

```ts
import { app } from 'electron';

export default () => {
  app.relaunch();
  app.quit();
};
```

New entry in `src/shared/ipc-manifest.json`:

```json
{
  "system": {
    "restart": {
      "channel": "system:restart",
      "type": "invoke"
    }
  }
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/shared/constants.ts` | Add `extensionEnabled` to `AppConfig` type and default |
| `src/shared/ipc-manifest.json` | Add `system.restart` entry |
| `src/main/ipc/system/restart.ipc.ts` | New file — restart handler |
| `src/main/main.ts` | Read config, pass `extensionEnabled` to `createWindow` |
| `src/main/windows/windowFactory.ts` | `createWindow()` accepts `extensionEnabled` param |
| `src/renderer/pages/Settings/components/GeneralSettingsTab.tsx` | Add Switch + restart prompt |

## Edge Cases

- **First launch**: No config in DB yet. `DEFAULT_APP_CONFIG.extensionEnabled` is `true`, so extension loads normally.
- **Config missing key**: `?? DEFAULT_APP_CONFIG` fallback ensures the field is always populated.
- **Floating window**: Uses the same session but does not independently load the extension — no changes needed.
