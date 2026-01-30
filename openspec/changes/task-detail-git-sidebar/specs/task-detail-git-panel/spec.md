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

### Requirement: Branch comparison is visible
The system SHALL display the file list diff between the current worktree branch and the task base branch in the branch comparison tab.

#### Scenario: Base branch comparison
- **WHEN** the branch comparison tab is active and the task has a base branch
- **THEN** the system shows the diff file list between base branch and current branch

#### Scenario: Base branch missing
- **WHEN** the branch comparison tab is active and the task has no base branch
- **THEN** the system shows an empty state explaining that branch comparison is unavailable

<!-- Removed: commit history and branch management are out of scope for this change -->
