## ADDED Requirements

### Requirement: AppContext constructs and exposes main services
The system SHALL construct all main-process services through a single AppContext and expose them for IPC registration and event wiring.

#### Scenario: Main process starts
- **WHEN** the Electron app reaches the ready state
- **THEN** AppContext is created and provides access to all registered services

### Requirement: Lifecycle hooks are executed in order
Services MAY implement lifecycle hooks, and AppContext SHALL call `init()` after construction and `dispose()` on shutdown in reverse registration order.

#### Scenario: App shutdown
- **WHEN** the app receives `before-quit`
- **THEN** AppContext calls `dispose()` on all services in reverse order of registration

### Requirement: Disposable resources are tracked and released
AppContext SHALL track disposable subscriptions and resources created during initialization and release them during shutdown.

#### Scenario: Service registers a subscription
- **WHEN** a service registers a disposable (event handler, interval, child process)
- **THEN** AppContext releases it during shutdown and no handlers remain active
