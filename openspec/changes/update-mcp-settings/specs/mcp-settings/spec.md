## ADDED Requirements

### Requirement: App-managed MCP tab
The system SHALL present an Installed tab in MCP Settings that lists app-managed MCP servers sourced from the app MCP config path, with add/import/configure/delete actions available for those servers.

#### Scenario: View app-managed MCP servers
- **WHEN** the MCP Settings screen opens and the Installed tab is active
- **THEN** it lists MCP servers from the app-managed config source and exposes add/import/configure/delete actions

### Requirement: CLI global MCP grouping
The system SHALL present a CLI tab that groups global MCP servers by CLI runtime, displaying the runtime name and its config path with a list of servers.

#### Scenario: View CLI MCP groups
- **WHEN** the MCP Settings screen renders the CLI tab
- **THEN** it shows one group per CLI runtime with its config path and servers, or an empty state when none are found

### Requirement: CLI MCPs are read-only
The system SHALL treat CLI global MCP servers as read-only in Settings.

#### Scenario: Prevent editing CLI MCP servers
- **WHEN** a CLI global MCP server is displayed in Settings
- **THEN** no edit or delete controls are shown for that server
