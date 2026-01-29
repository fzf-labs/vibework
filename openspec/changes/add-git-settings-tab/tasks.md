## 1. Implementation
- [ ] 1.1 Add Git settings model defaults (worktree prefix "vw-") and persistence handling.
- [ ] 1.2 Implement Git installation detection in the main process and expose via IPC.
- [ ] 1.3 Add Git settings tab UI with install status and prefix input + validation.
- [ ] 1.4 Apply the configured prefix when creating new worktree branches.
- [ ] 1.5 Add localization strings for Git settings UI (en/zh).
- [ ] 1.6 Manual validation: open Settings → Git tab, verify install status; change prefix and ensure persistence; attempt empty prefix and confirm it is blocked; create a Git task and confirm the branch name starts with the configured prefix.
