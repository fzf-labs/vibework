# Task Detail Layout Specification

## ADDED Requirements

### Requirement: Two-column layout
The task detail page SHALL display a two-column layout with CLI panel on the left and multi-function panel on the right.

#### Scenario: User views task detail page
Given the user navigates to a task detail page
When the page loads
Then the left panel shows CLI execution output
And the left panel has a chat input at the bottom
And the right panel shows function tabs at the top

### Requirement: Right panel function tabs
The right panel SHALL provide tabs for File Preview, Dev Server, and Git operations.

#### Scenario: User switches between tabs
Given the user is on the task detail page
When the user clicks on a function tab
Then the corresponding panel content is displayed
And other panel contents are hidden

### Requirement: Git panel features
The Git panel SHALL display changed files and provide merge, PR, and rebase operations.

#### Scenario: User views Git changes
Given the user is on the task detail page
And the user clicks on the Git tab
When the panel loads
Then the changed files list is displayed
And merge, PR, and rebase buttons are available
