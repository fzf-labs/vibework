## ADDED Requirements

### Requirement: Asynchronous batched log writes
The system SHALL buffer log messages and write them asynchronously in batches to avoid blocking the main thread.

#### Scenario: High-frequency logging
- **WHEN** many log messages are produced in a short time window
- **THEN** writes are batched and performed asynchronously

### Requirement: Log rotation with size limits
The system SHALL rotate log files when they exceed a configured size limit and SHALL retain only a configured number of rotated files.

#### Scenario: Log file exceeds limit
- **WHEN** a log file grows beyond the configured size limit
- **THEN** a new log file is created and old logs are rotated according to retention settings

### Requirement: Configurable logging limits
The system SHALL load log batching and rotation limits from configuration and apply them when the logging service initializes.

#### Scenario: Configuration applied
- **WHEN** the logging service starts
- **THEN** it uses the configured batch and rotation settings
