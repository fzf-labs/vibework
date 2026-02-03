## ADDED Requirements

### Requirement: Log stream subscriptions SHALL auto-cleanup on webContents destruction
The system SHALL automatically unsubscribe and remove log stream subscriptions when the associated webContents is destroyed.

#### Scenario: WebContents destroyed cleanup
- **WHEN** a webContents with active log stream subscriptions is destroyed
- **THEN** all associated subscriptions are unsubscribed and removed from the map

### Requirement: Event listeners SHALL be removed on session cleanup
The system SHALL remove all event listeners from child processes when a session is closed or cleaned up.

#### Scenario: Session cleanup removes listeners
- **WHEN** a CLI session is closed
- **THEN** stdout, stderr, and process event listeners are removed via removeAllListeners()

### Requirement: Process termination SHALL wait for exit
The system SHALL wait for child processes to actually exit before considering them stopped, with a timeout fallback.

#### Scenario: Graceful process termination
- **WHEN** stopPreview is called for a running preview instance
- **THEN** SIGTERM is sent and the system waits for the exit event

#### Scenario: Forced termination on timeout
- **WHEN** a process does not exit within 5 seconds after SIGTERM
- **THEN** SIGKILL is sent to force termination

### Requirement: CLI sessions SHALL be removed on process close
The system SHALL remove CLI sessions from the sessions map when the child process closes.

#### Scenario: Session removal on close
- **WHEN** a CLI child process emits the close event
- **THEN** the session is removed from the sessions map
