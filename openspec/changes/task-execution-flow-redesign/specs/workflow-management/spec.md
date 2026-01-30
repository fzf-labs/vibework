## ADDED Requirements

### Requirement: Task-Workflow status synchronization
The system SHALL synchronize task status based on workflow status changes.

#### Scenario: Sync task to in_progress when workflow starts
- **WHEN** Workflow.status changes to "in_progress"
- **THEN** system sets associated Task.status to "in_progress"

#### Scenario: Sync task to in_review when node needs review
- **WHEN** any WorkNode.status changes to "in_review"
- **THEN** system sets associated Task.status to "in_review"

#### Scenario: Sync task to done when workflow completes
- **WHEN** Workflow.status changes to "done"
- **THEN** system sets associated Task.status to "done"

#### Scenario: Sync task to error when workflow fails
- **WHEN** Workflow.status changes to "error"
- **THEN** system sets associated Task.status to "error"

### Requirement: Workflow status derivation
The system SHALL derive workflow status from its work nodes.

#### Scenario: Workflow in_progress when any node executing
- **WHEN** any WorkNode.status is "in_progress"
- **THEN** Workflow.status SHALL be "in_progress"

#### Scenario: Workflow in_review when current node in review
- **WHEN** current WorkNode.status is "in_review"
- **THEN** Workflow.status SHALL be "in_review"

#### Scenario: Workflow done when all nodes done
- **WHEN** all WorkNode.status values are "done"
- **THEN** Workflow.status SHALL be "done"
