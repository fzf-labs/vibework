## ADDED Requirements
### Requirement: Task creation metadata
系统 SHALL 在创建任务时要求任务标题与提示词，并记录 CLI、工作区、分支与可选流水线模板。

#### Scenario: Create task for normal project
- **WHEN** 用户在普通项目中创建任务并填写标题与提示词
- **THEN** 系统保存标题与提示词
- **AND** 工作区设置为项目目录
- **AND** CLI 选择默认使用全局默认 CLI（若用户未显式选择）
- **AND** 流水线模板仅从模板列表选择（可为空）
- **AND** 未选择流水线模板时任务视为单步执行

#### Scenario: Create task for git project
- **WHEN** 用户在 Git 项目中创建任务并选择基础分支
- **THEN** 系统基于该分支创建 worktree 分支并保存 worktree 路径
- **AND** 记录任务分支名称与工作区路径

#### Scenario: Create task with pipeline template
-- **WHEN** 用户为任务从模板列表选择项目流水线模板
-- **THEN** 系统将模板关联到任务并按模板环节准备执行

### Requirement: Task creation dialog localization
创建任务对话框 SHALL 使用多语言文案渲染标签、占位符与按钮。

#### Scenario: User views create task dialog in selected language
- **WHEN** 用户切换应用语言为 en-US 或 zh-CN
- **THEN** 创建任务对话框文案显示为对应语言
