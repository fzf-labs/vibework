# Execution Log Storage

## Purpose
Define how execution logs are persisted per task session.

## Requirements

### Requirement: Execution logs are persisted per task
The system SHALL append Agent/CLI execution logs to `~/.vibework/data/sessions/<project_id>/<task_id>.jsonl` for each task.

#### Scenario: Append stdout log line
- **WHEN** the Agent/CLI produces stdout for a task
- **THEN** a JSON line is appended to the task's `<task_id>.jsonl` file

### Requirement: Only Agent/CLI execution logs are persisted
The system SHALL NOT persist user messages or conversation history to disk.

#### Scenario: User message is not written to JSONL
- **WHEN** a user submits input in the UI
- **THEN** no user-message entry is written to the task's JSONL file

### Requirement: Log entries use a constrained schema
The system SHALL write each JSONL line with `type`, `task_id`, `session_id`, and `created_at`, and SHALL constrain `type` to `stdout`, `stderr`, `normalized`, or `finished`.

#### Scenario: Valid log entry fields and type
- **WHEN** a log line is written
- **THEN** it includes required fields and a valid `type` value
