## ADDED Requirements
### Requirement: Git settings tab
The system SHALL provide a "Git" settings tab in the Settings sidebar.

#### Scenario: User opens settings sidebar
- **WHEN** the user views the Settings category list
- **THEN** a "Git" category is present

#### Scenario: User opens Git settings
- **WHEN** the user selects the "Git" category
- **THEN** the Git settings view is displayed

### Requirement: Git installation status
The system SHALL display whether Git is installed on the machine.

#### Scenario: Git is installed
- **WHEN** the system checks Git availability
- **THEN** the status is shown as installed

#### Scenario: Git is not installed
- **WHEN** the system checks Git availability and Git is missing
- **THEN** the status is shown as not installed

### Requirement: Worktree branch prefix setting
The system SHALL allow the user to configure a global worktree branch prefix used for new worktree branches, with a default value of "vw-", and the prefix MUST NOT be empty.

#### Scenario: User opens Git settings with default prefix
- **WHEN** the user opens the Git settings tab for the first time
- **THEN** the worktree branch prefix field displays "vw-"

#### Scenario: User updates the prefix
- **WHEN** the user enters a non-empty prefix and saves settings
- **THEN** the prefix is persisted and shown on the next open

#### Scenario: User attempts to clear the prefix
- **WHEN** the user clears the prefix input and attempts to save
- **THEN** the system blocks the change and keeps the previous non-empty value

#### Scenario: New worktree branch uses prefix
- **WHEN** the system creates a new Git worktree for a task
- **THEN** the branch name starts with the configured prefix
