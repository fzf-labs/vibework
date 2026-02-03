## ADDED Requirements

### Requirement: IPC channels are centrally defined
The system SHALL define IPC channel names and payload schemas in a single shared registry module.

#### Scenario: Registering a handler
- **WHEN** main process registers an IPC handler
- **THEN** it uses the channel name from the registry

### Requirement: Renderer uses the same registry
The renderer SHALL import channel names and payload types from the same registry module.

#### Scenario: Invoking an IPC call
- **WHEN** the renderer invokes an IPC channel
- **THEN** it uses the registry-defined channel name and payload type

### Requirement: Validation is tied to the registry
IPC request validation SHALL be derived from the registry definitions to prevent drift between main and renderer.

#### Scenario: Payload mismatch
- **WHEN** a request payload does not satisfy the registry schema
- **THEN** the handler responds with a validation error
