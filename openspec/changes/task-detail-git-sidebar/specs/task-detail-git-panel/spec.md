## ADDED Requirements

### Requirement: Git panel provides availability feedback
The system SHALL show a clear empty/error state in the Git panel when the task working directory is missing, Git is unavailable, or the directory is not a Git repository.

#### Scenario: No working directory
- **WHEN** the Git panel is active and the task has no working directory
- **THEN** the panel shows a “no working directory” message and disables Git actions

#### Scenario: Not a Git repository
- **WHEN** the Git panel loads for a working directory that is not a Git repository
- **THEN** the panel shows a “not a Git repository” message and disables Git actions

### Requirement: Git changes list is visible and refreshable
The system SHALL load and display changed files for the working directory using the Git API, including file path, status, and staged indicator, and SHALL allow users to refresh the list.

#### Scenario: Load changes on refresh
- **WHEN** the user clicks the refresh button in the changes tab
- **THEN** the system fetches changed files from the Git API and updates the list

### Requirement: Files can be staged and unstaged
The system SHALL allow users to stage or unstage individual changed files from the changes tab and SHALL refresh the list after the action completes.

#### Scenario: Stage an unstaged file
- **WHEN** the user stages a file that is currently unstaged
- **THEN** the system calls the stage API for that file and the file appears as staged in the list

#### Scenario: Unstage a staged file
- **WHEN** the user unstages a file that is currently staged
- **THEN** the system calls the unstage API for that file and the file appears as unstaged in the list

### Requirement: Commit history is displayed
The system SHALL display recent commits for the working directory, including commit message, author, date, and short hash.

#### Scenario: Load commit history
- **WHEN** the user opens the history tab
- **THEN** the system fetches the commit log and displays the latest commits

### Requirement: Branch list and current branch are visible
The system SHALL display all local branches and indicate the current branch, and SHALL allow switching to another branch.

#### Scenario: Switch branches
- **WHEN** the user selects a non-current branch in the branches tab
- **THEN** the system checks out the selected branch and refreshes the branch list
