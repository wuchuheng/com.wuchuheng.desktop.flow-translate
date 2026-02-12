# Specification: Settings & Configuration Feature

## 1. Overview
This feature transforms the Main Window into a **Settings Dashboard**. It uses a "Thick Client" approach where the Renderer (UI) handles API interactions for testing, while the Main Process focuses on persistence.

## 2. Cleanup Tasks
- **Delete:** `src/renderer/pages/Home/`, `src/renderer/pages/About/`.
- **Route:** Default `/settings`.

## 3. Data Architecture (Database)
Entity: `Config`
*   **Path:** `src/main/database/entities/config.entity.ts`
*   **Schema:** `key` (PK, string), `value` (JSON).

### Configuration Keys (Logical Separation)
1.  `ai_config`: `{ providerId, apiKey, model, enableThinking, systemPrompt, ... }`
2.  `app_hotkeys`: `{ toggleWindow: "..." }`
3.  `theme_config`: 
    ```json
    {
      "mode": "system", // 'light', 'dark', 'system'
      "backgroundColor": "#ffffff", // or #1e1e2e
      "opacity": 0.8,
      "blurStrength": "backdrop-blur-2xl" 
    }
    ```

## 4. Backend (Main Process)
- **Services**: `ConfigService`, `HotkeyService`, `TranslationService`.
- **IPC**: `config:save`, `config:get`.

## 5. Frontend (Renderer) - SettingsPage

### 5.1 Architecture
*   **Library**: Import `openai` directly.
*   **State**: Local state for forms, synced with DB.

### 5.2 Tab 1: AI Settings (Two-Column)
*   **Left (Config)**: Provider, API Key, Model (Auto-fetch), Thinking Toggle, Prompt.
*   **Right (Playground)**: Chat interface with "Reasoning" display.

### 5.3 Tab 2: Theme & Appearance (Two-Column)
*   **Left (Config)**: 
    *   **Theme Mode**: Radio Group [System, Light, Dark].
    *   **Background Color**: Color Picker.
    *   **Transparency**: Slider (0.1 - 1.0).
*   **Right (Preview)**: 
    *   Renders a **Live Mock** of the `FlowTranslate` component.
    *   Applies the settings in real-time so user can see the glass effect/colors.

### 5.4 Tab 3: General / Hotkeys
*   **Hotkey Recorder**: Capture global shortcuts.

## 6. Implementation Steps
1.  **Dependencies**: Install `openai`.
2.  **Cleanup**: Delete old files.
3.  **DB**: Create `Config` entity.
4.  **IPC**: Implement `config` handlers.
5.  **Frontend**:
    *   Build `SettingsPage` with 3 Tabs.
    *   Implement AI Playground.
    *   Implement Theme Previewer.
6.  **Migration**: Connect translation logic to DB.
