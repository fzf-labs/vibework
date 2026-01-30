## ADDED Requirements

### Requirement: Workflow progress bar display
The system SHALL display a progress bar showing workflow execution status.

#### Scenario: Show progress bar for task with workflow
- **WHEN** task has an associated Workflow instance
- **THEN** system displays WorkflowProgressBar component in TaskDetail header

#### Scenario: Hide progress bar for task without workflow
- **WHEN** task does NOT have an associated Workflow instance
- **THEN** system does NOT display WorkflowProgressBar component

### Requirement: Node status visualization
The system SHALL visually indicate the status of each work node in the progress bar.

#### Scenario: Display node status badges
- **WHEN** WorkflowProgressBar is rendered
- **THEN** system displays a status badge for each WorkNode showing its current status

#### Scenario: Highlight current node
- **WHEN** a WorkNode is in "in_progress" or "in_review" status
- **THEN** system visually highlights that node as the current execution point

### Requirement: Progress percentage calculation
The system SHALL calculate and display overall workflow progress.

#### Scenario: Calculate progress
- **WHEN** WorkflowProgressBar is rendered
- **THEN** system displays progress as (completed_nodes / total_nodes) * 100%

#### Scenario: Update progress on node completion
- **WHEN** a WorkNode.status changes to "done"
- **THEN** system updates the progress percentage in real-time
