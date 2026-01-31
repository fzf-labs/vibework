## Context

- Current CLI execution status is tied to process exit and only Claude Code is fully wired.
- Non-Claude CLIs can emit completion output but remain "running" because the process stays alive.
- Log streaming and IPC paths are Claude-only, making UI and status updates inconsistent.
- The change is cross-cutting: main process services, IPC, renderer components, and CLI integration.

## Goals / Non-Goals

**Goals:**
- Provide a unified CLI session lifecycle across all supported CLIs.
- Enforce JSON/structured output modes for all CLI providers.
- Detect completion from CLI output and force-stop the process to keep status consistent.
- Unify log streaming and session status events across CLIs.
- Keep existing AgentExecution/workflow semantics intact.

**Non-Goals:**
- Redesign task/workflow data model or add new persistence tables.
- Change server-side agent execution flow (non-CLI agent server).
- Add new UI capabilities beyond a unified session view.

## Decisions

1) **Introduce a unified `CliSessionService` with adapter registry**
- Why: Current services (ClaudeCodeService + CLIProcessService) are fragmented and CLI-specific.
- Decision: A single service manages session state, logs, completion detection, and IPC for all CLIs.
- Alternative: Keep per-CLI services and duplicate logic → rejected due to drift and inconsistent completion behavior.

2) **Enforce JSON/structured output modes per CLI**
- Why: Completion detection must be reliable and machine-parseable.
- Decision: Each adapter sets CLI args/modes that emit JSON/structured output (aligned with vibe-kanban).
- Alternative: Parse unstructured text → rejected due to false positives and locale differences.

3) **Completion = output signal + forced process stop**
- Why: Some CLIs remain alive after completing a request.
- Decision: When adapter detects completion, emit a forced completion event and kill the process to align status.
- Alternative: Keep processes alive and add separate "execution completed" state → higher UI complexity and risk.

4) **Unify IPC and log streaming under `cliSession:*`**
- Why: Renderer needs one stable contract regardless of CLI type.
- Decision: Replace Claude-only IPC with unified IPC; keep Claude IPC as compatibility shim.
- Alternative: Add per-CLI IPC channels → unnecessary complexity.

5) **Renderer uses a generic `CLISession` component**
- Why: UI should reflect the selected CLI tool and reuse the same status lifecycle.
- Decision: Replace ClaudeCodeSession usage with a generic component keyed by `task.cli_tool_id`.

## Risks / Trade-offs

- **[Risk] CLI JSON output modes differ across versions** → Mitigation: centralize adapters; provide fallbacks to process-exit when JSON parse fails.
- **[Risk] Forcing process termination could truncate trailing logs** → Mitigation: flush buffered output before kill; prefer graceful stop if supported.
- **[Trade-off] Need additional integration effort for codex/gemini/opencode protocols** → Mitigation: adapt from vibe-kanban patterns and stage rollout.

## Migration Plan

1) Add `CliSessionService` and adapters; keep old services intact.
2) Switch IPC and log stream to `cliSession:*`, leaving Claude IPC as wrapper.
3) Update renderer to use `CLISession` for all CLI tools.
4) Remove or reduce old Claude-specific services once stable.

## Open Questions

- Confirm exact JSON output flags for each CLI version in this repo’s runtime.
- Confirm codex/gemini/opencode integration mode (app-server/ACP/SDK) in vibework context.
