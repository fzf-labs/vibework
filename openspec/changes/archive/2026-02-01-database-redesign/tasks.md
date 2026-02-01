## 1. Schema & Database Service

- [x] 1.1 Replace DB schema with `projects`, `tasks`, `workflows`, `workflow_templates`, `workflow_template_nodes`, `work_nodes`, `agent_executions` and remove `sessions`/`messages` tables
- [x] 1.2 Add/refresh indexes, including partial unique indexes for workflow template names by scope
- [x] 1.3 Remove legacy columns (`task_index`, `pipeline_template_id` → `workflow_template_id`, `workflows.workflow_template_id`, `agent_executions.cli_session_id`)
- [x] 1.4 Remove schema migration logic that references deleted tables/columns

## 2. Paths & Execution Log Storage

- [x] 2.1 Add AppPaths helpers for `~/.vibework/data/sessions/<session_id>` and ensure directories are created
- [x] 2.2 Update MsgStoreService/CLI adapters to write JSONL logs to `~/.vibework/data/sessions/<session_id>/messages.jsonl`
- [x] 2.3 Enforce JSONL log schema (type in stdout/stderr/normalized/finished + task_id/session_id/created_at)

## 3. Task/Workflow Instantiation & Status

- [x] 3.1 Update TaskService create flow to set `session_id = task.id` and remove task_index usage
- [x] 3.2 Create workflow + work_nodes during task creation and snapshot template fields into work_nodes
- [x] 3.3 Ensure `in_review` is only set by explicit UI action (no automatic transition)

## 4. IPC & UI Refactor (No Messages)

- [x] 4.1 Remove session/message IPC handlers and renderer adapters
- [x] 4.2 Replace conversation views with execution-log views backed by JSONL
- [x] 4.3 Update task detail/board to query status from tasks/workflows/work_nodes/agent_executions only
- [x] 4.4 Remove renderer code paths that generate/use task_index or session records

## 5. Cleanup & Verification

- [x] 5.1 Remove legacy `logs/sessions` usage and cleanup any related filesystem paths
- [x] 5.2 Align remaining docs/configs with new storage paths and schema
- [ ] 5.3 Smoke test: create task, verify workflow/work_nodes created, JSONL logs written, manual review flow works
