## 1. Project skills settings storage

- [x] 1.1 Add project-level skills settings storage (DB column or project_settings table) and update project types
- [x] 1.2 Expose IPC/data-layer helpers to read and update project skills settings from the renderer

## 2. Skills discovery utilities

- [x] 2.1 Extract skills directory scanning + SKILL.md frontmatter parsing into a shared utility
- [x] 2.2 Add project skills directory resolution (project root + runtime directories + optional .vibework/skills) and source metadata

## 3. Project Skills page UI

- [x] 3.1 Implement SkillsPage layout with current project context and no-project empty state
- [x] 3.2 Render project skills list with actions (refresh/open folder/delete) and source indicators
- [x] 3.3 Add GitHub import (and optional copy-from-global) targeting the project skills directory

## 4. Agent configuration integration

- [x] 4.1 Extend skillsConfig to include project skill paths + enable flags
- [x] 4.2 Update agent invocation to inject project skills with higher precedence than global

## 5. Validation

- [ ] 5.1 Smoke-test project skills discovery, import, delete, and task execution with project skills enabled
