# 任务双模式改造开发文档（无迁移版）

> 文档目的：用于**直接指导开发实现**。  
> 约束：**不考虑历史数据迁移，不考虑回滚方案**。

## 1. 目标与范围

本次改造实现以下业务能力：

1. **一个 Git 任务一个 worktree**。
2. **每个工作节点可指定 agent cli 与配置**（节点级执行器）。
3. 任务分为两种模式：
   - **对话模式（conversation）**：自由对话执行；可选 CLI 工具与 CLI 配置。
   - **工作流模式（workflow）**：按预设工作流节点执行。

已确认的结构裁剪：

- 删除 `tasks.agent_tool_config_snapshot`
- 删除 `tasks.workflow_template_id`
- 删除 `tasks.favorite`
- 删除 `work_nodes.template_node_id`

## 2. 数据库目标结构

数据库目标结构以以下 SQL 为准：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/docs/task-mode-schema-review.sql`

关键点（实现时必须对齐）：

- `tasks.task_mode`：`conversation | workflow`
- `tasks` 不再存 `workflow_template_id`
- `work_nodes` 仅保留执行快照（无 `template_node_id`）
- `agent_executions` 同时支持：
  - conversation：`task_id + execution_scope=conversation + work_node_id is null`
  - workflow：`task_id + execution_scope=workflow + work_node_id not null`

## 3. 实施原则（无迁移模式）

1. 以“新结构”为唯一目标，不做兼容旧字段逻辑。
2. `DatabaseConnection.initTables()` 直接按新 DDL 创建。
3. 代码中所有对已删除字段的读写、类型定义、UI 展示全部清理。
4. 工作流运行逻辑只依赖 `work_nodes` 快照字段，不再回查模板节点映射。

## 4. 开发改造任务拆解

## 4.1 Main：数据库 Schema 与 Type 定义

### A. 更新建表逻辑

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/database/DatabaseConnection.ts`

改造点：
- `tasks`：
  - 新增：`task_mode`
  - 删除：`workflow_template_id`、`favorite`、`agent_tool_config_snapshot`
- `workflow_template_nodes`：新增 `cli_tool_id`、`agent_tool_config_id`
- `work_nodes`：
  - 删除：`template_node_id`
  - 新增：`cli_tool_id`、`agent_tool_config_id`
- `agent_executions`：
  - 新增：`task_id`、`execution_scope`
  - `work_node_id` 改为可空
  - 增加对应约束与部分唯一索引
- 索引同步到新 schema。

### B. 更新 DB 类型

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/types/db/task.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/types/db/workflow.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/types/db/agent.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/types/domain/task.ts`

改造点：
- `DbTask/CreateTaskInput/UpdateTaskInput`：新增 `task_mode`，删除已裁剪字段。
- `DbWorkNode`：删除 `template_node_id`，补齐节点级执行器字段。
- `DbWorkNodeTemplate`：补充模板节点执行器字段。
- `DbAgentExecution`：补充 `task_id`、`execution_scope`、`work_node_id nullable`。
- `CreateTaskOptions/TaskWithWorktree` 对齐新字段（去 `favorite/workflowTemplateId/agentToolConfigSnapshot`）。

## 4.2 Main：Repository 与 Service

### A. TaskRepository

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/database/TaskRepository.ts`

改造点：
- `createTask/updateTask/select` SQL 删除废弃列。
- 新增/维护 `task_mode` 的写入与查询。
- 删除 `favorite` 相关布尔转换逻辑。

### B. WorkflowRepository

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/database/WorkflowRepository.ts`

改造点：
- 模板节点增 `cli_tool_id/agent_tool_config_id` 的存取。
- `insertWorkNode` 不再接收/写入 `template_node_id`。
- `work_nodes` 写入节点快照：`name/prompt/requires_approval/continue_on_error/cli_tool_id/agent_tool_config_id`。

### C. AgentRepository

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/database/AgentRepository.ts`

改造点：
- 新增两套创建接口：
  - `createTaskExecution(taskId, sessionId?, cliToolId?, agentToolConfigId?)`
  - `createWorkNodeExecution(taskId, workNodeId, sessionId?, cliToolId?, agentToolConfigId?)`
- 查询接口拆分：
  - `getLatestTaskExecution(taskId)`
  - `getLatestWorkNodeExecution(workNodeId)`
- `execution_index` 生成逻辑按 scope 分别递增。

