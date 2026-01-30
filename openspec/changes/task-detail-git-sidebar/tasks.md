## 1. Data Loading & State

- [x] 1.1 Add Git panel state for loading/error/repo availability and detect git/non-git cases
- [x] 1.2 Implement loaders for changes/history/branches using existing Git IPC APIs

## 2. Changes Tab

- [x] 2.1 Replace placeholder with change list UI (status, staged indicator, empty state)
- [x] 2.2 Add stage/unstage actions per file and refresh after updates
- [x] 2.3 Add branch diff section comparing base branch and current branch

## 3. Tabs Simplification

- [x] 3.1 Split changes and branch diff into separate tabs
- [x] 3.2 Remove history and branches tabs and related UI

<!-- History & branches tabs removed -->

## 4. UX & Errors

- [x] 4.1 Show clear empty/error states for missing working dir, non-git repo, or API failures
- [x] 4.2 Disable actions while loading and add lightweight UI polish/labels as needed
