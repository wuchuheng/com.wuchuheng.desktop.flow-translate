# Electron App Template

Developer-friendly Electron + React + Tailwind template with zero-config IPC discovery, type-safe renderer bridge, and handy generators for new IPC endpoints.

## Quick Map
- Root: Forge/webpack configs, Tailwind config, `dev.sqlite`, logs/.
- `scripts/`: `sync-ipc-types.js` (manifest + types), `ipc-gen.js` (scaffold invoke/event IPC).
- `src/main/`: App entry (`main.ts`), window factory, logger, IPC loader (`ipc/index.ts`), IPC handlers (`ipc/<module>/<name>.ipc.ts`), services, DB (TypeORM) in `database/`.
- `src/preload/`: Builds `window.electron` from the generated IPC manifest.
- `src/shared/`: IPC helpers (`ipc-channel.ts`, `ipc-subscription.ts`, `config-utils.ts`), generated `ipc-manifest.json`.
- `src/types/`: Domain types + generated `generated-electron-api.d.ts`.
- `src/renderer/`: React UI (routes, layouts, pages `Home`/`About`, assets, styles).

## Scripts
- `npm start` — Runs `electron-forge start` (types sync runs first via `prestart`).
- `npm run ipc:sync` — Regenerate IPC manifest + types once.
- `npm run ipc:sync:watch` — Watch `src/main/ipc` and regenerate on change.
- `npm run ipc-gen:func <module>/<name>` — Scaffold an invoke-style IPC handler and sync types.
- `npm run ipc-gen:event <module>/<name>` — Scaffold an event-style IPC handler (`createEvent`) and sync types.
- `npm run make` / `npm run package` — Build artifacts (types sync runs first).
- `npm run lint` / `npm run format` — Lint/format.

## Hot Update System

The template features a zero-friction auto-update system designed for maximum security and minimal user interruption.

### 1. How it works
- **Silent Background Download**: The app automatically checks for updates on startup. If a new version is found, it downloads it immediately in the background without bothering the user.
- **Mandatory Notification**: Once the download is 100% complete, a professional dialog appears, showing the release notes and requiring a restart to apply the update.

### 2. Customizing `latest.yml`
Simply update the `version` and `releaseNotes` on your server. The app handles the rest.

```yaml
version: 1.0.25
releaseNotes: |
  ### 🚀 Performance Boost
  - Startup is now 50% faster.
  - Reduced memory usage.
```

### 3. Safety & Reliability
- **Retry Mechanism**: If the download is interrupted, it resumes on the next startup.
- **Differential Updates**: Only downloads changed bytes (via blockmap), saving user bandwidth.
- **Crash Resistance**: The update logic runs in the main process, independent of the UI.


## IPC Model (Main ↔ Renderer)
1) **Convention over config**: Add files at `src/main/ipc/<module>/<name>.ipc.ts`.
   - Invoke example: export an async function `(payload) => result`.
   - Event example: export `createEvent<Payload>()`.
2) **Auto discovery**: `src/main/ipc/index.ts` walks all `.ipc.ts` files.
   - Invoke handlers bind to `ipcMain.handle("<module>:<name>")`.
   - Events are detected via `_isEvent` and registered with `registerEvent` for broadcast + subscribe/unsubscribe.
3) **Sync script**: `scripts/sync-ipc-types.js` builds:
   - `src/shared/ipc-manifest.json` (channels + invoke/event kind).
   - `src/types/generated-electron-api.d.ts` (typed `window.electron` from real handler signatures).
4) **Preload bridge**: `src/preload/preload.ts` reads the manifest and exposes a plain object on `window.electron`:
   - Invoke: `window.electron.module.method(...args) -> Promise`.
   - Event: `window.electron.module.event(listener) -> unsubscribe()`.

## Adding IPC Endpoints
- Invoke: `npm run ipc-gen:func user/getProfile` then implement `src/main/ipc/user/getProfile.ipc.ts`.
- Event: `npm run ipc-gen:event system/onStatus` then trigger it from main via the returned event function.
- The generator auto-runs the sync script so renderer types are immediately updated.

## Development Flow
1) Install deps: `npm install`.
2) Add/modify IPC endpoints (see above).
3) Start dev: `npm start` (prestart sync runs once). For continuous sync, run `npm run ipc:sync:watch` in another terminal if desired.
4) Build: `npm run make` or `npm run package` (types sync runs first).

## Notes
- The sync script uses the TypeScript compiler API (no runtime `require`) so path aliases and types stay accurate.
- The IPC manifest and generated types are derived artifacts; do not hand-edit them.
