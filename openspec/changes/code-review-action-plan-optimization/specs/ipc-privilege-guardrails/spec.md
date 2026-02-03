## ADDED Requirements

### Requirement: Renderer isolation defaults
The system SHALL create BrowserWindow instances with `sandbox: true` and `contextIsolation: true`, and SHALL keep `nodeIntegration` disabled.

#### Scenario: Window creation
- **WHEN** a main window is created
- **THEN** sandboxing and context isolation are enabled and node integration is disabled

### Requirement: Filesystem IPC allowlist
The system SHALL permit filesystem IPC operations only within allowlisted root paths, validated using `realpath` to prevent traversal.

#### Scenario: Out-of-scope path
- **WHEN** an IPC request targets a path outside the allowlisted roots
- **THEN** the request is rejected with a validation error

### Requirement: URL protocol restrictions
The system SHALL allow `shell:openUrl` only for `http` and `https` URLs and SHALL reject other protocols.

#### Scenario: Disallowed protocol
- **WHEN** an IPC request attempts to open a `file://` URL
- **THEN** the request is rejected and no external open occurs

### Requirement: Destructive operation confirmation
The system SHALL require explicit user confirmation for destructive file operations and SHALL record an audit entry for approved actions.

#### Scenario: Delete request
- **WHEN** a delete operation is requested via IPC
- **THEN** user confirmation is required and the action is logged upon approval
