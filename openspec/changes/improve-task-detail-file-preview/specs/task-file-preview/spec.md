## ADDED Requirements

### Requirement: Task detail file list
The system SHALL display a file list in the task detail right panel that includes task artifacts and workspace files when available.

#### Scenario: Show artifact and workspace sections
- **WHEN** the task detail page renders and a working directory is available
- **THEN** the file list shows a task artifacts section and a workspace section

#### Scenario: Workspace unavailable
- **WHEN** the task detail page renders without a working directory
- **THEN** the workspace section shows an empty state explaining that no directory is available

### Requirement: File selection drives preview
The system SHALL update the preview panel based on the file selected in the file list.

#### Scenario: Select a file
- **WHEN** the user selects a file in the file list
- **THEN** the preview panel renders that file

#### Scenario: Close preview
- **WHEN** the user closes the preview
- **THEN** the preview panel hides and no file remains selected

### Requirement: Text-based preview content loading
The system SHALL load text-based file content from disk when previewing a file that only has a path.

#### Scenario: Load text content from file path
- **WHEN** a text-based file (code, markdown, json, csv, text, html) is selected and content is missing
- **THEN** the system reads the file from disk and displays its contents

#### Scenario: File too large to preview
- **WHEN** the selected file exceeds the preview size limit
- **THEN** the system shows a “file too large to preview” state with an option to open externally

#### Scenario: File read error
- **WHEN** reading the file from disk fails
- **THEN** the system shows an error state with a retry option

### Requirement: File list refresh
The system SHALL allow the user to refresh the workspace file list.

#### Scenario: Refresh workspace list
- **WHEN** the user triggers refresh
- **THEN** the system reloads the workspace directory entries

### Requirement: Directory expansion
The system SHALL allow users to expand directories to view child entries.

#### Scenario: Expand a directory
- **WHEN** the user expands a directory entry
- **THEN** the system loads and displays the directory’s immediate children
