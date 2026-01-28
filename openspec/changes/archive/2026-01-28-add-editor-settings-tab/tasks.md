## 1. Implementation
- [x] 1.1 Add editor settings fields to Settings type, defaults, and load/save paths; include migration for existing settings.
- [x] 1.2 Add an Editor settings tab component and wire it into SettingsModal navigation and icons.
- [x] 1.3 Add i18n strings for the new tab and its fields (en/zh).
- [x] 1.4 Use editor settings when opening files/projects in the UI (prefer `window.api.editor.openProject` with configured command; fall back when unavailable).
- [ ] 1.5 Validation: open Settings > Editor, save selection, reopen to confirm persistence, and verify "Open in Editor" launches the configured editor.
