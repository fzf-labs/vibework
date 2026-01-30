## ADDED Requirements

### Requirement: WorkflowTemplate CRUD operations
The system SHALL provide complete CRUD operations for WorkflowTemplate entities, supporting both global and project-scoped templates.

#### Scenario: Create global workflow template
- **WHEN** user creates a workflow template with scope "global"
- **THEN** system creates a new record in global_workflow_templates table

#### Scenario: Create project workflow template
- **WHEN** user creates a workflow template with scope "project" and a valid project_id
- **THEN** system creates a new record in project_workflow_templates table with the specified project_id

#### Scenario: List global workflow templates
- **WHEN** user requests all global workflow templates
- **THEN** system returns all templates from global_workflow_templates table, ordered by updated_at DESC

#### Scenario: List project workflow templates
- **WHEN** user requests workflow templates for a specific project
- **THEN** system returns all templates from project_workflow_templates where project_id matches, ordered by updated_at DESC

#### Scenario: Update workflow template
- **WHEN** user updates a workflow template's name, description, or work nodes
- **THEN** system updates the template and sets updated_at to current timestamp

#### Scenario: Delete workflow template
- **WHEN** user deletes a workflow template
- **THEN** system removes the template and all associated work node templates

### Requirement: WorkNodeTemplate management
The system SHALL support managing WorkNodeTemplate entities as part of a WorkflowTemplate.

#### Scenario: Add work node to template
- **WHEN** user adds a work node to a workflow template
- **THEN** system creates a WorkNodeTemplate with the specified name, prompt, node_order, requires_approval, and continue_on_error

#### Scenario: Reorder work nodes
- **WHEN** user changes the order of work nodes in a template
- **THEN** system updates node_order for all affected work nodes

#### Scenario: Remove work node from template
- **WHEN** user removes a work node from a workflow template
- **THEN** system deletes the WorkNodeTemplate and reorders remaining nodes

### Requirement: Workflow instantiation
The system SHALL create Workflow instances from WorkflowTemplate when a task starts execution.

#### Scenario: Instantiate workflow for task
- **WHEN** a task with workflow_template_id starts execution
- **THEN** system creates a Workflow instance linked to the task, with status="todo" and current_node_index=0

#### Scenario: Instantiate work nodes
- **WHEN** a Workflow instance is created
- **THEN** system creates WorkNode instances for each WorkNodeTemplate, preserving node_order and setting status="todo"

#### Scenario: Task without workflow
- **WHEN** a task without workflow_template_id starts execution
- **THEN** system does not create any Workflow instance, task executes directly

### Requirement: Copy global template to project
The system SHALL allow copying a global workflow template to a project scope.

#### Scenario: Copy template to project
- **WHEN** user copies a global template to a project
- **THEN** system creates a new project-scoped template with identical name, description, and work nodes
