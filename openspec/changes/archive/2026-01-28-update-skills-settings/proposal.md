# Change: Update Skills Settings

## Why
Skills in Settings currently mix app-managed and CLI global skills, store app-added skills under a different directory, and allow a global enable switch that conflicts with CLI-controlled behavior. We need app-managed skills under `~/.vibework/skills`, always enabled from the app perspective, and a clear view of global skills per CLI.

## What Changes
- Store and list app-managed skills from `~/.vibework/skills`.
- Remove the global Skills enable toggle; skills are always enabled in app configuration.
- Add read-only lists of global skills per supported CLI, showing name and description.

## Impact
- Affected specs: skills-settings (new)
- Affected code: skills settings UI, settings model/config, skills config plumbing, files API that enumerates skills directories
