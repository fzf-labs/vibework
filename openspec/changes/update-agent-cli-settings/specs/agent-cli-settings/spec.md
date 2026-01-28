## ADDED Requirements
### Requirement: Agent CLI settings label
The system SHALL label the Settings category as "Agent CLI".

#### Scenario: User opens settings sidebar
- **WHEN** the user views the Settings category list
- **THEN** the CLI category label reads "Agent CLI"

### Requirement: Agent CLI tools list
The system SHALL display a list of supported Agent CLI tools with install status.

#### Scenario: User opens Agent CLI settings
- **WHEN** the user opens the Agent CLI settings tab
- **THEN** the page lists Claude Code, Codex, Gemini CLI, OpenCode, and Cursor Agent
- **AND** each tool shows whether it is installed

### Requirement: Agent CLI tool detection
The system SHALL detect tool installation status by invoking each tool's version command from the main process.

#### Scenario: Tool is installed
- **WHEN** the tool's detection command succeeds
- **THEN** the tool status is shown as installed

#### Scenario: Tool is not installed
- **WHEN** the tool's detection command fails
- **THEN** the tool status is shown as not installed
