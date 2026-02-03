## 1. AppContext & Lifecycle

- [x] 1.1 Create `AppContext`/`ServiceRegistry` modules and register existing services
- [x] 1.2 Add lifecycle interface and implement `dispose()` for DB, CLI, pipeline, and subscriptions
- [x] 1.3 Update `src/main/index.ts` to use AppContext for service wiring and cleanup

## 2. Bounded Output Retention

- [x] 2.1 Implement ring buffer utility with size/line limits and truncation flag
- [x] 2.2 Integrate ring buffer into CLIProcessService output storage
- [x] 2.3 Integrate ring buffer into PipelineService stage output storage
- [x] 2.4 Add optional disk spool with rotation limits and config defaults

## 3. Safe Database Migration

- [x] 3.1 Add legacy schema detection that does not mutate DB
- [x] 3.2 Implement backup/restore utilities for DB/WAL/SHM files
- [x] 3.3 Add user confirmation flow before destructive reset
- [x] 3.4 Wire migration failure handling and error surfacing

## 4. IPC Contract Registry

- [x] 4.1 Create shared IPC contract module with channel constants and payload types
- [x] 4.2 Migrate main IPC registrations to use registry constants
- [x] 4.3 Migrate renderer IPC calls to use registry constants
- [x] 4.4 Add validation adapters tying registry schemas to handlers

## 5. Tests & Docs

- [x] 5.1 Add tests for lifecycle disposal order and output truncation
- [x] 5.2 Add tests for DB backup/restore paths
- [x] 5.3 Document new architecture and IPC registry usage
