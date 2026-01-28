# git-visualization Specification

## Purpose
TBD - created by archiving change implement-vibework-mvp. Update Purpose after archive.
## Requirements
### Requirement: Diff Visualization
系统 SHALL 以可视化方式展示 Git diff 内容。

#### Scenario: Show file diff
- **WHEN** 用户选择查看文件差异
- **THEN** 系统以语法高亮方式展示增删行

#### Scenario: Show staged diff
- **WHEN** 用户查看已暂存的变更
- **THEN** 系统展示 staged 状态的 diff

