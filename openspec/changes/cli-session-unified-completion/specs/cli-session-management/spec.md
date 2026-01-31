## ADDED Requirements

### Requirement: Unified CLI session lifecycle
The system SHALL manage CLI sessions through a single session service regardless of CLI provider.

#### Scenario: Start session
- **WHEN** a task starts a CLI session for any supported tool
- **THEN** the system creates a session with status "running" and begins capturing output

#### Scenario: Stop session
- **WHEN** a CLI session is stopped
- **THEN** the system transitions the session status to "stopped" or "error" and finalizes log capture

### Requirement: Enforce structured output modes
The system SHALL launch each CLI tool in a structured output mode suitable for machine parsing.

#### Scenario: Apply CLI output flags
- **WHEN** a session starts for a specific CLI provider
- **THEN** the system applies the provider’s required JSON/structured-output arguments or protocol mode

### Requirement: Completion detection from structured output
The system SHALL detect completion from structured output and finalize the session promptly.

#### Scenario: Successful completion signal
- **WHEN** the session output includes a provider-specific completion signal
- **THEN** the system marks the session as "stopped" and terminates the process gracefully

#### Scenario: Failure completion signal
- **WHEN** the session output includes a provider-specific failure signal
- **THEN** the system marks the session as "error" and terminates the process

#### Scenario: No completion signal
- **WHEN** a session ends without a structured completion signal
- **THEN** the system derives the final status from the process exit code

### Requirement: Unified log streaming
The system SHALL provide a single log streaming interface for all CLI sessions.

#### Scenario: Subscribe to logs
- **WHEN** the UI subscribes to a session’s logs
- **THEN** the system streams historical and live logs for that session regardless of CLI provider

### Requirement: Status events for UI updates
The system SHALL emit session status events for UI and workflow updates.

#### Scenario: Emit status change
- **WHEN** a session transitions between running/stopped/error
- **THEN** the system emits a status event with the session id and final state
