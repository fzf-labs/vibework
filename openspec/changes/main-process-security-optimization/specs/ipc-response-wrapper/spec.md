## ADDED Requirements

### Requirement: IPC handlers SHALL return unified response format
The system SHALL wrap all IPC handler responses in a unified format: `{ success: boolean, data?: T, error?: string }`.

#### Scenario: Successful IPC response
- **WHEN** an IPC handler completes successfully
- **THEN** it returns `{ success: true, data: <result> }`

#### Scenario: Failed IPC response
- **WHEN** an IPC handler throws an error
- **THEN** it returns `{ success: false, error: <error message> }`

### Requirement: IPC handlers SHALL use wrapHandler utility
The system SHALL provide a `wrapHandler` utility function that automatically catches errors and formats responses.

#### Scenario: Handler wrapping
- **WHEN** an IPC handler is registered
- **THEN** it is wrapped with wrapHandler to ensure consistent error handling
