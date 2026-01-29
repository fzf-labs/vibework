## 1. Implementation
- [ ] 1.1 Review current task detail layout, metadata components, and reply flow to identify integration points.
- [ ] 1.2 Add/adjust a task detail metadata section with required fields and conditional rows.
- [ ] 1.3 Resolve CLI tool display name (with fallback to CLI tool id if not available).
- [ ] 1.4 Add pipeline template name display when pipeline templates are associated.
- [ ] 1.5 Implement metadata collapse/expand behavior for constrained layouts.
- [ ] 1.6 Fix reply flow so submissions trigger streaming responses on the task detail page.

## 2. Validation
- [ ] 2.1 Manual QA: task detail page shows top/middle/bottom layout and required metadata fields.
- [ ] 2.2 Manual QA: branch name appears only for git tasks; pipeline name appears only when pipeline template is set.
- [ ] 2.3 Manual QA: metadata collapse/expand works when space is constrained.
- [ ] 2.4 Manual QA: sending a reply continues the conversation and streams responses.
