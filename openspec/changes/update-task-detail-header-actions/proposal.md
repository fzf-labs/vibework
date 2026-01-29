# Change: Update task detail header metadata and actions

## Why
Task detail header metadata needs clearer visual presentation, and the header should expose key actions without showing incorrect status states.

## What Changes
- Present task detail header metadata using icon+value layout (title remains plain text).
- Remove the task detail back button from the header.
- Display only pipeline lifecycle statuses (todo/in_progress/in_review/done) and hide error status in the header.
- Add an actions dropdown with Start and Edit entries.
- Support editing task title, prompt, CLI tool, and pipeline template (branch is not editable).

## Impact
- Affected specs: `task-detail-layout`
- Affected code: task detail header layout, status display mapping, task actions UI, task edit flow
