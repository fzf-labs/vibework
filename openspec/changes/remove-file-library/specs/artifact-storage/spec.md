## ADDED Requirements

### Requirement: File Library Removal
The system SHALL NOT persist or expose a file library derived from tool outputs or task artifacts.

#### Scenario: Task produces files
- **WHEN** tool output includes files
- **THEN** no file records are stored and no file library UI is shown

### Requirement: Attachment Persistence Removal
The system SHALL NOT persist user or tool attachments to disk or database storage.

#### Scenario: User sends an attachment
- **WHEN** an attachment is included in a message
- **THEN** it is used only for the immediate request and is not persisted
