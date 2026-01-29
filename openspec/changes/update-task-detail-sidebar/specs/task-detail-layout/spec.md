## ADDED Requirements
### Requirement: Left panel three-section layout
The task detail page SHALL structure the left panel into three sections: metadata header (top), output/conversation area (middle), and reply input (bottom).

#### Scenario: User views task detail page
- **WHEN** the task detail page is rendered
- **THEN** the left panel shows a top metadata section
- **AND** the middle section displays the task output or conversation stream
- **AND** the bottom section provides a reply input for continuing the conversation

### Requirement: Task metadata fields
The metadata section SHALL display task title and CLI tool name, and SHALL display task status, pipeline template name (when a pipeline template is associated), and branch name for git tasks when available.

#### Scenario: Task has pipeline and branch
- **GIVEN** a task with `pipeline_template_id` and `branch_name`
- **WHEN** the metadata section renders
- **THEN** the pipeline template name and branch name are displayed
- **AND** the task status, title, and CLI tool name are displayed

#### Scenario: Task without pipeline or branch
- **GIVEN** a task without `pipeline_template_id` and without `branch_name`
- **WHEN** the metadata section renders
- **THEN** the pipeline and branch fields are hidden
- **AND** the task status, title, and CLI tool name remain visible

### Requirement: Metadata overflow handling
The metadata section SHALL provide a collapse/expand control when content would exceed the available vertical space, preserving access to all fields.

#### Scenario: Metadata does not fit
- **GIVEN** the metadata section exceeds available height
- **WHEN** the user collapses the section
- **THEN** only essential fields (title and status) remain visible
- **AND** a control remains available to expand the section again

### Requirement: Reply continues conversation
The task detail reply input SHALL submit user replies and continue the conversation with streaming responses.

#### Scenario: User sends a reply
- **GIVEN** a task detail page with an existing conversation
- **WHEN** the user submits a reply
- **THEN** the user message appears immediately
- **AND** the agent response streams into the output/conversation area
