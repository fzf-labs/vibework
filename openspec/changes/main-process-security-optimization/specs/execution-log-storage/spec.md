## MODIFIED Requirements

### Requirement: Execution logs are persisted per task session
The system SHALL append Agent/CLI execution logs to `~/.vibework/data/sessions/<session_id>/messages.jsonl` for each task using asynchronous file operations with batching.

#### Scenario: Append stdout log line
- **WHEN** the Agent/CLI produces stdout for a task
- **THEN** a JSON line is queued for async batch write to the task's `messages.jsonl` file

#### Scenario: Async batch flush
- **WHEN** the write queue reaches the batch threshold or flush interval
- **THEN** all queued entries are written to disk in a single async operation

## ADDED Requirements

### Requirement: Log files SHALL have size limits and rotation
The system SHALL enforce a maximum file size for log files and rotate them when the limit is reached.

#### Scenario: Log rotation on size limit
- **WHEN** a log file exceeds 10MB
- **THEN** the file is rotated to `messages.1.jsonl` and a new `messages.jsonl` is created

#### Scenario: Rotation file limit
- **WHEN** rotation would create more than 5 rotated files
- **THEN** the oldest rotated file is deleted
