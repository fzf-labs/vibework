## ADDED Requirements

### Requirement: Legacy schema detection is non-destructive
The system SHALL detect legacy database schemas without deleting or modifying the existing database file.

#### Scenario: Legacy schema detected
- **WHEN** the app probes an existing database and identifies a legacy schema
- **THEN** the database remains unchanged and a migration decision is required

### Requirement: Backup is created before destructive actions
Before any destructive reset or migration, the system SHALL create a timestamped backup of the existing database and WAL/SHM files.

#### Scenario: Migration begins
- **WHEN** the system is about to apply a destructive migration or reset
- **THEN** a backup copy of the database and related files is created

### Requirement: Migration failure is recoverable
If a migration or reset fails, the system SHALL restore from the latest backup and surface an error to the user.

#### Scenario: Migration fails
- **WHEN** a migration attempt fails
- **THEN** the system restores the backup and reports the failure

### Requirement: Destructive reset requires confirmation
The system SHALL require explicit user confirmation before deleting or resetting a legacy database.

#### Scenario: User declines reset
- **WHEN** the user declines a destructive reset prompt
- **THEN** the database remains unchanged and the app reports the cancellation
