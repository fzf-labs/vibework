# Change: Update data settings to back up ~/.vibework as zip

## Why
The current data export/import/clear flow operates on JSON snapshots and partial database data, but the desired behavior is to back up and restore the user data directory directly.

## What Changes
- Export compresses the user data directory (`~/.vibework`) into a zip file (default name: `vibework-backup-YYYY-MM-DD.zip`).
- Import accepts a zip file, prompts for confirmation, creates a backup of the existing `~/.vibework`, then restores from the zip.
- Delete removes the `~/.vibework` directory.

## Impact
- Affected specs: data-backup (new capability)
- Affected code: `src/renderer/src/components/settings/tabs/DataSettings.tsx`, filesystem/path helpers, and any UI copy for data settings
