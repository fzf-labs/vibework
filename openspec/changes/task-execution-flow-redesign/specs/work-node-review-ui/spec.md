## ADDED Requirements

### Requirement: Review panel display
The system SHALL display a review panel when a work node is in "in_review" status.

#### Scenario: Show review panel
- **WHEN** current WorkNode.status is "in_review"
- **THEN** system displays WorkNodeReviewPanel component in TaskDetail page

#### Scenario: Hide review panel
- **WHEN** current WorkNode.status is NOT "in_review"
- **THEN** system hides WorkNodeReviewPanel component

### Requirement: Review panel content
The system SHALL display relevant information in the review panel for user decision.

#### Scenario: Display node information
- **WHEN** review panel is shown
- **THEN** system displays work node name, prompt, and execution output

#### Scenario: Display execution history
- **WHEN** review panel is shown
- **THEN** system displays AgentExecution records for the current work node

### Requirement: Approve action
The system SHALL allow users to approve a work node in review.

#### Scenario: User approves work node
- **WHEN** user clicks "Approve" button in review panel
- **THEN** system transitions WorkNode.status from "in_review" to "done"

### Requirement: Reject action
The system SHALL allow users to reject a work node and request re-execution.

#### Scenario: User rejects work node
- **WHEN** user clicks "Reject" button in review panel
- **THEN** system transitions WorkNode.status from "in_review" to "in_progress"

#### Scenario: Re-execute after rejection
- **WHEN** WorkNode.status transitions from "in_review" to "in_progress" via rejection
- **THEN** system creates a new AgentExecution record and invokes Agent CLI
