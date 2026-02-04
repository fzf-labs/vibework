## 1. MCP config utilities

- [x] 1.1 Support per-CLI project MCP config path (`<project>/.vibework/mcp/<cliId>.json`)
- [x] 1.2 Add MCP server parsing/normalization for JSON/TOML and UI-friendly server lists

## 2. Project MCP page detection UI

- [x] 2.1 Render project MCP page with no-project empty state and per-CLI status cards
- [x] 2.2 Remove project folder/config path actions; show global + project status and server list (name + type)
- [x] 2.3 Add MCP detail view on server click

## 3. Agent configuration integration

- [x] 3.1 Include per-CLI project MCP config path in `getMcpConfig` with `project_over_global` merge strategy

## 4. Global settings sync

- [x] 4.1 Add Sync to CLI multi-select to export installed MCP servers to CLI JSON configs

## 5. Validation

- [ ] 5.1 Smoke-test project MCP detection, server list rendering, and sync to CLI
