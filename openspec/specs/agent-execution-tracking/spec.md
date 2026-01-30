## ADDED Requirements

### Requirement: AgentExecution record creation
The system SHALL create AgentExecution records to track each Agent CLI invocation.

#### Scenario: Create execution record on start
- **WHEN** Agent CLI is invoked for a work node
- **THEN** system creates an AgentExecution record with status="running" and started_at=current timestamp

#### Scenario: Track execution index
- **WHEN** multiple Agent CLI invocations occur for the same work node
- **THEN** system increments execution_index for each new AgentExecution record

### Requirement: AgentExecution status tracking
The system SHALL track Agent CLI execution status independently from work node status.

#### Scenario: Initial execution status
- **WHEN** AgentExecution record is created
- **THEN** system sets status to "idle" until CLI process starts

#### Scenario: Running status
- **WHEN** Agent CLI process is actively running
- **THEN** system sets status to "running"

#### Scenario: Completed status
- **WHEN** Agent CLI process terminates
- **THEN** system sets status to "completed" and records completed_at timestamp

### Requirement: Multi-round conversation support
The system SHALL support multiple conversation rounds within a single work node.

#### Scenario: Continue conversation
- **WHEN** user sends follow-up message to Agent CLI
- **THEN** system transitions AgentExecution status from "completed" back to "running"

#### Scenario: Track conversation rounds
- **WHEN** conversation continues after completion
- **THEN** system keeps the same AgentExecution record, cycling between "running" and "completed"

### Requirement: Execution metrics tracking
The system SHALL track cost and duration for each AgentExecution.

#### Scenario: Record execution cost
- **WHEN** Agent CLI reports token usage/cost
- **THEN** system updates AgentExecution.cost with the reported value

#### Scenario: Record execution duration
- **WHEN** AgentExecution completes
- **THEN** system calculates and stores duration as (completed_at - started_at)

### Requirement: Execution history query
The system SHALL provide APIs to query AgentExecution history.

#### Scenario: Get executions by work node
- **WHEN** user requests execution history for a work node
- **THEN** system returns all AgentExecution records ordered by execution_index ASC

#### Scenario: Get latest execution
- **WHEN** user requests current execution status for a work node
- **THEN** system returns the AgentExecution with highest execution_index
