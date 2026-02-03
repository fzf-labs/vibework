## ADDED Requirements

### Requirement: Sandbox and context isolation SHALL be enabled
The system SHALL enable `sandbox: true` and `contextIsolation: true` in webPreferences for all BrowserWindow instances.

#### Scenario: Window creation with sandbox
- **WHEN** a new BrowserWindow is created
- **THEN** webPreferences includes `sandbox: true` and `contextIsolation: true`

### Requirement: File operations SHALL use path whitelist
The system SHALL validate all file operation paths against a whitelist before execution, allowing only workspace directories and user-selected directories.

#### Scenario: File read within workspace
- **WHEN** renderer requests to read a file within the workspace directory
- **THEN** the operation is allowed

#### Scenario: File read outside whitelist
- **WHEN** renderer requests to read a file outside whitelisted directories
- **THEN** the operation is rejected with an error

### Requirement: Path validation SHALL use realpath
The system SHALL resolve paths using `realpath` before whitelist validation to prevent path traversal attacks.

#### Scenario: Path traversal attempt blocked
- **WHEN** renderer requests file access with path containing `../`
- **THEN** the resolved realpath is validated against whitelist

### Requirement: URL opening SHALL use protocol whitelist
The system SHALL only allow opening URLs with `http://` or `https://` protocols via shell:openUrl IPC.

#### Scenario: HTTPS URL opening
- **WHEN** renderer requests to open an HTTPS URL
- **THEN** the URL is opened in the default browser

#### Scenario: File protocol blocked
- **WHEN** renderer requests to open a `file://` URL
- **THEN** the operation is rejected with an error

### Requirement: Destructive operations SHALL require confirmation
The system SHALL require user confirmation for file deletion and overwrite operations.

#### Scenario: File deletion confirmation
- **WHEN** renderer requests to delete a file
- **THEN** a confirmation dialog is shown before deletion
