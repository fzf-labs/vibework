# Change: Update MCP settings layout and sources

## Why
The MCP settings UI currently merges all MCP sources and only distinguishes a single built-in source. Users need the same clarity and grouping as Skills: app-managed MCPs vs CLI global MCPs.

## What Changes
- Split MCP settings into two tabs: Installed (app-managed) and CLI (global, per CLI runtime).
- Display CLI MCPs grouped by runtime with read-only cards and config path display.
- Keep app-managed MCPs editable; CLI MCPs are view-only.

## Impact
- Affected specs: mcp-settings (new)
- Affected code: `src/renderer/src/components/settings/tabs/MCPSettings.tsx`, settings i18n strings, MCP config loading/display logic
