## Context
The app currently persists tool-extracted file artifacts in a `files` table and stores message attachments on disk under the session directory. These capabilities are no longer desired.

## Goals / Non-Goals
- Goals:
  - Remove the files table and all file library UI/IPC logic.
  - Stop persisting attachments to disk or database.
  - Ensure migrations are safe and idempotent.
- Non-Goals:
  - Redesign task or message schemas beyond removing attachment persistence.
  - Change unrelated task/message rendering.

## Decisions
- Drop the `files` table and related indices.
- Remove attachment persistence from disk and database (no attachment storage fields).
- Keep any in-memory attachment handling only for immediate request execution (no persistence).

## Risks / Trade-offs
- Users lose access to previously stored file artifacts and attachments.
- Any UI relying on file library data must be removed or replaced.

## Migration Plan
1. Run a schema migration to drop `files` and related indexes.
2. Remove attachment storage columns (or stop writing and set to NULL if column removal is deferred).
3. Clean up IPC endpoints and adapter methods.
4. Remove UI components for file library and task file panels.

## Open Questions
- None. Scope confirmed: remove file library and attachment persistence.
