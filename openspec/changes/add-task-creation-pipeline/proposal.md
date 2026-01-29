# Change: Add richer task creation and pipeline templates

## Why
- 任务创建需要规范化标题、CLI、工作区/分支信息，确保任务上下文清晰。
- 任务需要可复用的流水线模板，并按环节串行执行与人工确认。
- 流水线模板需要集中管理（项目模板与全局模板分离），新建任务仅选择模板。
- 创建任务对话框需要支持多语言文案。

## What Changes
- 创建任务时新增必填“任务标题”，保留提示词，并支持后续编辑。
- 任务创建支持选择已检测的 CLI，默认选中全局默认 CLI。
- Git 项目创建任务时强制使用 worktree，并要求选择基础分支；普通项目工作区为项目目录。
- 任务可选关联流水线模板（空=单步执行）；流水线按环节提示词串行执行，每环节完成后等待人工确认；失败后可通过聊天触发继续。
- 流水线模板管理从创建任务对话框中拆出：左侧新增“任务流水线模板”入口，仅管理项目模板；全局模板在设置中单独页面维护。
- 数据库存储流水线模板，表命名调整为 `global_task_pipeline_templates` 与 `projects_task_pipeline_templates`。
- 创建任务对话框文案使用多语言配置。

## Impact
- Affected specs: `task-management`, `left-sidebar-navigation`, 新增 `task-pipeline` 能力（含管理页面）。
- Affected code: 左侧导航、流水线模板管理 UI（项目/全局）、任务创建 UI、任务与流水线数据结构与 DB 迁移、Pipeline 执行逻辑、CLI 默认配置与本地化文案。
