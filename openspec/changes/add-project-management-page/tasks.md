## 1. Implementation
- [ ] 1.1 Add project management route `/projects` under main layout and create a page skeleton
- [ ] 1.2 Move project CRUD UI from sidebar dialogs into the project management page (create/update/delete)
- [ ] 1.3 Update project switcher UI: remove open-folder/delete/new-project actions, add management button
- [ ] 1.4 Add project-existence guard to hard-redirect to `/projects` when no projects exist
- [ ] 1.5 Update copy/locale strings for new project management entry

## 2. Validation
- [ ] 2.1 Manual: launch with zero projects → redirected/locked on `/projects`
- [ ] 2.2 Manual: create project on `/projects` → navigation unlocked; switcher shows only selection
- [ ] 2.3 Manual: delete last project → redirected/locked back to `/projects`
