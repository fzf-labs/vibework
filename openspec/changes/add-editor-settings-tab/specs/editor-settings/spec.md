## ADDED Requirements
### Requirement: Editor settings tab
The system SHALL provide an "Editor" settings tab that allows the user to select a default editor from detected editors and optionally provide a custom editor command.

#### Scenario: User selects a detected editor
- **WHEN** the user selects a detected editor and saves settings
- **THEN** the selection is persisted and shown on the next open

#### Scenario: User selects a custom command
- **WHEN** the user selects "Custom" and enters an editor command then saves settings
- **THEN** the custom command is persisted and shown on the next open

### Requirement: Open in editor uses configured command
The system SHALL use the configured editor command when the user triggers an "Open in Editor" action.

#### Scenario: Open in editor uses selected editor
- **WHEN** the user triggers an open-in-editor action
- **THEN** the application launches the configured editor command with the target path
