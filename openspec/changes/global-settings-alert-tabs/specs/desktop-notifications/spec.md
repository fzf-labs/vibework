## ADDED Requirements

### Requirement: Desktop notification settings are configurable in global settings
The system SHALL provide a "通知" tab in global settings with a toggle to enable or disable desktop notifications for task completion, and SHALL persist the setting across sessions.

#### Scenario: User enables desktop notifications
- **WHEN** the user turns on the desktop notification toggle in the "通知" tab
- **THEN** the system saves the setting as enabled

#### Scenario: User disables desktop notifications
- **WHEN** the user turns off the desktop notification toggle in the "通知" tab
- **THEN** the system saves the setting as disabled

### Requirement: Notification permission is requested when enabling
The system SHALL request notification permission when the user enables desktop notifications and permission is not yet granted.

#### Scenario: Permission not granted and user enables notifications
- **WHEN** the user enables desktop notifications and notification permission is not granted
- **THEN** the system prompts for notification permission

#### Scenario: Permission denied
- **WHEN** the user denies notification permission
- **THEN** the system indicates that notifications are unavailable and keeps notifications disabled

### Requirement: Desktop notification is sent on task completion when enabled
The system SHALL send a system-level notification when a task completes successfully if desktop notifications are enabled and permission is granted.

#### Scenario: Task completes with notifications enabled
- **WHEN** a task completes and desktop notifications are enabled with permission granted
- **THEN** the system displays a desktop notification for the completed task

#### Scenario: Task completes with notifications disabled
- **WHEN** a task completes and desktop notifications are disabled
- **THEN** the system does not display a desktop notification
