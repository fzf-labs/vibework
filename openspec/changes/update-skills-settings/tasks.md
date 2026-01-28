## 1. Implementation
- [x] 1.1 Implement CLI skills scanning using user-level directories (e.g. `~/.claude/skills`) with local FS access.
- [x] 1.2 Update settings defaults/types to remove `skillsEnabled` and set the app-managed skills path to `~/.vibework/skills`.
- [x] 1.3 Update skills config plumbing to always return an enabled skills config (no global toggle).
- [x] 1.4 Update the Skills settings UI to remove the enable switch, show app-managed skills from `~/.vibework/skills`, and add per-CLI global skills lists (name/description).
- [x] 1.5 Update locale strings and empty-state copy for the new skills sections.
- [x] 1.6 Validate manually in the Settings UI and run `openspec validate update-skills-settings --strict --no-interactive`.
