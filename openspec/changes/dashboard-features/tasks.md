## 1. Data loading & view models

- [ ] 1.1 Add a dashboard data hook to load scoped tasks (project or global) and compute summary counts
- [ ] 1.2 Derive recent activity items sorted by updated time with a 10-item limit
- [ ] 1.3 Fetch workflow status on-demand for activity items when available, with task status fallback

## 2. Dashboard UI components

- [ ] 2.1 Build summary card components for task status counts
- [ ] 2.2 Build recent activity list component with status and timestamp
- [ ] 2.3 Build empty-state component with create-task CTA

## 3. Page integration

- [ ] 3.1 Wire DashboardPage to use the new data hook and components
- [ ] 3.2 Add navigation to task detail when selecting an activity item
- [ ] 3.3 Ensure project-scoped rendering matches current project selection

## 4. QA & polish

- [ ] 4.1 Verify empty state vs populated state behavior
- [ ] 4.2 Verify summary counts match board task statuses for a project
