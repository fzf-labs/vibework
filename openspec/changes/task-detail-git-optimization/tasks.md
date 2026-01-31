## 1. Setup & Reference

- [x] 1.1 Review demo implementation at /Users/fuzhifei/code/go/src/demo/1code and note required UI/interaction elements
- [x] 1.2 Add/verify dependencies for @git-diff-view/file, @git-diff-view/react, @git-diff-view/shiki
- [x] 1.3 Identify current task detail Git diff entry points and data flow

## 2. Build Reusable Git Diff Component

- [x] 2.1 Create a standalone Git diff component with props for file list and diff content
- [x] 2.2 Implement file headers (path, change type, add/del counts) and line markers with numbers
- [x] 2.3 Integrate syntax highlighting via shiki adapter
- [x] 2.4 Add empty state and error state rendering
- [x] 2.5 Align styling with existing theme and avoid layout regressions

## 3. Integrate into Task Detail Page

- [x] 3.1 Replace existing diff view with the new component
- [x] 3.2 Wire data from existing Git diff source into the component interface
- [ ] 3.3 Validate behavior for multiple files and large diffs

## 4. Verification

- [ ] 4.1 Manual check: normal repo with changes
- [ ] 4.2 Manual check: no changes (empty state)
- [ ] 4.3 Manual check: non-git directory / diff unavailable (error state)
