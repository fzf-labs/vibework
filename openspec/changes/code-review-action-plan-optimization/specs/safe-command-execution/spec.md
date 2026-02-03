## ADDED Requirements

### Requirement: Argument-based command execution
The system SHALL execute external commands using argument arrays (e.g., `execFile` or `spawn` with args) and SHALL NOT build shell command strings from untrusted input. `shell: true` SHALL be disabled by default.

#### Scenario: Service command invocation
- **WHEN** a main-process service runs a command with user-provided parameters
- **THEN** the command uses an args array with `shell: false` and no string concatenation

### Requirement: Command allowlist enforcement
The system SHALL allow command execution only for a configured allowlist of binaries, and SHALL reject any non-allowlisted command with an error and audit log entry.

#### Scenario: Disallowed command
- **WHEN** a request attempts to execute a binary that is not in the allowlist
- **THEN** the command is rejected and the attempt is logged

### Requirement: Command timeout handling
The system SHALL enforce a configurable timeout for command execution and SHALL terminate the process when the timeout is exceeded.

#### Scenario: Timeout exceeded
- **WHEN** a command runs longer than the configured timeout
- **THEN** the process is terminated and a timeout error is returned
