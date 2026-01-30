## ADDED Requirements

### Requirement: Automatic review state based on requires_approval
The system SHALL automatically determine post-execution state based on the requires_approval setting.

#### Scenario: Enter review when approval required
- **WHEN** work node execution completes successfully AND requires_approval is true
- **THEN** system transitions WorkNode.status to "in_review"

#### Scenario: Skip review when approval not required
- **WHEN** work node execution completes successfully AND requires_approval is false
- **THEN** system transitions WorkNode.status directly to "done"

### Requirement: Automatic next node trigger
The system SHALL automatically trigger the next work node after current node completion.

#### Scenario: Auto-start next node after done
- **WHEN** WorkNode.status transitions to "done" AND there are remaining nodes
- **THEN** system automatically transitions next WorkNode to "in_progress"

#### Scenario: No auto-start when workflow complete
- **WHEN** WorkNode.status transitions to "done" AND it is the last node
- **THEN** system does NOT start any new node execution
