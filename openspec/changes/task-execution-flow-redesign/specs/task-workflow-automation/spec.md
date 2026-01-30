## ADDED Requirements

### Requirement: Automatic workflow instantiation on task start
The system SHALL automatically create a Workflow instance when a task with workflow_template_id transitions to in_progress status.

#### Scenario: Task with workflow template starts
- **WHEN** task.status changes from "todo" to "in_progress" AND task.workflow_template_id is set
- **THEN** system creates a Workflow instance with status="in_progress" and current_node_index=0

#### Scenario: Task without workflow template starts
- **WHEN** task.status changes from "todo" to "in_progress" AND task.workflow_template_id is null
- **THEN** system does NOT create any Workflow instance

### Requirement: Automatic work node instantiation
The system SHALL create WorkNode instances for all nodes in the workflow template when a Workflow is instantiated.

#### Scenario: Create work nodes from template
- **WHEN** a Workflow instance is created
- **THEN** system creates WorkNode instances for each WorkNodeTemplate, preserving node_order and setting status="todo"

### Requirement: Automatic first node execution
The system SHALL automatically start executing the first work node when a workflow is instantiated.

#### Scenario: Start first work node
- **WHEN** Workflow instance is created with work nodes
- **THEN** system transitions the first WorkNode (node_order=1) to status="in_progress"

#### Scenario: Trigger agent execution for first node
- **WHEN** first WorkNode transitions to "in_progress"
- **THEN** system invokes Agent CLI with the composed prompt (task.prompt + work_node.prompt)

### Requirement: Automatic node advancement
The system SHALL automatically advance to the next work node when the current node completes.

#### Scenario: Advance after node completion
- **WHEN** current WorkNode status becomes "done"
- **THEN** system increments Workflow.current_node_index and transitions next WorkNode to "in_progress"

#### Scenario: Complete workflow after last node
- **WHEN** the last WorkNode status becomes "done"
- **THEN** system transitions Workflow.status to "done"
