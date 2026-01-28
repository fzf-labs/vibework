## Context
Data Settings currently export/import JSON snapshots and clear data via database operations. The requested behavior is to operate directly on the user data directory `~/.vibework` via zip export/import and deletion.

## Goals / Non-Goals
- Goals:
  - Export the entire `~/.vibework` directory to a zip file.
  - Import from a zip file after user confirmation and a backup step.
  - Delete the `~/.vibework` directory from the UI.
- Non-Goals:
  - Partial restores of tasks/messages/settings.
  - Schema migrations or data transformations beyond file restore.

## Decisions
- Use the resolved `~/.vibework` path from existing path APIs to avoid hard-coded OS logic.
- Reuse existing zip tooling already in the repo (jszip) to avoid new dependencies.
- Import flow backs up the existing directory before replacement after explicit confirmation.

## Risks / Trade-offs
- Large directories may take noticeable time to zip/unzip in the renderer; provide loading states and error handling.
- Zip-based restore replaces the entire directory; this is destructive by design.

## Migration Plan
- Replace Data Settings export/import/clear UI and logic in one update.
- No automatic migration of previous JSON exports.

## Open Questions
- Where should the pre-import backup be stored by default (e.g., a timestamped zip next to `~/.vibework`)?
