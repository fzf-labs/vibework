## Why

Task detail page logic and UI are overly coupled in a single file, making each optimization risky and causing changes to interfere with each other. We need a clearer structure so future improvements are safer and faster.

## What Changes

- Split `TaskDetail.tsx` into smaller focused components and containers.
- Separate data loading/state management from presentational UI components.
- Break oversized sections into dedicated subcomponents or subpages where appropriate.
- Keep behavior and visible functionality consistent while improving maintainability.

## Capabilities

### New Capabilities
- `task-detail-view-structure`: Defines the modular structure and separation of concerns for the task detail page.

### Modified Capabilities
- None.

## Impact

- Frontend code structure in `src/renderer/src/pages/TaskDetail.tsx` and related new component files.
- Potential updates to routing or section-level composition for task detail view.
- No backend, API, or data model changes expected.
