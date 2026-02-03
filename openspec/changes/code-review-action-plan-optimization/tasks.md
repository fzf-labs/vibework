## 1. Command Execution Hardening

- [x] 1.1 Add a shared safe exec helper with allowlist and timeout support
- [x] 1.2 Replace GitService command execution with arg-based execFile
- [x] 1.3 Replace PipelineService/PreviewService command execution with arg-based spawn
- [x] 1.4 Replace CLIProcessService/ProcessCliSession/EditorService command execution with allowlisted args

## 2. IPC Privilege Guardrails

- [x] 2.1 Enable sandbox and contextIsolation defaults in main window creation
- [x] 2.2 Implement realpath-based filesystem allowlist utilities for IPC
- [x] 2.3 Restrict shell openUrl to http/https and add optional domain allowlist
- [x] 2.4 Add confirmation and audit logging for destructive file operations

## 3. Process and Session Lifecycle Hygiene

- [x] 3.1 Clean up log stream subscriptions on webContents destroyed
- [x] 3.2 Ensure ClaudeCodeService removes process listeners on session cleanup
- [x] 3.3 Update PreviewService stop to await exit and escalate to SIGKILL
- [x] 3.4 Track PipelineService running processes and terminate on cancel
- [x] 3.5 Remove CLIProcessService sessions on process close

## 4. IPC Validation and Response Consistency

- [x] 4.1 Add IPC response wrapper utility and migrate handlers to use it
- [x] 4.2 Add schema validation or type guards for IPC inputs in key handlers

## 5. Logging, Config, and Structure

- [x] 5.1 Implement async log batching and rotation with size limits in MsgStoreService
- [x] 5.2 Create config module for paths, models, and batcher/rotation settings
- [x] 5.3 Split IPC handlers into `src/main/ipc/*` modules and slim `index.ts`

## 6. Tests and Verification

- [x] 6.1 Add tests for command allowlist and timeout behavior
- [x] 6.2 Add tests for IPC path/URL allowlist enforcement
- [x] 6.3 Add tests for lifecycle cleanup (cancel/preview stop/log subscriptions)
- [x] 6.4 Add tests for log rotation and batching behavior
