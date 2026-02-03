## ADDED Requirements

### Requirement: IPC input validation
The system SHALL validate all IPC handler inputs using schema validation or type guards and SHALL reject invalid inputs without side effects.

#### Scenario: Invalid enum value
- **WHEN** an IPC request provides an invalid status value
- **THEN** the handler responds with an error and the update is not applied

### Requirement: Standard IPC response envelope
The system SHALL return IPC responses in a consistent envelope of `{ success, data?, error? }` for all handlers.

#### Scenario: Handler error
- **WHEN** an IPC handler throws an error
- **THEN** the response includes `success: false` and a non-empty `error` string
