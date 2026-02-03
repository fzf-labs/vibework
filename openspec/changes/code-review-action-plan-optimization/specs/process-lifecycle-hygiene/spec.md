## ADDED Requirements

### Requirement: Subscription cleanup on renderer destruction
The system SHALL remove log stream subscriptions when the associated `webContents` is destroyed.

#### Scenario: Renderer shutdown
- **WHEN** a renderer process is destroyed
- **THEN** its log stream subscription is removed and no further messages are emitted

### Requirement: Session and listener cleanup
The system SHALL remove child process listeners and session records when a session ends or the process closes.

#### Scenario: CLI session close
- **WHEN** a CLI session process emits `close`
- **THEN** all listeners are removed and the session is deleted from in-memory maps

### Requirement: Preview process termination
The system SHALL wait for preview processes to exit on stop and SHALL escalate to `SIGKILL` after a timeout.

#### Scenario: Stop preview
- **WHEN** `stopPreview` is invoked for a running preview
- **THEN** the process exits or is force-killed after the timeout and the instance is removed

### Requirement: Pipeline cancellation terminates execution
The system SHALL terminate running stage processes when an execution is cancelled and SHALL not emit further output.

#### Scenario: Cancel execution
- **WHEN** a pipeline execution is cancelled
- **THEN** running child processes receive termination signals and no further output is produced
