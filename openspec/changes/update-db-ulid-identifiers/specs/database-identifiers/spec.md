## ADDED Requirements

### Requirement: Canonical ULID Format
All persisted identifiers SHALL be ULIDs stored as 26-character uppercase Crockford Base32 strings without separators.

#### Scenario: New record ID creation
- **WHEN** a new project, session, task, message, or file record is created
- **THEN** the record identifier is a ULID string in canonical format

### Requirement: Unified Primary and Foreign Keys
All primary keys and foreign keys across the database tables SHALL use ULID TEXT values.

#### Scenario: Message references task
- **WHEN** a message is stored for a task
- **THEN** `messages.id` is a ULID and `messages.task_id` matches the ULID of the referenced task

### Requirement: Legacy ID Migration
The system SHALL migrate existing databases to ULID identifiers while preserving all records and relationships.

#### Scenario: Existing database migration
- **WHEN** a database containing legacy IDs is opened after the migration is introduced
- **THEN** all rows remain present and foreign-key relationships remain intact under the new ULID identifiers
