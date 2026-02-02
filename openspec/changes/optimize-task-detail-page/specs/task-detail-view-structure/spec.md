## ADDED Requirements

### Requirement: Task detail view has dedicated layout regions
The task detail view SHALL render the left navigation/sidebar, primary work area, and contextual right panel as distinct layout regions.

#### Scenario: Standard task view layout
- **WHEN** a user opens a task detail page
- **THEN** the left sidebar, main content area, and right panel are visible as separate regions (subject to existing toggle states)

### Requirement: Region components are isolated
The task detail view SHALL implement each major region as its own component, with shared data/state coordinated by a page-level container.

#### Scenario: Container coordinates data
- **WHEN** the task detail view loads
- **THEN** data fetching and state orchestration happen in the container, and region components receive data via props or context without direct data loading
