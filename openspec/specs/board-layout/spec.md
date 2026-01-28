# board-layout Specification

## Purpose
TBD - created by archiving change optimize-board-layout. Update Purpose after archive.
## Requirements
### Requirement: Board page simplified layout
The board page SHALL display a simplified two-section layout with a header toolbar and a full-screen kanban board.

#### Scenario: User views board page
Given the user navigates to the board page
When the page loads
Then the header shows "New Task" button and "Open in IDE" button
And the kanban board fills the remaining screen space
And no task detail sidebar is displayed

### Requirement: Task card navigation
When a user clicks on a task card, the system SHALL navigate to a full-screen task detail page.

#### Scenario: User clicks task card
Given the user is on the board page
When the user clicks on a task card
Then the system navigates to /task/:taskId
And the task detail page is displayed full-screen

