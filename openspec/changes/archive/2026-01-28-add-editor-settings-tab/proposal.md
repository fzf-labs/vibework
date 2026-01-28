# Change: Add editor settings tab

## Why
Users need to control which local editor command VibeWork uses when opening files/projects, instead of relying on defaults.

## What Changes
- Add a new Settings tab "Editor" with minimal editor configuration (default editor selection and optional custom command).
- Persist editor configuration in app settings.
- Use the configured editor command when "Open in Editor" actions are invoked.

## Impact
- Affected specs: editor-settings (new capability)
- Affected code: settings modal/tabs, settings types/defaults/storage, open-in-editor action in renderer, editor IPC usage
