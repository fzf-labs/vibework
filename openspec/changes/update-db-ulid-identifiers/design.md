## Context
The app uses SQLite via better-sqlite3. Current primary IDs are a mix of formats: ULID not used, projects use UUID, sessions/tasks use ad-hoc strings, and messages/files use autoincrement integers. Foreign keys reference these mixed IDs, which makes the schema inconsistent and brittle.

## Goals / Non-Goals
- Goals:
  - Adopt a single canonical identifier format (ULID) for all persisted entities.
  - Preserve all existing data while migrating IDs and foreign keys.
  - Keep the migration deterministic, idempotent, and safe to run once per database.
- Non-Goals:
  - Changing non-ID columns or business logic.
  - Redesigning table structures beyond what is required for ID normalization.

## Decisions
- **Canonical format:** ULID, stored as uppercase 26-char Crockford Base32 strings with no separators.
- **Scope:** All primary keys (projects, sessions, tasks, messages, files) and all foreign keys referencing them must use ULID.
- **Generation:** Use a shared ULID generator in the codebase to avoid mixed formats and reduce duplication.

## Alternatives Considered
- UUID v4 everywhere: simple but loses lexicographic time ordering and is harder to scan.
- Keep mixed formats and only document them: does not solve the consistency and migration pain.

## Risks / Trade-offs
- **Breaking migration:** Any tooling that relies on old IDs will break unless updated. Mitigation: document changes and provide a clear migration path.
- **Migration errors:** Incorrect mapping could break foreign keys. Mitigation: migrate within a single transaction and validate referential integrity.

## Migration Plan
1. Open a transaction and create mapping tables for legacy IDs (projects/sessions/tasks/messages/files).
2. Create new tables with ULID primary keys and ULID foreign keys.
3. Insert rows into new tables, generating ULIDs and storing old->new mappings.
4. Rehydrate foreign keys using the mapping tables.
5. Validate row counts and basic referential integrity.
6. Drop old tables and rename new tables to the canonical names.

## Open Questions
- None. Legacy IDs will not be retained after migration to keep the schema minimal.
