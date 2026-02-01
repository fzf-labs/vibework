## Why

The current data model mixes sessions, messages, and workflows in ways that cause coupling, redundant data, and path inconsistencies. We need a single, stable model where each task is the canonical session, and only execution logs are persisted to disk.

## What Changes

- **BREAKING** Remove the `sessions` and `messages` tables; task becomes the sole session identity (`session_id = task.id`).
- **BREAKING** Remove message-related features from UI and data flow; only Agent/CLI execution logs are persisted.
- Store all Agent/CLI execution logs in `~/.vibework/data/sessions/<session_id>/messages.jsonl` and stop writing `logs/sessions`.
- Create `workflows` and `work_nodes` at task creation time, and snapshot workflow node fields from templates into `work_nodes`.
- Simplify workflow instances by removing `workflow_template_id` from `workflows`.
- Enforce template uniqueness for global/project scopes via partial indexes or a fixed global project_id.
- Align task review flow so `in_review` is triggered/confirmed by explicit UI interaction.

## Capabilities

### New Capabilities
- `task-session-unification`: Task is the sole session identity; sessions/messages tables and message flow are removed.
- `execution-log-storage`: Agent/CLI execution logs are persisted as JSONL under `~/.vibework/data/sessions/<session_id>/`.
- `workflow-snapshotting`: Workflows and work nodes are instantiated at task creation with template fields snapshot into `work_nodes`.

### Modified Capabilities

- (none)

## Impact

- Database schema (tables, columns, indexes) and migrations are replaced with a clean slate.
- Main/renderer IPC APIs for sessions/messages are removed or replaced.
- UI flows for conversation display must be removed or replaced with execution-log views.
- Task creation pipeline must instantiate workflows and work nodes synchronously.
- AppPaths/path helpers updated to `~/.vibework/data/sessions`.
