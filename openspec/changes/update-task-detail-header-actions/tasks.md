## 1. Implementation
- [x] 1.1 Review current task detail header, metadata rows, and status display logic.
- [x] 1.2 Redesign header metadata as icon+value rows (title stays plain) and remove the back button.
- [x] 1.3 Display only pipeline lifecycle statuses and map non-pipeline execution status to a pipeline status for display.
- [x] 1.4 Add a task actions dropdown with Start and Edit actions.
- [x] 1.5 Implement Edit flow for title, prompt, CLI tool, and pipeline template (exclude branch).
- [x] 1.6 Wire Start action for pipeline tasks (stage 1) and non-pipeline tasks (single run).

## 2. Validation
- [ ] 2.1 Manual QA: header shows icon+value metadata rows; title is plain text; back button removed.
- [ ] 2.2 Manual QA: header status never shows error; only todo/in_progress/in_review/done are displayed.
- [ ] 2.3 Manual QA: actions dropdown shows Start + Edit.
- [ ] 2.4 Manual QA: Edit updates title/prompt/CLI/pipeline template and persists correctly.
- [ ] 2.5 Manual QA: Start triggers pipeline stage 1 or a single run for non-pipeline tasks.
