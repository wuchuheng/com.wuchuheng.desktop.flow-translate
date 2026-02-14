# Feature: Enhanced Update Feedback and UX

## Background
Currently, the application lacks sufficient feedback during the software update process. Users are not informed when an update is downloading, cannot see the download progress, and receive no prompt to restart the application once the update is ready. This leads to confusion about the application's state.

## Problem Statement
- **Lack of Visibility:** Users don't know if a download has started or its progress.
- **Missing Call-to-Action:** No prompt appears to install the update after it's downloaded.
- **Context Dependency:** Feedback is currently isolated to the `AboutTab`, meaning users miss updates if they navigate away.

## Goals
1.  **Global Feedback:** Provide update status notifications regardless of the user's current page.
2.  **Visual Progress:** Display a progress bar during the download phase.
3.  **Actionable Completion:** Present a clear dialog or notification prompting the user to restart and install the update.

## Technical Specification

### 1. New Hook: `useUpdateSystem`
Create a custom hook `src/renderer/hooks/useUpdateSystem.tsx` to manage the global update lifecycle.

**Responsibilities:**
- Subscribe to `window.electron.update.onStatusChange`.
- Manage `antd` notification instances.
- Handle the "Restart" action.

**Logic:**
- **On `update-available`**: Show a fleeting "Update Available" notification (optional, or auto-start download depending on config).
- **On `download-progress`**:
    - Open (or update) a persistent notification with a unique key (e.g., `'update-download'`).
    - Render an `<Progress />` component within the notification description.
- **On `update-downloaded`**:
    - Close the progress notification.
    - Display a **Modal** (or persistent notification with action buttons) asking: "New version is ready. Restart now?"
    - Actions: [Restart & Install] [Later].
- **On `update-error`**:
    - Show an error notification.

### 2. Integration in `MainLayout`
Mount the `useUpdateSystem` hook in `src/renderer/layout/MainLayout.tsx`.

- Ensure `notification.useNotification()` is used to access the context (theme, i18n).
- This ensures the listener is active as long as the app is running.

### 3. UI/UX Details
- **Progress Notification:**
    - Title: "Downloading Update..."
    - Content: `<Progress percent={percent} status="active" />`
    - Placement: Bottom Right (standard system notification area).
- **Completion Modal:**
    - Title: "Update Ready"
    - Content: 
        - Message: "Version X.Y.Z has been downloaded. Would you like to restart and install it now?"
        - **Release Notes:** If available, display the release notes in a scrollable area. If the notes are in markdown format, they should be rendered appropriately (using a simple styled div or a markdown component if available).
    - Primary Button: "Restart" (Triggers `window.electron.update.install()`).

### 4. Release Notes Handling
- The `UpdateInfo` object contains `releaseNotes`.
- **Markdown Rendering:** Use a markdown library (e.g., `react-markdown`) to render the `releaseNotes`. If a library is not yet present, it will be added to `package.json`.
- Styling: Use `prose` class from `@tailwindcss/typography` to ensure good readability for the logs.
- Visibility: Only show the section if `releaseNotes` is not empty.

## Refactoring Considerations
- **`AboutTab.tsx`**: Can remain as is. It acts as a manual control center. The global notifications will overlay on top, which confirms the action triggered from the tab.
- **Conflict Prevention**: Use a specific `key` for the progress notification to ensure we don't spawn multiple notifications if the user clicks "Check Update" multiple times.

## Production Build Fix
- **Issue**: `electron-updater` throws `ENOENT` looking for `app-update.yml` in packaged builds.
- **Solution**: 
    - Created `src/main/app-update.yml`.
    - Updated `webpack.main.config.ts` to copy this file to the build output.
    - This satisfies the library's initialization requirement even though `setFeedURL` is called in code.

## Plan Steps
1.  **Modify `MainLayout.tsx`**: specific `notification` context holder to the layout.
2.  **Create `useUpdateSystem.tsx`**: Implement the event listeners and UI logic.
3.  **Integrate**: call the hook in `MainLayout`.
4.  **Test**: Verify flows:
    - Auto-update trigger.
    - Manual update trigger from Settings.
    - Error handling.
