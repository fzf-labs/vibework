## Context
任务创建流程需要扩展字段（标题、CLI、工作区、分支）并强制 Git 项目使用 worktree。同时需要引入可复用的任务流水线模板，按环节提示词串行执行并在每环节完成后等待人工确认。流水线模板需要集中管理（项目模板与全局模板分离），创建任务仅选择模板。创建任务对话框需要多语言文案支持。

## Goals / Non-Goals
- Goals:
  - 任务创建支持标题、提示词、CLI、工作区/分支、可选流水线模板。
  - Git 项目创建任务强制 worktree，并记录基础分支与工作区。
  - 流水线模板（全局 + 项目）持久化到数据库，可复用。
  - 提供独立的流水线模板管理页面：项目模板在左侧导航入口管理；全局模板在设置页管理。
  - 流水线执行：按提示词环节串行执行，环节完成需人工确认；失败后可手动继续。
  - 创建任务对话框本地化。
- Non-Goals:
  - 不引入新的 CLI 工具类型（仅使用已检测工具）。
  - 不在本次变更中实现跨项目共享/同步模板。
  - 不改变现有任务详情页整体布局。

## Decisions
- 数据存储使用数据库（SQLite），新增流水线模板与任务创建元数据字段。
- 任务创建时必须填写标题；提示词保留现有用途。
- CLI 选择范围为已检测工具；若用户未选择，使用全局默认 CLI（存于 settings）。
- Git 项目创建任务必须基于用户选择的基础分支创建 worktree 分支；工作区路径只读展示。
- 流水线环节以“提示词”作为执行输入；每个环节完成后进入待确认状态。
- 失败环节不自动推进；用户通过聊天触发继续，系统记录失败状态并允许进入下一环节。
- 项目模板在左侧独立页面管理；全局模板在设置页独立页面管理；创建任务仅选择模板，不在对话框内创建/编辑模板。

## Data Model Changes
- tasks 表新增字段：
  - title (TEXT, required)
  - cli_tool_id (TEXT, nullable)
  - base_branch (TEXT, git 项目创建时必填)
  - workspace_path (TEXT, 记录实际工作区路径)
  - pipeline_template_id (TEXT, nullable)
- 新增表（命名调整）：
  - global_task_pipeline_templates (id, name, description, created_at, updated_at)
  - global_task_pipeline_template_stages (id, template_id, stage_order, name, prompt, requires_approval, continue_on_error)
  - projects_task_pipeline_templates (id, project_id, name, description, created_at, updated_at)
  - projects_task_pipeline_template_stages (id, template_id, stage_order, name, prompt, requires_approval, continue_on_error)
  - pipeline_executions (id, task_id, template_id, status, started_at, completed_at)
  - pipeline_stage_executions (id, execution_id, stage_id, status, started_at, completed_at, error)

## Execution Flow
1) 用户打开创建任务对话框，填写标题与提示词。
2) 系统加载已检测 CLI，并预选全局默认 CLI。
3) 普通项目：工作区显示项目目录。
4) Git 项目：用户选择基础分支，系统创建 worktree 分支并显示 worktree 路径。
5) 用户可选项目流水线模板；若未选则任务为单步执行。
6) 任务启动后，如有流水线模板：按 stage_order 串行执行每个提示词环节。
7) 每个环节完成后进入待确认状态；用户确认后继续下一环节。
8) 环节失败后，执行暂停；用户通过聊天触发继续，进入下一环节并保留失败记录。

## Risks / Trade-offs
- 数据迁移：新增字段与表需要平滑迁移。
- 状态一致性：流水线执行状态与任务状态同步需要一致的更新策略。
- 默认 CLI 缺省：未配置默认 CLI 时需明确回退策略。

## Open Questions
- 全局模板设置页的入口位置与交互是否需要与现有设置分组对齐？
