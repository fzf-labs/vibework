## Context

The `src/main` Electron main process currently mixes IPC registration, command execution, and service logic in a large entry file. The 2026-02-02 review identified command injection risks, overly broad IPC permissions, and multiple lifecycle leaks. The change must strengthen security boundaries while improving reliability and maintainability without stalling existing feature delivery.

## Goals / Non-Goals

**Goals:**
- Eliminate shell injection vectors by using argument-based process execution with allowlists and timeouts.
- Enforce tighter renderer isolation (sandbox + contextIsolation) and IPC allowlists for file paths and URLs.
- Ensure child process/session/subscription cleanup is deterministic and cancellations stop work.
- Standardize IPC responses and validate untrusted inputs consistently.
- Make logging asynchronous with rotation/limits to protect UI responsiveness.
- Improve main-process structure by modularizing IPC and configuration.

**Non-Goals:**
- Introducing new product features or UI changes.
- Full architecture rewrite of the main process or service layer.
- Large data model changes or database schema redesign.
- Replacing all existing services; only refactor where needed for safety and clarity.

## Decisions

- **Use `execFile`/`spawn` with args + allowlists for all command execution.**
  Alternative: sanitize or escape shell strings. Chosen to remove shell interpretation entirely and reduce injection surface.

- **Enable `sandbox: true` and `contextIsolation: true` by default.**
  Alternative: keep renderer trusted and rely on IPC checks only. Chosen to align with Electron security guidance and to contain renderer compromise impact.

- **Validate IPC file paths using `realpath` + allowlist roots, and restrict URLs to `http/https`.**
  Alternative: regex-only checks. Chosen to prevent path traversal and protocol abuse robustly.

- **Introduce a unified IPC response wrapper and validation layer (zod where structured, guards for small enums).**
  Alternative: ad-hoc error handling. Chosen to reduce renderer-side complexity and provide consistent error surfaces.

- **Track child processes on execution and terminate on cancel with SIGTERM→SIGKILL and exit waits.**
  Alternative: fire-and-forget process management. Chosen to prevent zombies and inconsistent UI state.

- **Asynchronous log batching with rotation and size caps.**
  Alternative: `appendFileSync`. Chosen to avoid main-thread blocking and unbounded disk growth.

- **Modularize IPC registration into `src/main/ipc/*`, keep `index.ts` focused on bootstrapping.**
  Alternative: leave monolith for speed. Chosen to reduce risk of future regressions and improve code ownership.

## Risks / Trade-offs

- **Renderer compatibility changes** → Audit preload and IPC usage; add integration tests around core flows.
- **Command allowlists may block legitimate uses** → Provide a minimal configurable allowlist and log denied attempts.
- **Increased complexity in process lifecycle management** → Add unit tests for cancel/cleanup behavior and verify on all platforms.
- **Log rotation may drop historical data** → Configure retention limits and document behavior; allow opt-in larger caps.
- **Refactor churn in `index.ts`** → Do incremental extraction with clear ownership and tests around each IPC module.

## Migration Plan

1. Add shared utilities: safe exec wrapper, IPC response wrapper, validation helpers, path/URL allowlist utilities.
2. Update high-risk services (Git/Pipeline/Preview/CLI/Editor) to use safe exec/spawn and allowlists.
3. Enable sandbox/contextIsolation behind a temporary flag; validate critical flows; then switch default to on.
4. Apply IPC allowlists and destructive-operation confirmations with audit logging.
5. Implement lifecycle cleanup and cancellation behavior in affected services.
6. Replace sync logging with async batching + rotation.
7. Refactor IPC handlers into modules and shrink `index.ts`.
8. Add tests for IPC validation, command execution safety, and process cleanup.

## Open Questions

- Which directories should be allowed by default for filesystem IPC (workspace root only, or user-selected roots)?
- Do we need an end-user settings UI for allowlist management?
- Preferred log rotation strategy (size-based vs time-based) and retention defaults?
- Should IPC response shape be versioned to avoid breaking older renderers?
- Any platform-specific command execution constraints that require exceptions in allowlists?
