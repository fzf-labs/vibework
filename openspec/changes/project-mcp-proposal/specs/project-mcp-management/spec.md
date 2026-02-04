## ADDED Requirements

### Requirement: Project MCP page is scoped to the active project
The system SHALL present project-level MCP detection for the active project and SHALL show a no-project empty state when no project is selected.

#### Scenario: No project selected
- **WHEN** a user opens the MCP page without an active project
- **THEN** the page shows a no-project empty state

#### Scenario: Project selected
- **WHEN** a user selects a project
- **THEN** the page shows the project name and CLI MCP status cards

### Requirement: Project MCP is displayed per CLI with global + project sources
The system SHALL display MCP status per Agent CLI, showing both global MCP and project MCP sources.

#### Scenario: CLI global + project status
- **WHEN** a CLI has a global config and/or a project config
- **THEN** the MCP page shows both sections with configured/missing status and server counts

### Requirement: Project MCP config path is per CLI
The system SHALL resolve the project MCP configuration file at `<project>/.vibework/mcp/<cliId>.json`.

#### Scenario: Project config exists
- **WHEN** the per-CLI project MCP config file exists
- **THEN** the project section lists servers from that file

#### Scenario: Project config missing
- **WHEN** the per-CLI project MCP config file does not exist
- **THEN** the project section shows “not configured” with zero servers

### Requirement: Server details are visible on the project MCP page
The system SHALL list the MCP server name and transport type (stdio/http/sse) for each source section.

#### Scenario: No servers
- **WHEN** a source has no MCP servers
- **THEN** the page shows an empty-state message for that source

### Requirement: MCP server detail view is available
The system SHALL allow users to click a MCP server to view its configuration details.

#### Scenario: View server details
- **WHEN** a user clicks a MCP server card
- **THEN** the page shows a detail view with the server transport type and connection fields (command/args/env or url/headers)

### Requirement: Agent execution includes project MCP configuration
The system SHALL include project MCP configuration in the `mcpConfig` used for agent execution when a task is associated with a project.

#### Scenario: Project task execution
- **WHEN** a task with a project ID is executed
- **THEN** the `mcpConfig` includes the per-CLI project config path and merge strategy with higher priority than global

#### Scenario: No project context
- **WHEN** a task is executed without a project ID
- **THEN** the `mcpConfig` excludes project MCP configuration

### Requirement: Global settings can sync installed MCP to CLI configs
The system SHALL provide a multi-select action in global MCP settings to write installed MCP servers into selected CLI JSON configs.

#### Scenario: Sync to multiple CLIs
- **WHEN** a user selects multiple CLI configs and confirms sync
- **THEN** the system writes `mcpServers` into each selected CLI JSON config file
