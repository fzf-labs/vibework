# Change: Standardize database IDs to ULID

## Why
The database currently stores IDs as TEXT without a single standard (nanoid, UUID, composed IDs, and autoincrement integers). This makes the schema inconsistent, hard to reason about, and brittle for migrations or integrations.

## What Changes
- Define a canonical ULID format for all primary identifiers.
- Replace integer autoincrement IDs (messages, files) with ULID TEXT IDs.
- Update ID generation across the app (projects, sessions, tasks, messages, files) to use ULIDs.
- Add a migration that rewrites existing records and updates all foreign keys.
- Update type definitions and documentation to reflect the new standard.

## Impact
- Affected specs: database-identifiers (new)
- Affected code: database schema/migrations, ID generation, IPC/database API typing, renderer data types
- **BREAKING**: Existing databases will be migrated; any external tooling that expects the old ID formats must be updated.
