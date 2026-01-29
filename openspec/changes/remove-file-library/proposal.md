# Change: Remove file library storage and attachments persistence

## Why
The current database includes a files table and attachment persistence logic that we no longer want to support. Removing these reduces complexity and eliminates inconsistent storage behavior.

## What Changes
- Remove the `files` table and all file library functionality (creation, listing, favorites, deletion, UI presentation).
- Stop persisting attachments to disk and in the database.
- Remove related IPC endpoints, data adapters, and UI components.
- Add a migration to drop the `files` table and attachment storage fields.

## Impact
- Affected specs: artifact-storage (new)
- Affected code: database schema/migrations, attachment utilities, file extraction pipeline, library/task detail UI, IPC/database API typing
- **BREAKING**: Existing file library data and persisted attachments will be removed and no longer available.
