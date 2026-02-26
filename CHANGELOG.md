# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-26

### Added
- AI-powered translation with support for multiple providers (OpenAI, DeepSeek, custom endpoints)
- Global hotkey to toggle the floating translation window (default: Ctrl+Alt+T)
- System tray integration with show/hide functionality
- Auto-start on boot option
- Run in background option (hide to tray on close)
- Theme customization with background color and opacity settings
- AI provider configuration with test playground
- System prompt customization for translation behavior
- Thinking/reasoning process visualization for supported models (e.g., DeepSeek R1)
- Auto-update functionality with update dialog
- SQLite database for persistent configuration storage
- Internationalization support (English and Chinese)
- Welcome screen for first-time users

### Changed
- Migrated from webpack to electron-vite for improved build performance
- Refactored IPC communication with type-safe handlers
- Improved path imports using `@/` alias for cleaner codebase
- Enhanced update feedback and UX with progress indicators

### Fixed
- SQLite3 compatibility issues in production builds
- Window positioning and focus behavior
- Hotkey registration and persistence

---

## Release Notes Format

Each release includes the following information:
- **Version**: Semantic version number
- **Release Date**: ISO 8601 date format (YYYY-MM-DD)
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features to be removed in future releases
- **Removed**: Features removed in this release
- **Fixed**: Bug fixes
- **Security**: Security-related changes