# Change: Add Git settings tab

## Why
Users need a simple place to confirm Git availability and configure the branch prefix used when creating new worktree branches.

## What Changes
- Add a new Settings category/tab labeled "Git".
- Show Git installation status (installed/not installed) in the Git settings tab.
- Add a global, non-empty worktree branch prefix setting with default value "vw-".
- Apply the configured prefix when creating new Git worktree branches.

## Impact
- Affected specs: git-settings (new), agent-cli-settings (no change).
- Affected code: settings UI, settings storage, Git detection IPC, task/worktree creation.
