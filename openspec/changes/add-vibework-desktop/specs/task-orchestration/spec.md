# Task Orchestration Specification

## ADDED Requirements

### Requirement: 任务创建和管理
应用 SHALL 支持创建、编辑和删除开发任务。

#### Scenario: 创建新任务
- **WHEN** 用户点击"新建任务"并填写任务信息(标题、描述、基础分支)
- **THEN** 创建任务记录,初始状态为"To Do",并自动创建对应的git worktree

#### Scenario: 编辑任务信息
- **WHEN** 用户修改任务的标题或描述
- **THEN** 更新任务记录并保存到项目配置

#### Scenario: 删除任务
- **WHEN** 用户删除任务
- **THEN** 提示是否删除关联的worktree,确认后清理任务数据

### Requirement: 任务状态管理
应用 SHALL 支持任务的4个状态:To Do、In Progress、In Review、Done。

#### Scenario: 任务状态转换
- **WHEN** 用户拖拽任务卡片或手动更改状态
- **THEN** 任务状态在To Do -> In Progress -> In Review -> Done之间转换

#### Scenario: 开始任务
- **WHEN** 用户将任务从"To Do"移动到"In Progress"
- **THEN** 任务状态更新为"In Progress",记录开始时间

#### Scenario: 提交审查
- **WHEN** 用户将任务从"In Progress"移动到"In Review"
- **THEN** 任务状态更新为"In Review",触发审查通知

#### Scenario: 完成任务
- **WHEN** 用户将任务从"In Review"移动到"Done"
- **THEN** 任务状态更新为"Done",记录完成时间,触发完成通知

### Requirement: Git Worktree自动管理
应用 SHALL 为每个任务自动创建和管理独立的git worktree。

#### Scenario: 创建任务时生成worktree
- **WHEN** 创建新任务
- **THEN** 在.worktrees/task-{id}目录创建worktree,基于指定的基础分支

#### Scenario: 切换到任务worktree
- **WHEN** 用户打开任务详情
- **THEN** CLI工具的工作目录自动切换到该任务的worktree路径

#### Scenario: 清理完成的worktree
- **WHEN** 任务标记为完成
- **THEN** 提示用户是否删除worktree,选择"是"后执行git worktree remove

### Requirement: 任务流水线配置
应用 SHALL 支持为任务配置自定义流水线,定义多个执行环节。

#### Scenario: 创建流水线模板
- **WHEN** 用户在设置中创建流水线模板(如"功能开发流程")
- **THEN** 保存流水线配置,包含环节名称、描述、执行命令

#### Scenario: 应用流水线到任务
- **WHEN** 用户创建任务时选择流水线模板
- **THEN** 任务关联该流水线,显示所有环节列表

### Requirement: 流水线环节执行
应用 SHALL 按顺序执行流水线的各个环节,每个环节完成后等待人工确认。

#### Scenario: 启动流水线
- **WHEN** 用户点击"开始流水线"
- **THEN** 从第一个环节开始执行,环节状态变为"In Progress"

#### Scenario: 环节执行完成
- **WHEN** 当前环节执行完成
- **THEN** 环节状态变为"In Review",显示确认按钮和拒绝按钮

#### Scenario: 用户确认环节
- **WHEN** 用户点击"确认"按钮
- **THEN** 当前环节状态标记为"Done",自动进入下一环节(状态变为"In Progress")

#### Scenario: 用户拒绝环节
- **WHEN** 用户点击"拒绝"按钮
- **THEN** 当前环节状态回退到"To Do",流水线暂停,等待用户修复后重新执行

#### Scenario: 流水线全部完成
- **WHEN** 最后一个环节状态变为"Done"
- **THEN** 任务状态自动更新为"Done",流水线状态变为"完成"

### Requirement: 流水线环节状态管理
应用 SHALL 为每个流水线环节维护状态:To Do、In Progress、In Review、Done。

#### Scenario: 环节状态显示
- **WHEN** 用户查看流水线进度
- **THEN** 显示每个环节的当前状态和状态图标

#### Scenario: 跳过环节
- **WHEN** 用户选择跳过某个环节
- **THEN** 该环节状态直接标记为"Done",进入下一环节

### Requirement: 任务看板
应用 SHALL 提供看板视图,可视化管理项目中的所有任务。

#### Scenario: 显示看板列
- **WHEN** 用户打开任务看板
- **THEN** 显示"To Do"、"In Progress"、"In Review"、"Done"四列

#### Scenario: 拖拽任务卡片
- **WHEN** 用户拖拽任务卡片到不同列
- **THEN** 更新任务状态并保存

#### Scenario: 任务卡片详情
- **WHEN** 用户点击任务卡片
- **THEN** 显示任务详情面板,包含描述、流水线进度、关联的worktree路径
