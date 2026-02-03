## Why

The 2026-02-02 review of `src/main` found critical security gaps and stability issues (command injection, overly broad IPC, leaks). Addressing these now reduces risk of arbitrary code execution and improves reliability before further feature work grows the attack surface.

## What Changes

- Replace all shell string execution with `execFile`/`spawn` + args, default `shell: false`, and add command allowlists and timeouts.
- Enable `sandbox` and `contextIsolation`, and enforce IPC path/URL allowlists plus user confirmation/audit for destructive operations.
- Tighten process/session lifecycle management: cleanup subscriptions, remove listeners, ensure cancellations terminate processes, and prevent zombies.
- Standardize IPC handler responses and add runtime input validation/type guards for untrusted inputs.
- Move log persistence to async batching with rotation/size limits.
- Refactor main-process IPC wiring and configuration into clearer modules to reduce file size and improve maintainability.

## Capabilities

### New Capabilities
- `safe-command-execution`: Main-process command execution is argument-based, allowlisted, and time-bounded to prevent injection and runaway processes.
- `ipc-privilege-guardrails`: IPC enforces sandboxed renderer execution plus path/URL allowlists and user confirmation for destructive actions.
- `process-lifecycle-hygiene`: Sessions, subscriptions, and child processes are cleaned up deterministically; cancellations terminate running work.
- `ipc-input-validation`: IPC inputs are validated and handlers return a consistent response envelope.
- `log-rotation-and-batching`: Log persistence is asynchronous, batched, and rotated with size limits.

### Modified Capabilities
- (none)

## Impact

- `src/main/index.ts` and new `src/main/ipc/*` modules for IPC registration and handler standardization.
- Services: `GitService`, `PipelineService`, `PreviewService`, `CLIProcessService`, `ProcessCliSession`, `EditorService`, `ClaudeCodeService`, `MsgStoreService`, `DatabaseService`.
- New/updated utilities for validation, IPC response wrapping, and configuration.
- Test surface: IPC handler tests, command execution safety, process cleanup, and log rotation behavior.
