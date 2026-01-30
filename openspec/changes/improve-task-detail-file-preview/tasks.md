## 1. File List UI

- [x] 1.1 Add a file list panel to the RightPanel “files” tab with artifact/workspace sections
- [x] 1.2 Implement workspace directory loading via fs.readDir with lazy expand and refresh handling
- [x] 1.3 Wire file list selection to TaskDetail selectedArtifact state

## 2. Preview Loading Enhancements

- [x] 2.1 Add text-based file content loading in ArtifactPreview for path-only artifacts
- [x] 2.2 Enforce preview size limits and display “file too large” state for text files
- [x] 2.3 Add error + retry handling for preview load failures

## 3. UX Polish & Localization

- [x] 3.1 Add i18n strings for file list labels, empty states, errors, and actions
- [x] 3.2 Add auxiliary actions (refresh, copy path, open in editor/external) where appropriate
- [x] 3.3 Verify layout/scroll behavior for right panel split view on common viewport sizes
