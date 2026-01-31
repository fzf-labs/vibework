## ADDED Requirements

### Requirement: Sound alert settings are configurable in global settings
The system SHALL provide a "提示音" tab in global settings with separate toggles to enable or disable task completion sounds and task node completion sounds, and SHALL persist the settings across sessions.

#### Scenario: User enables task completion sounds
- **WHEN** the user turns on the task completion sound toggle in the "提示音" tab
- **THEN** the system saves the setting as enabled

#### Scenario: User disables task completion sounds
- **WHEN** the user turns off the task completion sound toggle in the "提示音" tab
- **THEN** the system saves the setting as disabled

#### Scenario: User enables task node completion sounds
- **WHEN** the user turns on the task node completion sound toggle in the "提示音" tab
- **THEN** the system saves the setting as enabled

#### Scenario: User disables task node completion sounds
- **WHEN** the user turns off the task node completion sound toggle in the "提示音" tab
- **THEN** the system saves the setting as disabled

### Requirement: Sound presets or custom files are configurable per completion type
The system SHALL allow users to choose a default sound preset or a custom audio file for task completion and for task node completion in the "提示音" tab, and SHALL persist those selections.

#### Scenario: User selects task completion preset
- **WHEN** the user selects a task completion sound preset
- **THEN** the system saves the preset selection

#### Scenario: User selects task completion custom file
- **WHEN** the user selects a custom audio file for task completion
- **THEN** the system saves the file selection

#### Scenario: User selects work node completion preset
- **WHEN** the user selects a task node completion sound preset
- **THEN** the system saves the preset selection

#### Scenario: User selects work node completion custom file
- **WHEN** the user selects a custom audio file for task node completion
- **THEN** the system saves the file selection

### Requirement: Sound plays on task completion when enabled
The system SHALL play the selected task completion sound (preset or custom file) when a task finishes successfully if sound alerts are enabled.

#### Scenario: Task completes with sound alerts enabled
- **WHEN** a task completes and sound alerts are enabled
- **THEN** the system plays the selected task completion sound

#### Scenario: Task completes with sound alerts disabled
- **WHEN** a task completes and sound alerts are disabled
- **THEN** the system does not play any completion sound

### Requirement: Sound plays on task node completion when enabled
The system SHALL play the selected task node completion sound (preset or custom file) when a task node finishes successfully if sound alerts are enabled.

#### Scenario: Task node completes with sound alerts enabled
- **WHEN** a task node completes and sound alerts are enabled
- **THEN** the system plays the selected task node completion sound

#### Scenario: Task node completes with sound alerts disabled
- **WHEN** a task node completes and sound alerts are disabled
- **THEN** the system does not play any completion sound
