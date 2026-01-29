## 1. Implementation
- [ ] 1.1 Add a shared ULID generator utility and dependency (if not already present).
- [ ] 1.2 Update database schema definitions to use ULID TEXT primary keys for all tables.
- [ ] 1.3 Implement a migration that rewrites existing IDs and updates all foreign keys.
- [ ] 1.4 Update ID generation at creation points (sessions, tasks, projects, messages, files).
- [ ] 1.5 Update TypeScript types and IPC interfaces to reflect ULID IDs (string) everywhere.
- [ ] 1.6 Add migration validation (row counts, FK checks) and document upgrade steps.

## 2. Validation
- [ ] 2.1 Run migration on a seeded database and verify data integrity.
- [ ] 2.2 Smoke-test app flows that create/read sessions, tasks, messages, and files.
