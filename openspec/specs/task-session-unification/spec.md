# Task Session Unification

## Purpose
Define task identity and review behavior for execution context.

## Requirements

### Requirement: Task owns a UUID session identity
The system SHALL treat each task as the sole session for its execution context and SHALL persist a `session_id` that is a valid UUID on the task record.

#### Scenario: Create task assigns session identity
- **WHEN** a task is created
- **THEN** the stored `session_id` is a valid UUID associated with that task

### Requirement: Task creation does not require session records or task indexes
The system SHALL create and retrieve tasks without any `sessions` table or `task_index` field.

#### Scenario: Create task without task_index
- **WHEN** a task is created without a `task_index`
- **THEN** the task is stored successfully without any session table insert

### Requirement: Task review is explicitly user-driven
The system SHALL transition a task to `in_review` only when a user performs an explicit review action in the UI.

#### Scenario: Task completion does not auto-review
- **WHEN** all workflow nodes reach a terminal state
- **THEN** the task remains `in_progress` until the user triggers review
