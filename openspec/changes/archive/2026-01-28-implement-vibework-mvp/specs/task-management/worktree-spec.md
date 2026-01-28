## ADDED Requirements

### Requirement: Git Worktree Integration
系统 SHALL 为每个任务创建独立的 Git worktree。

#### Scenario: Create worktree for task
- **WHEN** 任务状态变为 IN_PROGRESS
- **THEN** 系统在 .worktrees/task-{id} 创建新 worktree

#### Scenario: Remove worktree on completion
- **WHEN** 任务状态变为 DONE 且用户确认
- **THEN** 系统删除对应的 worktree
