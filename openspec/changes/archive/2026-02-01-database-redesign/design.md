## Context

The current database schema includes `sessions`, `tasks`, and `messages`, with UI flows and IPC relying on session/task indices and message history for rendering and state. Execution logs are split between DB messages and `logs/sessions`. This creates redundant data paths, inconsistent storage locations, and tight coupling between conversation UI and task lifecycle.

This change adopts a clean-slate data model: each task is the sole session identity, message features are removed, and only Agent/CLI execution logs are persisted to `~/.vibework/data/sessions/<session_id>/messages.jsonl`.

## Goals / Non-Goals

**Goals:**
- Make `task.id` the canonical session ID (`session_id = task.id`) and remove `sessions`/`messages` tables.
- Persist only Agent/CLI execution logs to JSONL under `~/.vibework/data/sessions`.
- Instantiate `workflows` and `work_nodes` at task creation time and snapshot template fields into `work_nodes`.
- Remove `workflows.workflow_template_id` and enforce workflow template uniqueness constraints.
- Ensure `in_review` status is explicitly controlled by UI interaction.

**Non-Goals:**
- Backward-compatible migration of existing DB/messages/logs.
- Retaining conversation/message UI features.
- Supporting dual-write or legacy fallback paths.

## Decisions

1. **Remove sessions/messages tables and message UI**
   - **Decision:** Delete `sessions` and `messages` tables and remove message-related IPC/UI flows.
   - **Why:** Task is the canonical unit; removing messages eliminates redundant state and simplifies persistence.
   - **Alternatives:** Keep messages in DB or dual-write. Rejected due to added complexity and misalignment with the new model.

2. **Store only execution logs in JSONL**
   - **Decision:** Write Agent/CLI execution logs (stdout/stderr/normalized/finished) to `~/.vibework/data/sessions/<session_id>/messages.jsonl`.
   - **Why:** Single storage location for runtime output, aligned with task/session identity.
   - **Alternatives:** Keep `logs/sessions` or store logs in DB. Rejected for path inconsistency and unnecessary DB churn.

3. **Instantiate workflows and snapshot work nodes at task creation**
   - **Decision:** On task creation, insert `workflows` and `work_nodes` rows and snapshot template fields (name/prompt/approval flags).
   - **Why:** Prevents later template drift and removes runtime dependency on templates for task execution.
   - **Alternatives:** Lazy instantiation at first run. Rejected because it complicates UI/state queries without messages.

4. **Remove `workflows.workflow_template_id`**
   - **Decision:** Drop the column and rely on `work_nodes` snapshots for execution state.
   - **Why:** Avoid redundant source-of-truth; templates are only needed at creation.
   - **Alternatives:** Keep template_id for reference. Rejected due to drift risk and unnecessary coupling.

5. **Enforce template uniqueness with partial indexes**
   - **Decision:** Use partial indexes for global/project uniqueness (or fixed `project_id='global'`).
   - **Why:** Prevent duplicate global template names in SQLite while preserving project scope.
   - **Alternatives:** Application-level checks only. Rejected because DB guarantees are required for consistency.

## Risks / Trade-offs

- **Loss of conversation history UI** → Mitigation: Replace with execution log viewer and task metadata in UI.
- **No data migration** → Mitigation: Document clean-slate behavior and remove legacy code paths to avoid confusion.
- **Log file growth** → Mitigation: Define size limits/rotation strategy in implementation tasks.
- **Task creation becomes heavier** → Mitigation: Keep workflow/work_node inserts simple and synchronous; avoid extra joins at runtime.

## Migration Plan

- On app startup, delete any existing `~/.vibework/data/vibework.db` and `-wal/-shm` files (if present).
- Initialize the new schema with updated tables and indexes.
- Remove legacy session/message IPC endpoints and UI dependencies.
- Update AppPaths and renderer path helpers to `~/.vibework/data/sessions`.
- No rollback support beyond reverting to a previous build (data from this version is not compatible with old schema).

## Open Questions

- Do we need a log rotation or size cap policy for `messages.jsonl`?
- Should execution logs be indexed by a lightweight sidecar file for faster UI loading?
