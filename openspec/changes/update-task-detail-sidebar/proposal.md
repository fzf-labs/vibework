# Change: Update task detail left panel metadata and reply flow

## Why
Task detail replies currently do not continue the conversation, and the left panel lacks key task metadata needed for quick context. Improving the metadata section and fixing reply streaming restores usability and reduces navigation.

## What Changes
- Add a three-section left panel structure (top metadata, middle output, bottom reply input) on the task detail page.
- Display task title, CLI tool name, status, pipeline template name (when present), and branch name for git tasks.
- Provide collapse/expand behavior when metadata content exceeds available space.
- Ensure reply submissions continue the conversation with streaming responses.

## Impact
- Affected specs: `task-detail-layout`
- Affected code: task detail page layout, task metadata UI, CLI tool display name resolution, reply/streaming flow
