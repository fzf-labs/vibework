## 1. Data Loading & State

- [ ] 1.1 Add Git panel state for loading/error/repo availability and detect git/non-git cases
- [ ] 1.2 Implement loaders for changes/history/branches using existing Git IPC APIs

## 2. Changes Tab

- [ ] 2.1 Replace placeholder with change list UI (status, staged indicator, empty state)
- [ ] 2.2 Add stage/unstage actions per file and refresh after updates

## 3. History & Branches Tabs

- [ ] 3.1 Render commit history list with message/author/date/short hash and empty state
- [ ] 3.2 Render branch list with current branch highlight and checkout action

## 4. UX & Errors

- [ ] 4.1 Show clear empty/error states for missing working dir, non-git repo, or API failures
- [ ] 4.2 Disable actions while loading and add lightweight UI polish/labels as needed
