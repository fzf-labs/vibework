# skills-settings Specification

## Purpose
TBD - created by archiving change update-skills-settings. Update Purpose after archive.
## Requirements
### Requirement: App-managed skills directory
The system SHALL treat `~/.vibework/skills` as the storage location for app-managed skills shown in Settings.

#### Scenario: Load app-managed skills
- **WHEN** the Skills settings screen loads
- **THEN** it lists skills discovered under `~/.vibework/skills` as app-managed skills

### Requirement: Skills always enabled
The system SHALL always provide skills configuration to agent sessions without a user-controlled enable toggle in Settings.

#### Scenario: Start agent with skills
- **WHEN** a session starts from the app
- **THEN** skills configuration is included and no global Skills enable switch is shown in Settings

### Requirement: CLI global skills lists
The system SHALL display per-CLI global skills lists for supported CLI runtimes, showing each skill's name and description.

#### Scenario: Show CLI global skills
- **WHEN** the Skills settings screen renders the global skills section
- **THEN** it shows each CLI's skills with name and description, or an empty state when none are found

