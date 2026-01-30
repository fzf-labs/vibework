## ADDED Requirements

### Requirement: Sound alert settings are configurable in global settings
The system SHALL provide a "提示音" tab in global settings with a toggle to enable or disable sound alerts for task completion, and SHALL persist the setting across sessions.

#### Scenario: User enables sound alerts
- **WHEN** the user turns on the sound alert toggle in the "提示音" tab
- **THEN** the system saves the setting as enabled

#### Scenario: User disables sound alerts
- **WHEN** the user turns off the sound alert toggle in the "提示音" tab
- **THEN** the system saves the setting as disabled

### Requirement: Sound plays on task completion when enabled
The system SHALL play a predefined completion sound when a task finishes successfully if sound alerts are enabled.

#### Scenario: Task completes with sound alerts enabled
- **WHEN** a task completes and sound alerts are enabled
- **THEN** the system plays the completion sound

#### Scenario: Task completes with sound alerts disabled
- **WHEN** a task completes and sound alerts are disabled
- **THEN** the system does not play any completion sound
