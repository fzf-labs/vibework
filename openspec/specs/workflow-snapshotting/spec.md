# Workflow Snapshotting

## Purpose
Define how workflows and work nodes are created and snapshotted from templates.

## Requirements

### Requirement: Workflows and work nodes are instantiated at task creation
The system SHALL create a `workflows` row and a full set of `work_nodes` rows when a task with a workflow template is created.

#### Scenario: Task creation seeds workflow state
- **WHEN** a task is created with a workflow template
- **THEN** a workflow and ordered work nodes are inserted with status `todo`

### Requirement: Work node fields are snapshotted from templates
The system SHALL snapshot `name`, `prompt`, `requires_approval`, and `continue_on_error` from template nodes into `work_nodes` at creation time.

#### Scenario: Template changes do not alter existing work nodes
- **WHEN** a workflow template is updated after a task is created
- **THEN** existing work nodes retain their original snapshotted fields

### Requirement: Workflows do not store template identifiers
The system SHALL store workflow state without a `workflow_template_id` column in `workflows`.

#### Scenario: Workflow lookup does not require template id
- **WHEN** workflow state is queried by task
- **THEN** the workflow is resolvable without any template identifier

### Requirement: Workflow template names are unique by scope
The system SHALL enforce unique template names for global scope and unique `(project_id, name)` for project scope.

#### Scenario: Duplicate global template names are rejected
- **WHEN** a second global template with the same name is created
- **THEN** the insert fails due to a uniqueness constraint
