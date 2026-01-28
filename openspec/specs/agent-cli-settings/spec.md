# agent-cli-settings Specification

## Purpose
TBD - created by archiving change update-agent-cli-settings. Update Purpose after archive.
## Requirements
### Requirement: Agent CLI settings label
The system SHALL label the Settings category as "Agent CLI".

#### Scenario: User opens settings sidebar
- **WHEN** the user views the Settings category list
- **THEN** the CLI category label reads "Agent CLI"

### Requirement: Agent CLI tools list
The system SHALL display a list-form view of supported Agent CLI tools with install status, version, and install path.

#### Scenario: User opens Agent CLI settings
- **WHEN** the user opens the Agent CLI settings tab
- **THEN** the page lists Claude Code, Codex, Gemini CLI, OpenCode, and Cursor Agent
- **AND** each tool shows whether it is installed
- **AND** each tool shows its detected version
- **AND** each tool shows its resolved install path

### Requirement: Agent CLI tool detection
The system SHALL detect tool installation status, version, and install path by invoking each tool's version command from the main process and resolving the executable location.

#### Scenario: Tool is installed
- **WHEN** the tool's detection command succeeds
- **THEN** the tool status is shown as installed
- **AND** the tool version is populated from the command output
- **AND** the tool install path is populated from the resolved executable location

#### Scenario: Tool is not installed
- **WHEN** the tool's detection command fails
- **THEN** the tool status is shown as not installed
- **AND** the tool version is empty
- **AND** the tool install path is empty

