## Context

`src/renderer/src/pages/TaskDetail.tsx` has grown into a large, tightly coupled file that mixes data loading, orchestration, and UI rendering. This makes iterative UI/UX improvements risky and increases the chance of regressions. The change focuses on splitting the page into smaller, well-scoped components and separating stateful orchestration from presentational UI.

## Goals / Non-Goals

**Goals:**
- Isolate major UI regions into dedicated components (task card, workflow card, execution area, reply area, right panel, dialogs).
- Centralize data loading and state orchestration in a container component.
- Preserve existing behavior, layout, and visual design while improving maintainability.
- Reduce cross-section coupling so future improvements do not conflict.

**Non-Goals:**
- Redesign of the task detail UI or workflow.
- Changes to backend APIs, storage, or data models.
- Introducing new global state management.
- Major navigation changes (e.g., new routes or tabs), unless explicitly requested later.

## Decisions

- **Create a page-level container component to own data/state**
  - Rationale: Keeps `useAgent`, data fetching, and orchestration in one place and provides a single source of truth.
  - Alternative: Distribute hooks across components (rejected due to duplicated logic and tighter coupling).

- **Extract UI regions into focused components under a dedicated folder**
  - Example structure:
    - `src/renderer/src/pages/task-detail/TaskDetailPage.tsx` (entry)
    - `src/renderer/src/pages/task-detail/TaskDetailContainer.tsx` (data/state)
    - `src/renderer/src/pages/task-detail/components/TaskCard.tsx`
    - `src/renderer/src/pages/task-detail/components/WorkflowCard.tsx`
    - `src/renderer/src/pages/task-detail/components/ExecutionPanel.tsx`
    - `src/renderer/src/pages/task-detail/components/ReplyCard.tsx`
    - `src/renderer/src/pages/task-detail/components/RightPanelSection.tsx`
    - `src/renderer/src/pages/task-detail/components/TaskDialogs.tsx`
  - Rationale: Clear boundaries for responsibility and easier targeted changes.
  - Alternative: Split into multiple routes/tabs (deferred to avoid UX changes).

- **Preserve existing markup and styling by moving JSX as-is**
  - Rationale: Minimizes visual regressions while still improving structure.
  - Alternative: Refactor layout simultaneously (rejected to keep scope focused).

- **Use explicit props and small shared types between container and components**
  - Rationale: Makes dependencies clear and reduces hidden coupling.
  - Alternative: Rely on implicit context or global stores (rejected for scope).

## Risks / Trade-offs

- [Risk] Prop drilling increases component surface area → Mitigation: group props into small view-model objects and use memoized callbacks.
- [Risk] Behavioral regressions during extraction → Mitigation: preserve JSX order/class names and add smoke tests or manual checks for key flows.
- [Risk] Over-splitting creates too many tiny components → Mitigation: split by major regions only, keep subcomponents focused and cohesive.

## Migration Plan

- No data or API migration required.
- Implement refactor incrementally: container extraction first, then region components, then dialogs/right panel.
- Validate with manual UI walkthrough (load task, start/continue, CLI session, artifact preview, edit/delete).

## Open Questions

- Should the "split page" requirement become explicit navigation changes (tabs or subroutes) in a follow-up, or stay as internal component boundaries for now?
