## 1. Data loading & view models

- [x] 1.1 Add a dashboard data hook to load scoped tasks (project or global) and compute summary counts
- [x] 1.2 Derive recent activity items sorted by updated time with a 10-item limit
- [x] 1.3 Fetch workflow status on-demand for activity items when available, with task status fallback

## 2. Dashboard UI components

- [x] 2.1 Build summary card components for task status counts
- [x] 2.2 Build recent activity list component with status and timestamp
- [x] 2.3 Build empty-state component with create-task CTA

## 3. Page integration

- [x] 3.1 Wire DashboardPage to use the new data hook and components
- [x] 3.2 Add navigation to task detail when selecting an activity item
- [x] 3.3 Ensure project-scoped rendering matches current project selection

## 4. QA & polish

- [ ] 4.1 Verify empty state vs populated state behavior
- [ ] 4.2 Verify summary counts match board task statuses for a project