### D. DatabaseService

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/DatabaseService.ts`

改造点：
- 暴露新的 execution service API（task 级、worknode 级）。
- 任务启动逻辑按 `task_mode` 分支：
  - `conversation`：不创建 workflow
  - `workflow`：按模板快照初始化 workflow/work_nodes

### E. TaskService

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/services/TaskService.ts`

改造点：
- `createTask(options)` 增 `taskMode`。
- `workflowTemplateId` 只作为创建时入参，不落 `tasks`。
- `mapTask` 删除 `favorite/workflowTemplateId/agentToolConfigSnapshot` 映射。

## 4.3 Main：IPC 合约与路由

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/ipc/task.ipc.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/ipc/database.ipc.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/main/ipc/channels.ts`

改造点：
- `task.create` 参数新增 `taskMode`（必填），保留 `workflowTemplateId` 但仅用于 workflow 模式创建。
- execution IPC 从“仅 workNodeId”改为同时支持 task/worknode 两类入口与查询。
- Type contract 全量更新。

## 4.4 Renderer：数据模型与 API 适配

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/data/types.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/data/adapter.ts`

改造点：
- `Task` 类型删除：`favorite/workflow_template_id/agent_tool_config_snapshot`。
- 新增 `task_mode`。
- execution API 调整为 task/worknode 双通道。

## 4.5 Renderer：任务创建与详情页逻辑

### A. CreateTaskDialog

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/components/task/CreateTaskDialog.tsx`

改造点：
- 增加任务模式选择（对话模式 / 工作流模式）。
- 表单约束：
  - conversation：必填 CLI + CLI 配置 + 分支
  - workflow：必填分支 + workflowTemplate
- 提交 payload 增 `taskMode`。

### B. TaskDetail useTaskDetail

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/pages/task-detail/useTaskDetail.tsx`

改造点：
- 删除 `template_node_id/work_node_template_id` 的兼容逻辑。
- `resolveWorkNodePrompt` 改为仅按 `workNodeId/nodeIndex` 获取 `work_nodes.prompt`。
- `WorkflowCurrentNode` 去掉 `templateId` 依赖。
- workflow 卡片展示只使用 `work_nodes` 快照字段（`name/prompt`）。

### C. TaskDetail 类型与对话框

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/pages/task-detail/types.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/pages/task-detail/components/TaskDialogs.tsx`

改造点：
- 类型移除 `template_node_id/work_node_template_id/templateId`。
- 编辑弹窗字段按 `task_mode` 切换展示与可编辑性。

### D. BoardPage 与相关类型

文件：
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework/src/renderer/src/pages/board/BoardPage.tsx`

改造点：
- 清理 `favorite` 字段依赖。
- `TaskWithWorktree` 类型对齐最新结构。

## 5. 执行流程落地规则

### 5.1 Conversation 模式

1. 创建任务（含 worktree、branch、cli/config）。
2. 启动时创建 `agent_executions(scope=conversation, task_id=...)`。
3. 执行状态、成本、耗时写入 task 级 execution。

### 5.2 Workflow 模式

1. 创建任务时根据选中模板创建 `workflows + work_nodes`（快照写入）。
2. 每次节点执行前创建 `agent_executions(scope=workflow, task_id, work_node_id)`。
3. 节点状态推进驱动任务状态推进。

## 6. 交付验收清单

### 功能验收

1. 新建 conversation 任务：可创建 worktree，可正常自由对话执行。
2. 新建 workflow 任务：创建后自动有 workflow/work_nodes。
3. workflow 每个节点可使用指定 CLI 与配置执行。
4. 删除任务时相关 worktree 与执行数据正确清理。

### 数据验收

1. `tasks` 无 `workflow_template_id/favorite/agent_tool_config_snapshot`。
2. `work_nodes` 无 `template_node_id`。
3. `agent_executions` 同时存在 conversation/workflow 两类记录。
4. 唯一索引生效：
   - `uniq_tasks_worktree_path`
   - `uniq_agent_exec_task_idx`
   - `uniq_agent_exec_work_node_idx`

### 代码验收

1. `pnpm -C /Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework typecheck` 通过。
2. `pnpm -C /Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework lint` 通过。
3. 关键页面（Board、CreateTaskDialog、TaskDetail）手工冒烟通过。

## 7. 开发顺序（建议）

1. 先改 Schema 与 Main types。
2. 再改 Repository/Service/IPC。
3. 再改 Renderer types + 业务页面。
4. 最后统一跑 typecheck/lint + 冒烟。

---

如无额外调整，开发以本文件 + `task-mode-schema-review.sql` 作为唯一实现依据。
