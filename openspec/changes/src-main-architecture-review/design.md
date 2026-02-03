## Context

The Electron main process currently wires services in `src/main/index.ts` via module-level mutable variables and ad-hoc event forwarding. Several services hold long-lived resources (child processes, timers, DB connection) without unified lifecycle management. CLI and pipeline output is accumulated in memory without bounds, and legacy DB detection can delete the database if probing fails. IPC channel names and payload shapes are spread across modules, increasing drift risk between main and renderer.

Constraints:
- Must preserve existing behavior and UI contracts during rollout.
- Main process should stay dependency-light and avoid heavy frameworks.
- Electron security posture (sandbox, allowlists) must remain intact.

## Goals / Non-Goals

**Goals:**
- Introduce a composition root (`AppContext`) that cleanly constructs services and coordinates startup/shutdown.
- Add explicit lifecycle hooks so services can dispose resources on quit.
- Define bounded retention for CLI/pipeline output to avoid unbounded memory growth.
- Replace unsafe DB reset logic with an explicit migration/backup/confirmation flow.
- Centralize IPC channel names + payload types for consistency.

**Non-Goals:**
- Redesign renderer UI or business workflows.
- Replace existing IPC validation mechanism (`utils/ipc-response`).
- Large-scale refactors of service logic beyond lifecycle integration.

## Decisions

1. **Introduce `AppContext` + `ServiceRegistry`**
   - Create a small in-house container that constructs services, wires subscriptions, and exposes `dispose()`.
   - **Alternative:** keep module-level singletons and add manual cleanup. Rejected due to complexity and scattered cleanup.

2. **Adopt a `LifecycleService` interface**
   - Services with resources implement optional `init()` and `dispose()`.
   - `AppContext` calls `init()` after construction and `dispose()` on shutdown.
   - **Alternative:** rely on Electron `before-quit` only. Rejected because it does not address timers/child processes that need orderly teardown.

3. **Bounded output retention (memory + optional disk)**
   - Add a ring buffer for CLI/pipeline output (configurable max bytes/lines).
   - Optional disk spool for long-running sessions with eviction/rotation.
   - **Alternative:** current unbounded array. Rejected due to memory risk.

4. **Safe DB migration/backup flow**
   - Detect legacy schema; create a timestamped backup; attempt migration or require user confirmation for destructive reset.
   - On failure, restore from backup and surface error.
   - **Alternative:** delete on probe failure. Rejected due to data-loss risk.

5. **IPC contract registry**
   - Define IPC channels and payload types in a shared module (e.g., `src/shared/ipc/contract.ts`).
   - Main and renderer import from the same source to avoid drift.
   - **Alternative:** keep scattered strings. Rejected due to maintenance overhead.

## Risks / Trade-offs

- **[More boilerplate]** → Provide helpers for service registration and disposal to keep code concise.
- **[Disk usage growth]** → Add retention limits + rotation; expose config defaults.
- **[Migration prompting blocks startup]** → Keep the prompt minimal and only when legacy DB detected; allow safe default path (backup + migrate).
- **[Contract registry refactor touches many files]** → Perform in small increments with backward-compatible aliases during migration.

## Migration Plan

1. Introduce `AppContext`/`ServiceRegistry` and wrap existing service construction without changing behavior.
2. Add lifecycle hooks for services that own resources (DB, CLI, pipeline, subscriptions).
3. Implement bounded output retention and update services to use it.
4. Add DB backup + migration confirmation path; keep rollback hooks.
5. Add IPC contract registry and migrate modules gradually; keep old channel strings during transition.
6. Remove legacy patterns after validation.

## Open Questions

- Should bounded output defaults be size-based, time-based, or both?
- Do we need a UI surface for DB migration confirmation or a CLI-only prompt?
- Should IPC contract registry live in `src/shared` or `src/main` with a generated renderer import?
