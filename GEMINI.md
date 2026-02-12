# GEMINI.md - Project Context

## Project Overview
This is a modern **Electron + React + Tailwind CSS** application template designed for high developer productivity. It features a custom, zero-config IPC discovery system, type-safe communication between the Main and Renderer processes, and automated scaffolding for new features.

### Key Technologies
- **Core:** Electron, TypeScript, Webpack, Electron Forge.
- **Frontend UI:** React 19, Tailwind CSS, Ant Design (`antd`), React Router.
- **Backend (Main Process):** TypeORM with SQLite (`better-sqlite3`).
- **State & Logic:** Custom IPC handler discovery and type generation.
- **Internationalization:** i18next with React-i18next.

---

## Project Structure
- `src/main/`: Main process logic.
    - `database/`: TypeORM entities, repositories, and data source configuration.
    - `ipc/`: IPC handlers organized by module (`<module>/<name>.ipc.ts`).
    - `services/`: Business logic services.
    - `windows/`: Browser window management and factory.
- `src/renderer/`: Frontend React application.
    - `pages/`, `layout/`, `components/`: UI organization.
    - `hools/`: Custom React hooks (likely a typo for `hooks/`).
    - `i18n/`: Localization configuration.
- `src/preload/`: Preload bridge that exposes typed IPC methods to the renderer via `window.electron`.
- `src/shared/`: Shared utilities, types, and the generated IPC manifest.
- `src/types/`: TypeScript definitions, including the auto-generated `generated-electron-api.d.ts`.
- `scripts/`: Automation scripts for IPC synchronization and code generation.

---

## Development Workflows

### 1. IPC Management (Crucial)
The project uses a convention-over-configuration IPC system. **Do not manually edit `window.electron` types.**

- **Add Invoke Method:** `npm run ipc-gen:func <module>/<name>`
- **Add Event Method:** `npm run ipc-gen:event <module>/<name>`
- **Manual Sync:** `npm run ipc:sync` (Regenerates `ipc-manifest.json` and `generated-electron-api.d.ts`).
- **Auto-Discovery:** Handlers in `src/main/ipc/` are automatically registered by `src/main/ipc/index.ts`.

### 2. Database (TypeORM)
- **Entities:** Define new entities in `src/main/database/entities/`.
- **Initialization:** Handled by `src/main/database/data-source.ts`.
- **Seeding:** Initial data is populated via `src/main/database/seed.ts`.
- **Development DB:** Uses `dev.sqlite` in the project root during development.

### 3. Running & Building
- **Development:** `npm start` (Runs IPC sync then starts Electron Forge).
- **Packaging:** `npm run package` (Packages the app for the current platform).
- **Building:** `npm run make` (Creates distributables like `.exe`, `.deb`, etc.).
- **Linting & Formatting:** `npm run lint` and `npm run format`.

---

## Coding Conventions & Style
- **IPC Handlers:** Always export a default function from `<module>/<name>.ipc.ts`.
- **Type Safety:** Ensure all IPC handlers have explicit parameter and return types to ensure the generated `window.electron` API is accurate.
- **Styling:** Use Tailwind CSS for most styling; use Ant Design for complex UI components.
- **Logging:** Use the custom logger in `src/main/utils/logger.ts` for main process logging.
- **Icons:** Use `npm run gen:logo` to regenerate app icons from `src/renderer/assets/logo.png`.

## Important Artifacts
- `src/shared/ipc-manifest.json`: JSON map of all registered IPC channels.
- `src/types/generated-electron-api.d.ts`: TypeScript definitions for `window.electron`.
- `dev.sqlite`: Local development database (git-ignored).
