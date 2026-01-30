## ADDED Requirements

### Requirement: WorkNode status management
The system SHALL track WorkNode execution status through a defined state machine.

#### Scenario: Initial work node status
- **WHEN** a WorkNode instance is created
- **THEN** system sets status to "todo"

#### Scenario: Start work node execution
- **WHEN** user starts executing a work node
- **THEN** system transitions status from "todo" to "in_progress"

#### Scenario: Complete work node for review
- **WHEN** work node execution completes successfully
- **THEN** system transitions status from "in_progress" to "in_review"

#### Scenario: Approve work node
- **WHEN** user approves a work node in review (or requires_approval is false)
- **THEN** system transitions status from "in_review" to "done"

#### Scenario: Reject work node
- **WHEN** user rejects a work node in review
- **THEN** system transitions status back to "in_progress" for re-execution

### Requirement: Sequential work node execution
The system SHALL execute work nodes in sequential order based on node_order.

#### Scenario: Execute first node
- **WHEN** workflow starts execution
- **THEN** system begins with the work node where node_order=1

#### Scenario: Advance to next node
- **WHEN** current work node status becomes "done"
- **THEN** system advances current_node_index and starts the next work node

#### Scenario: Complete workflow
- **WHEN** the last work node status becomes "done"
- **THEN** system marks the workflow status as "done"

### Requirement: Work node prompt composition
The system SHALL compose the final prompt by combining task prompt and work node prompt.

#### Scenario: Compose execution prompt
- **WHEN** a work node starts execution
- **THEN** system combines task.prompt and work_node.prompt to create the final Agent CLI prompt

### Requirement: Error handling in work nodes
The system SHALL handle errors based on the continue_on_error setting.

#### Scenario: Error with continue_on_error=false
- **WHEN** work node execution fails and continue_on_error is false
- **THEN** system stops workflow execution and marks workflow status as "error"

#### Scenario: Error with continue_on_error=true
- **WHEN** work node execution fails and continue_on_error is true
- **THEN** system marks current node as "error" and advances to next node
