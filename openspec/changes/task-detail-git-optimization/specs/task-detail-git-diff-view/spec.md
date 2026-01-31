## ADDED Requirements

### Requirement: Render changed files with headers
系统 MUST 在任务详情页的 Git diff 视图中展示所有变更文件，并为每个文件渲染清晰的文件头信息（文件路径、变更类型、增删行数）。

#### Scenario: Display headers for multiple changed files
- **WHEN** 任务工作区存在多个变更文件
- **THEN** 每个文件的 diff 区块都显示文件路径、变更类型与增删统计

### Requirement: Provide readable diff lines with markers and line numbers
系统 MUST 以清晰的行级视图呈现 diff 内容，包含行号与增删标记，便于快速定位改动位置。

#### Scenario: Render line markers for additions and deletions
- **WHEN** diff 内容包含新增与删除行
- **THEN** 视图中对应行显示增删标记与行号

### Requirement: Syntax highlight diff content
系统 MUST 对 diff 内容进行语法高亮，以提升代码可读性。

#### Scenario: Highlight code within diff
- **WHEN** diff 中包含源码片段
- **THEN** 视图以语法高亮样式呈现代码

### Requirement: Handle empty and error states
系统 MUST 在无变更或无法获取 diff 的情况下提供明确的空状态或错误提示。

#### Scenario: Show empty state when no changes
- **WHEN** 任务工作区没有任何变更
- **THEN** diff 视图显示“无变更”的空状态提示

#### Scenario: Show error state when diff unavailable
- **WHEN** diff 数据获取失败或当前目录非 Git 仓库
- **THEN** diff 视图显示错误状态提示并说明原因
