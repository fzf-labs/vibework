## ADDED Requirements

### Requirement: Dashboard shows task status summary cards
The system SHALL display summary cards for task statuses (`todo`, `in_progress`, `in_review`, `done`) using the task scope determined by the active project context.

#### Scenario: Summary cards render counts on load
- **WHEN** a user opens the Dashboard
- **THEN** the summary cards show counts derived from the scoped task list

### Requirement: Dashboard respects project scope
The system SHALL aggregate Dashboard summary metrics using tasks from the current project when a project is selected, and SHALL use all tasks when no project is selected.

#### Scenario: Project scoped metrics
- **WHEN** a user selects a project
- **THEN** the summary metrics reflect only tasks with the selected `project_id`

### Requirement: Dashboard provides an empty state
The system SHALL render an empty state with a call-to-action to create a task when no tasks exist in the current scope.

#### Scenario: Empty state for no tasks
- **WHEN** the scoped task list is empty
- **THEN** the Dashboard shows an empty state message and a create-task action
