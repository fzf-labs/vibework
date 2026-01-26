# Git Operations Specification

## ADDED Requirements

### Requirement: Git Diff可视化
应用 SHALL 提供可视化的Git diff界面,展示文件变更。

#### Scenario: 显示工作区变更
- **WHEN** 用户打开Git面板
- **THEN** 显示当前worktree的所有变更文件列表

#### Scenario: 查看文件diff
- **WHEN** 用户点击变更文件
- **THEN** 显示并排diff视图,左侧为旧版本,右侧为新版本

#### Scenario: 暂存文件
- **WHEN** 用户勾选文件并点击"暂存"
- **THEN** 执行git add,文件移动到暂存区列表

### Requirement: Git Merge操作
应用 SHALL 支持分支合并操作,提供冲突解决界面。

#### Scenario: 选择合并分支
- **WHEN** 用户点击"合并分支"并选择源分支
- **THEN** 执行git merge,显示合并进度

#### Scenario: 检测合并冲突
- **WHEN** 合并过程中发生冲突
- **THEN** 显示冲突文件列表,提供冲突解决界面

#### Scenario: 解决冲突
- **WHEN** 用户在冲突解决界面选择保留的版本
- **THEN** 更新文件内容,标记冲突已解决

### Requirement: Pull Request创建
应用 SHALL 支持创建Pull Request到远程仓库。

#### Scenario: 填写PR信息
- **WHEN** 用户点击"创建PR"
- **THEN** 显示PR表单,包含标题、描述、目标分支选择

#### Scenario: 提交PR
- **WHEN** 用户填写完成并提交
- **THEN** 调用Git托管平台API创建PR,显示PR链接

### Requirement: Git Rebase操作
应用 SHALL 支持交互式rebase操作。

#### Scenario: 启动rebase
- **WHEN** 用户选择"变基到"并选择目标分支
- **THEN** 执行git rebase,显示提交列表

#### Scenario: 处理rebase冲突
- **WHEN** rebase过程中发生冲突
- **THEN** 暂停rebase,显示冲突解决界面,提供"继续"和"中止"选项
