## Why

The main process is accumulating architectural debt (global mutable services, weak lifecycle management, unbounded in-memory output, and risky database reset behavior) that increases stability risk as features grow. Addressing these now reduces data-loss risk, memory pressure, and makes future changes safer to implement and test.

## What Changes

- Introduce a structured main-process composition root with explicit `AppContext` and service lifecycle management.
- Add bounded buffering / persistence policies for CLI and pipeline outputs to prevent unbounded memory growth.
- Replace “probe failure => delete DB” behavior with explicit migration/backup/confirmation flow.
- Centralize IPC channel contracts (names + payload types) to avoid drift between main/renderer.
- Add lightweight documentation and tests covering the new contracts and lifecycle behavior.

## Capabilities

### New Capabilities
- `main-service-lifecycle`: Define lifecycle hooks (`init`, `dispose`) and a main-process composition root that wires services, subscriptions, and cleanup.
- `bounded-process-output`: Enforce bounded retention (ring buffer and/or disk spool) for CLI and pipeline output streams.
- `safe-database-migrations`: Provide explicit migration/backup/confirm flow for legacy database schema changes.
- `ipc-contract-registry`: Declare IPC channel names + payload schemas in a central module and reuse across IPC registrations.

### Modified Capabilities
- (none)

## Impact

- `src/main/index.ts` composition and startup flow
- `src/main/services/*` (CLIProcessService, PipelineService, DatabaseService)
- `src/main/ipc/*` and shared types/utilities
- Config and tests related to process output and DB safety
