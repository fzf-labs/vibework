## ADDED Requirements

### Requirement: Commands SHALL use execFile with argument arrays
The system SHALL execute external commands using `execFile()` or `spawn()` with argument arrays instead of `exec()` with string concatenation.

#### Scenario: Git clone command execution
- **WHEN** GitService executes a clone command with user-provided URL and path
- **THEN** the command is executed via `execFile('git', ['clone', url, path])` without shell interpolation

#### Scenario: Git status command execution
- **WHEN** GitService executes a status command for a repository path
- **THEN** the command is executed via `execFile('git', ['-C', path, 'status'])` without shell interpolation

### Requirement: Shell mode SHALL be disabled by default
The system SHALL NOT use `shell: true` option in spawn/exec calls unless explicitly required for shell features.

#### Scenario: Spawn without shell
- **WHEN** a service spawns a child process
- **THEN** the spawn options do not include `shell: true` unless documented as necessary

### Requirement: Command execution SHALL have timeout control
The system SHALL enforce a configurable timeout on all command executions to prevent hanging processes.

#### Scenario: Command timeout
- **WHEN** a command execution exceeds the configured timeout (default 30 seconds)
- **THEN** the process is terminated with SIGTERM, followed by SIGKILL after 5 seconds if still running

### Requirement: Executable commands SHALL be whitelisted
The system SHALL maintain a whitelist of allowed executable commands and reject execution of unlisted commands.

#### Scenario: Whitelisted command execution
- **WHEN** a service attempts to execute a whitelisted command (e.g., 'git', 'npm', 'node')
- **THEN** the command is executed normally

#### Scenario: Non-whitelisted command rejection
- **WHEN** a service attempts to execute a non-whitelisted command
- **THEN** the execution is rejected with an error
