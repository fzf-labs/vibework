## Why

Agent CLI execution status currently depends on process termination and is only wired for Claude Code. This leaves other CLIs stuck in "running" even after they emit completion output, and makes log streaming and status updates inconsistent across tools.

## What Changes

- Introduce a unified CLI session service that manages all CLI processes, log streams, and completion detection.
- Add per-CLI adapters that enforce JSON/structured output modes and provide completion detectors.
- Emit forced completion events when a CLI reports completion, then terminate the process to keep status consistent.
- Replace Claude-only session UI with a generic CLI session component driven by the selected task CLI.
- Consolidate log streaming so all CLI sessions stream through the same IPC and storage pipeline.
- Keep existing task/workflow/AgentExecution semantics while making completion reliable across all CLIs.

## Capabilities

### New Capabilities
- `cli-session-management`: Unified CLI session lifecycle, completion detection, and log streaming across multiple CLI providers.

### Modified Capabilities
<!-- None -->

## Impact

- Main process: new CLI session service, adapter registry, IPC updates, log streaming changes.
- Renderer: new generic CLI session component, TaskDetail integration for all CLI types.
- Existing ClaudeCodeService / CLIProcessService become deprecated or thin wrappers.
- Task execution status becomes consistent across all CLI providers.
