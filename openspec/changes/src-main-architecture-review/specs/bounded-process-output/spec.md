## ADDED Requirements

### Requirement: Output retention is bounded
The system SHALL cap retained CLI and pipeline output to a configured maximum (bytes and/or lines) and evict oldest entries when exceeded.

#### Scenario: Output exceeds configured maximum
- **WHEN** accumulated output exceeds the configured maximum
- **THEN** the oldest output is evicted and the retained buffer stays within limits

### Requirement: Truncation is observable
The system SHALL indicate whether output has been truncated and expose the latest retained output segment.

#### Scenario: Renderer requests output after truncation
- **WHEN** the renderer requests output for a session with evicted entries
- **THEN** the response includes the latest retained output and a truncation indicator

### Requirement: Optional disk spool for long sessions
The system SHALL support an optional disk-backed spool with rotation limits for long-running sessions.

#### Scenario: Disk spool enabled
- **WHEN** disk spool is enabled and output grows beyond memory bounds
- **THEN** output is persisted to disk and rotated according to configured limits
