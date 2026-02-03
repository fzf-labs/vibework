## ADDED Requirements

### Requirement: Dashboard shows recent task activity
The system SHALL render a recent activity list of tasks ordered by `updatedAt` descending, limited to the most recent 10 items in the current scope.

#### Scenario: Recent activity order and limit
- **WHEN** a user opens the Dashboard
- **THEN** the activity list shows up to 10 most recently updated tasks in descending order

### Requirement: Activity items show status with workflow fallback
The system SHALL display a status indicator for each activity item, using workflow status when available and otherwise falling back to task status.

#### Scenario: Workflow status unavailable
- **WHEN** a task has no workflow status available for display
- **THEN** the activity item shows the task status instead

### Requirement: Activity items link to task details
The system SHALL navigate to the task detail view when a user selects an activity item.

#### Scenario: Activity item navigation
- **WHEN** a user clicks an activity item
- **THEN** the task detail page for that task is opened

### Requirement: Activity list handles empty state
The system SHALL display an empty-state message when no tasks exist in the current scope.

#### Scenario: No recent activity
- **WHEN** the scoped task list is empty
- **THEN** the activity list area shows a no-activity message
