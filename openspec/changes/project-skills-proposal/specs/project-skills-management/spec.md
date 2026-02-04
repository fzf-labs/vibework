## ADDED Requirements

### Requirement: Project skills page is scoped to the active project
The system SHALL present project-level skills management for the active project and SHALL show an empty state when no project is selected.

#### Scenario: No project selected
- **WHEN** a user opens the Skills page without an active project
- **THEN** the page shows a no-project empty state and disables project actions

#### Scenario: Project selected
- **WHEN** a user selects a project
- **THEN** the page shows the project name/path and enables project skills actions

### Requirement: Project skills are discovered from project directories
The system SHALL discover project skills by scanning enabled project skill directories under the project root and SHALL parse `SKILL.md` (or `skill.md`) frontmatter for name and description.

#### Scenario: Skill metadata loaded
- **WHEN** a project directory contains a skill folder with a valid `SKILL.md`
- **THEN** the skills list includes the declared name and description for that skill

### Requirement: Project skills settings persist per project
The system SHALL persist per-project skills settings (enabled sources and path overrides) and SHALL restore them when the project is reopened.

#### Scenario: Settings restored
- **WHEN** a user updates project skills settings and restarts the app
- **THEN** the project loads with the same skills settings applied

### Requirement: Project skills can be imported from GitHub
The system SHALL allow importing a skill from a GitHub repository into the project skills directory and SHALL refresh the list after import.

#### Scenario: Import success
- **WHEN** a user imports a valid GitHub skill repository
- **THEN** the skill is written under the project skills directory and appears in the list

### Requirement: Project skills are included in agent execution
The system SHALL include enabled project skill directories in the skills configuration for tasks associated with a project, with higher precedence than global skills.

#### Scenario: Project task execution
- **WHEN** a task with a project ID is executed
- **THEN** the skills configuration includes project skill paths ahead of global paths

#### Scenario: Project skills disabled
- **WHEN** project skills are disabled for a project
- **THEN** the skills configuration excludes project skill paths
