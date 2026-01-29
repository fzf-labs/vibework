## ADDED Requirements
### Requirement: Task detail header metadata layout
The task detail page SHALL render a header metadata section with icon+value rows for task details, while the task title remains a plain text heading.

#### Scenario: User views task detail header
- **WHEN** the task detail page loads
- **THEN** the task title is displayed as plain text
- **AND** the metadata rows display icon+value pairs for CLI tool, pipeline, branch (when available), and status

### Requirement: Task detail header navigation
The task detail header SHALL NOT display a back button.

#### Scenario: User views task detail header
- **WHEN** the task detail page loads
- **THEN** no back button is rendered in the header

### Requirement: Task status display
The task detail header SHALL display only the pipeline lifecycle statuses (todo, in_progress, in_review, done) and SHALL NOT display error status.

#### Scenario: Task has execution error
- **GIVEN** a task with an execution error state
- **WHEN** the task detail header renders
- **THEN** the status display maps to one of the pipeline lifecycle statuses
- **AND** error is not shown in the header

### Requirement: Task actions dropdown
The task detail header SHALL provide an actions dropdown with Start and Edit actions.

#### Scenario: User opens task actions
- **WHEN** the user opens the task actions dropdown
- **THEN** Start and Edit options are available

### Requirement: Task edit fields
The task edit action SHALL allow editing of title, prompt, CLI tool, and pipeline template, and SHALL NOT allow editing the branch.

#### Scenario: User edits task details
- **WHEN** the user selects Edit in the task actions dropdown
- **THEN** the edit form includes title, prompt, CLI tool, and pipeline template fields
- **AND** the branch field is not editable

### Requirement: Task start behavior
The Start action SHALL begin the pipeline at stage 1 for pipeline tasks, and SHALL run a single execution for non-pipeline tasks.

#### Scenario: User starts task
- **WHEN** the user selects Start from the task actions dropdown
- **THEN** pipeline tasks begin at stage 1
- **AND** non-pipeline tasks begin a single execution
