## 1. Structure and scaffolding

- [x] 1.1 Create `src/renderer/src/pages/task-detail/` and add a new entry component that preserves current exports
- [x] 1.2 Define shared view-model types and helper utilities for task detail region props

## 2. Component extraction

- [x] 2.1 Extract a `TaskDetailContainer` that owns data loading/state orchestration and supplies props to regions
- [x] 2.2 Extract `TaskCard` component from the task metadata section
- [x] 2.3 Extract `WorkflowCard` component and related display helpers
- [x] 2.4 Extract `ExecutionPanel` for message list / CLI session rendering
- [x] 2.5 Extract `ReplyCard` for the chat input section
- [x] 2.6 Extract `RightPanelSection` wrapping the preview panel and artifact preview
- [x] 2.7 Extract `TaskDialogs` for CLI review, edit, and delete dialogs

## 3. Integration and validation

- [x] 3.1 Wire the new components into the page layout and keep ToolSelectionContext/SidebarProvider behavior unchanged
- [x] 3.2 Clean up imports, props, and unused state after extraction
- [ ] 3.3 Manually smoke-check task detail flows (load task, start/continue, CLI session, preview, edit/delete)
