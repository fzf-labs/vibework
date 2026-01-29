## ADDED Requirements
### Requirement: Pipeline template storage
系统 SHALL 在数据库中持久化存储流水线模板，包含全局模板与项目模板。

#### Scenario: Create project template from global template
- **WHEN** 用户选择全局模板并在某项目中创建模板
- **THEN** 系统复制模板内容并保存为该项目的模板记录

### Requirement: Project pipeline template management
系统 SHALL 提供独立页面管理项目流水线模板的增删改查。

#### Scenario: Manage project templates
- **WHEN** 用户在项目流水线模板页面创建或编辑模板
- **THEN** 系统保存项目模板及其环节定义
- **AND** 用户可以删除不再需要的项目模板

### Requirement: Global pipeline template management
系统 SHALL 在设置中提供全局流水线模板页面，支持增删改查。

#### Scenario: Manage global templates in settings
- **WHEN** 用户在设置中的全局模板页面新增、编辑或删除模板
- **THEN** 系统持久化更新全局模板与环节定义

### Requirement: Pipeline stage definition
系统 SHALL 将流水线模板定义为按顺序排列的提示词环节列表。

#### Scenario: Ordered prompt stages
- **WHEN** 用户保存模板并定义多个环节
- **THEN** 每个环节包含顺序与提示词内容
- **AND** 系统以顺序字段决定执行顺序

### Requirement: Pipeline execution with approvals
系统 SHALL 在任务启动时按环节顺序执行提示词，并在每个环节完成后进入待确认状态。

#### Scenario: Stage completion requires approval
- **WHEN** 某环节执行完成
- **THEN** 流水线暂停并等待用户确认后再执行下一环节

### Requirement: Manual continuation after failure
系统 SHALL 在环节失败后停止自动推进，并允许用户通过聊天触发继续执行后续环节。

#### Scenario: Continue after failure
- **WHEN** 某环节执行失败且用户在聊天中触发继续
- **THEN** 系统进入下一环节并记录失败状态
