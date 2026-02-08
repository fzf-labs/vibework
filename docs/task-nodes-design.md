# Task Nodes 方案设计（方案A，极简状态版）

## 1. 背景与目标

当前任务运行模型包含 `tasks -> workflows -> work_nodes -> agent_executions` 多层状态联动，运行链路较长，状态来源分散。

本方案目标：

1. 用最少核心实体表达任务执行。
2. 统一 `conversation` 与 `workflow` 的运行路径。
3. 节点状态保留 5 个：`todo/in_progress/in_review/done/cancelled`。
4. 每个任务在数据库层保证"同一时刻最多一个执行中节点"。

---

## 2. 核心原则

### 2.1 统一执行模型

- `conversation` 任务：固定 1 个 `task_node`。
- `workflow` 任务：创建 N 个有序 `task_node`。
- 运行器统一按 `node_order` 取下一节点，不区分任务类型。

### 2.2 单表承载节点执行

- 仅保留 `task_nodes`，不再维护 `task_node_runs`。
- 节点定义、执行状态、执行结果放在同一行。
- 每个节点仅一条生命周期记录。

### 2.3 Task 状态由 Node 聚合

- `tasks.status` 仅用于任务列表与主视图展示。
- `tasks.status` 由 `task_nodes.status` 聚合计算。

---

## 3. 数据模型

### 3.1 `tasks`（保留）

建议保留主字段，并去除节点级字段：

- 保留：
  - `id/title/prompt/status/task_mode/project_id/workspace_path/worktree_path/branch_name/base_branch/created_at/updated_at`
- 新增：
  - `started_at TEXT` — 聚合自首个节点的 `started_at`
  - `completed_at TEXT` — 聚合自末个节点的 `completed_at`
  - `cost REAL` — 聚合值，等于 `SUM(task_nodes.cost)`
  - `duration REAL` — 聚合值，等于 `MAX(completed_at) - MIN(started_at)`（秒）
- 移除：
  - `session_id`
  - `cli_tool_id`
  - `agent_tool_config_id`

> 会话、工具配置等执行细节统一记录在 `task_nodes`。

#### 聚合更新时机

每次 `task_nodes` 状态变更时，由 `TaskExecutionService` 统一刷新 `tasks` 的聚合字段：

```sql
UPDATE tasks SET
  started_at  = (SELECT MIN(started_at)  FROM task_nodes WHERE task_id = ? AND started_at IS NOT NULL),
  completed_at = (SELECT MAX(completed_at) FROM task_nodes WHERE task_id = ? AND completed_at IS NOT NULL),
  cost        = (SELECT SUM(cost)         FROM task_nodes WHERE task_id = ? AND cost IS NOT NULL),
  duration    = CAST(
    (julianday((SELECT MAX(completed_at) FROM task_nodes WHERE task_id = ? AND completed_at IS NOT NULL))
     - julianday((SELECT MIN(started_at) FROM task_nodes WHERE task_id = ? AND started_at IS NOT NULL))
    ) * 86400 AS REAL
  ),
  updated_at  = ?
WHERE id = ?;
```

---

### 3.2 `task_nodes`（新）

表示任务节点快照 + 当前执行状态 + 执行结果。

与旧方案的关键差异：
- **移除 `node_kind`**：该字段与 `tasks.task_mode` 完全冗余，需要时通过 JOIN 获取。
- **新增 `review_reason`**：区分"成功待审批"、"异常待处理"、"审批驳回"三种 `in_review` 子状态。
- **新增 `result_summary`**：存储成功执行的结果摘要。
- **新增 `cancelled` 状态**：支持取消/跳过节点。

```sql
CREATE TABLE IF NOT EXISTS task_nodes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,

  node_order INTEGER NOT NULL CHECK (node_order >= 1),

  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT
    CHECK (cli_tool_id IS NULL OR cli_tool_id IN (
      'claude-code', 'cursor-agent', 'gemini-cli', 'codex-cli', 'opencode'
    )),
  agent_tool_config_id TEXT,

  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),

  review_reason TEXT
    CHECK (
      (status = 'in_review' AND review_reason IN ('approval', 'error', 'rejected'))
      OR
      (status <> 'in_review' AND review_reason IS NULL)
    ),

  session_id TEXT,
  result_summary TEXT,
  error_message TEXT,
  cost REAL,
  duration REAL,

  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
  UNIQUE (task_id, node_order)
);

CREATE INDEX IF NOT EXISTS idx_task_nodes_task_id ON task_nodes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_nodes_status ON task_nodes(status);
CREATE INDEX IF NOT EXISTS idx_task_nodes_task_status_order
  ON task_nodes(task_id, status, node_order);
CREATE INDEX IF NOT EXISTS idx_task_nodes_session_id ON task_nodes(session_id);

-- 同一 task 同一时刻最多 1 个执行中的节点
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_nodes_single_in_progress
  ON task_nodes(task_id)
  WHERE status = 'in_progress';
```

设计说明：

- `task_nodes` 同时承担"节点定义"和"节点执行结果"。
- `node_order` 保证任务内顺序执行语义。
- **移除 `node_kind`**：节点类型由 `tasks.task_mode` 决定，无需在每个节点上冗余存储。
- **`review_reason`**：当 `status = 'in_review'` 时必填，用于区分三种子状态：
  - `approval`：执行成功，等待人工审批
  - `error`：执行异常，等待人工处理
  - `rejected`：审批驳回，等待修正后重跑
- **`result_summary`**：存储成功执行的结果摘要（可选），便于在列表页快速展示。
- **`cli_tool_id` CHECK 约束**：枚举当前支持的 CLI 工具 ID，防止脏数据。
- **`cancelled` 状态**：用于用户主动取消或跳过节点。

> `review_reason` 与 `status` 的关系由 CHECK 约束强制保证。

---

## 4. 状态机设计

### 4.1 Node 状态机（`task_nodes.status`）

合法状态转换：

| 当前状态 | 目标状态 | 触发条件 | `review_reason` |
|---|---|---|---|
| `todo` | `in_progress` | 调度器启动节点 | — |
| `todo` | `cancelled` | 用户跳过节点 | — |
| `in_progress` | `done` | 执行成功 且 `requires_approval=0` | — |
| `in_progress` | `in_review` | 执行成功 且 `requires_approval=1` | `approval` |
| `in_progress` | `in_review` | 执行异常 | `error` |
| `in_progress` | `cancelled` | 用户取消执行中节点 | — |
| `in_review` | `done` | 审批通过 | 清空 |
| `in_review` | `in_review` | 审批驳回 | 更新为 `rejected` |
| `in_review` | `todo` | 重置节点（用于重跑） | 清空 |

> 约定：任何非法转换应在 Service 层抛出错误。

重置节点（重跑）时需同时清空执行相关字段：

```sql
UPDATE task_nodes SET
  status = 'todo',
  review_reason = NULL,
  session_id = NULL,
  result_summary = NULL,
  error_message = NULL,
  cost = NULL,
  duration = NULL,
  started_at = NULL,
  completed_at = NULL,
  updated_at = ?
WHERE id = ? AND status = 'in_review';
```

### 4.2 Task 状态聚合（`tasks.status`）

`tasks.status` 同样支持 5 个值：`todo/in_progress/in_review/done/cancelled`。

聚合规则（按优先级从高到低）：

| 优先级 | 节点状态组合 | Task 状态 |
|---|---|---|
| 1 | 任一节点为 `in_progress` | `in_progress` |
| 2 | 无 `in_progress`，任一节点为 `in_review` | `in_review` |
| 3 | 存在 `done` + 存在 `todo`（无 `in_progress`/`in_review`） | `in_progress` |
| 4 | 全部节点为 `done` 或 `cancelled`（至少一个 `done`） | `done` |
| 5 | 全部节点为 `cancelled` | `cancelled` |
| 6 | 全部节点为 `todo` | `todo` |
| 7 | 存在 `todo` + `cancelled`（无 `done`/`in_progress`/`in_review`） | `todo` |

聚合 SQL：

```sql
SELECT
  CASE
    WHEN SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) > 0
      THEN 'in_progress'
    WHEN SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) > 0
      THEN 'in_review'
    WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) > 0
      THEN 'in_progress'
    WHEN SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) > 0
      THEN 'done'
    WHEN SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) = COUNT(*)
         AND COUNT(*) > 0
      THEN 'cancelled'
    WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) = COUNT(*)
         AND COUNT(*) > 0
      THEN 'todo'
    WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) = 0
      THEN 'todo'
    ELSE 'todo'
  END AS task_status
FROM task_nodes
WHERE task_id = ?;
```

---

## 5. 执行流程

### 5.1 创建任务

#### conversation

1. 创建 `tasks`（`task_mode=conversation`）。
2. 插入 1 条 `task_nodes`：
   - `node_order=1`
   - `name='Conversation'`
   - `prompt=tasks.prompt`
   - `cli_tool_id` / `agent_tool_config_id` 由用户选择传入

#### workflow

1. 创建 `tasks`（`task_mode=workflow`）。
2. 按模板节点快照插入 N 条 `task_nodes`（包含 `node_order/prompt/审批/容错/工具配置`）。

> 约定：`conversation` 本质是"单节点 workflow"，创建后与 workflow 使用同一套调度、审批、完成逻辑。

---

### 5.2 运行器取下一步

统一查询：

```sql
SELECT *
FROM task_nodes
WHERE task_id = ?
  AND status = 'todo'
ORDER BY node_order ASC
LIMIT 1;
```

执行时在事务中（依赖 SQLite 单写者串行化保证）：

1. `UPDATE task_nodes SET status='in_progress', session_id=?, started_at=?, updated_at=? WHERE id=? AND status='todo'`
2. 聚合刷新 `tasks.status` 和 `tasks.started_at`

---

### 5.3 完成/异常

成功完成：

1. 按 `requires_approval` 更新 `task_nodes.status`：
   - `requires_approval=0`：`in_progress -> done`
   - `requires_approval=1`：`in_progress -> in_review`，`review_reason='approval'`
2. 回填 `result_summary/cost/duration/completed_at/updated_at`
3. 若当前节点变为 `done`，可继续调度下一 `todo` 节点
4. 聚合更新 `tasks` 的 `status/cost/duration/completed_at`

执行异常：

1. 设置 `task_nodes.status = 'in_review'`，`review_reason = 'error'`
2. 回填 `error_message/completed_at/updated_at`
3. 若 `continue_on_error=1`：允许继续调度下一 `todo` 节点（当前异常节点仍保持 `in_review`）
4. 若 `continue_on_error=0`：停止在当前节点，等待人工处理
5. 聚合更新 `tasks` 的 `status/cost/duration`

### 5.4 审批流程

审批通过：

1. `UPDATE task_nodes SET status='done', review_reason=NULL, updated_at=? WHERE id=? AND status='in_review'`
2. 继续调度下一 `todo` 节点
3. 聚合更新 `tasks`

审批驳回：

1. `UPDATE task_nodes SET review_reason='rejected', error_message=?, updated_at=? WHERE id=? AND status='in_review'`
2. 节点保持 `in_review`，等待用户决定重跑或跳过

### 5.5 重跑节点

1. 校验节点当前状态为 `in_review`
2. 清空执行相关字段，重置为 `todo`（见 4.1 重置 SQL）
3. 聚合更新 `tasks.status`
4. 调度器可重新拾取该节点

### 5.6 取消/跳过节点

1. 校验节点当前状态为 `todo` 或 `in_progress`
2. 若 `in_progress`：先停止关联的 CLI session
3. `UPDATE task_nodes SET status='cancelled', completed_at=?, updated_at=? WHERE id=?`
4. 聚合更新 `tasks.status`

---

## 6. 读模型（常用查询）

### 6.1 任务进度

```sql
SELECT
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS finished,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
  COUNT(*) AS total
FROM task_nodes
WHERE task_id = ?;
```

### 6.2 当前节点

```sql
SELECT *
FROM task_nodes
WHERE task_id = ?
  AND status IN ('in_progress', 'in_review', 'todo')
ORDER BY
  CASE status WHEN 'in_progress' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END,
  node_order ASC
LIMIT 1;
```

### 6.3 节点执行详情

```sql
SELECT * FROM task_nodes WHERE id = ?;
```

### 6.4 按状态筛选节点

```sql
SELECT * FROM task_nodes
WHERE task_id = ? AND status = ?
ORDER BY node_order ASC;
```

---

## 7. IPC / Service 改造建议

建议收敛到"单一运行入口（Main）"：

### 7.1 删除/废弃的 IPC 通道

- `db:createWorkflow`
- `db:getWorkflow`
- `db:getWorkflowByTaskId`
- `db:updateWorkflowStatus`
- `db:createWorkNode`
- `db:getWorkNodesByWorkflowId`
- `db:updateWorkNodeStatus`
- `db:approveWorkNode`
- `db:rejectWorkNode`
- `db:createTaskExecution`
- `db:createWorkNodeExecution`
- `db:getAgentExecutionsByTaskId`
- `db:getAgentExecutionsByWorkNodeId`
- `db:updateAgentExecutionStatus`
- `db:approveTask`
- `db:getLatestTaskExecution`
- `db:getLatestWorkNodeExecution`
- `db:createAgentExecution`
- `db:getLatestAgentExecution`

### 7.2 新增 IPC 通道

| 通道名 | 参数 | 说明 |
|---|---|---|
| `db:getTaskNodes` | `taskId` | 获取任务的所有节点 |
| `db:getTaskNode` | `nodeId` | 获取单个节点详情 |
| `db:getCurrentTaskNode` | `taskId` | 获取当前活跃节点 |
| `db:getTaskNodesByStatus` | `taskId, status` | 按状态筛选节点 |
| `db:approveTaskNode` | `nodeId` | 审批通过节点 |
| `db:rejectTaskNode` | `nodeId, reason` | 审批驳回节点 |
| `db:retryTaskNode` | `nodeId` | 重置节点为 todo（重跑） |
| `db:cancelTaskNode` | `nodeId` | 取消/跳过节点 |
| `task:startExecution` | `taskId` | 启动任务执行 |
| `task:stopExecution` | `taskId` | 停止任务执行 |

状态推进统一在 Main `DatabaseService/TaskExecutionService` 完成。

---

## 8. CliSessionService 改造

当前 `CliSessionService`（`src/main/services/cli/CliSessionService.ts`）的 session 生命周期与 `agent_executions` 紧密耦合。改造要点：

### 8.1 Session 与 TaskNode 绑定

- 删除 `agent_executions` 后，session 的创建和状态同步改为绑定 `task_nodes`。
- `startSession()` 接收 `taskNodeId`，不再需要 `taskId + nodeId` 组合。
- session 启动时写入 `task_nodes.session_id`。
- session 结束时回调 `TaskExecutionService` 更新节点状态。

### 8.2 Session 复用规则

- **workflow 节点**：每个节点独立 session，不复用。
- **conversation 节点**：
  - 首次执行：创建新 session，写入 `task_nodes.session_id`。
  - 恢复继续：读取 `task_nodes.session_id`，恢复已有 session（如 Claude Code 的 `--resume` 参数）。

### 8.3 状态回调

session 结束时，`CliSessionService` 通过回调通知 `TaskExecutionService`：

```typescript
interface SessionCompletionEvent {
  taskNodeId: string;
  sessionId: string;
  exitCode: number;
  cost?: number;
  duration?: number;
  resultSummary?: string;
}
```

`TaskExecutionService` 根据 `exitCode` 判断成功/异常，执行对应的状态转换。

---

## 9. 日志系统集成

### 9.1 日志关联

- 日志流（`logStream:*` IPC）通过 `session_id` 关联到 `task_nodes`。
- `task_nodes.session_id` 作为日志查询的主键。
- 前端通过 `task_node_id -> session_id -> logStream:getHistory` 获取节点日志。

### 9.2 可观测性

- 日志链路以 `task_node_id` 为追踪主键。
- 建议在日志条目中附加 `taskId` 和 `taskNodeId` 元数据，便于跨节点检索。

---

## 10. DatabaseService 改造

当前 `DatabaseService`（`src/main/services/DatabaseService.ts`）需要重写的核心方法：

### 10.1 删除的方法

- `seedWorkflowForTask()` → 替换为 `createTaskNodesFromTemplate()`
- `onTaskStarted()` → 替换为 `startNextTaskNode()`
- `completeWorkNode()` / `approveWorkNode()` / `rejectWorkNode()`
- `syncTaskStatusFromWorkflow()`
- `updateAgentExecutionStatus()`
- 所有 `WorkflowRepository` 和 `AgentRepository` 的调用

### 10.2 新增的方法

| 方法 | 职责 |
|---|---|
| `createTaskNodesFromTemplate(taskId, templateId)` | 从模板快照创建节点 |
| `createConversationNode(taskId, prompt, toolConfig)` | 创建单节点（conversation） |
| `startNextTaskNode(taskId)` | 调度下一个 todo 节点 |
| `completeTaskNode(nodeId, result)` | 节点执行完成 |
| `markTaskNodeErrorReview(nodeId, error)` | 节点执行异常并置为 in_review |
| `approveTaskNode(nodeId)` | 审批通过 |
| `rejectTaskNode(nodeId, reason)` | 审批驳回 |
| `retryTaskNode(nodeId)` | 重置节点为 todo |
| `cancelTaskNode(nodeId)` | 取消/跳过节点 |
| `syncTaskStatus(taskId)` | 聚合更新 task 状态和指标 |

### 10.3 状态推进原则

- 所有状态变更必须在事务内完成（节点状态 + task 聚合）。
- 并发控制依赖 `uniq_task_nodes_single_in_progress` 唯一索引。
- 每次节点状态变更后，必须调用 `syncTaskStatus()` 刷新 task 聚合字段。

---

## 11. 与现有库表对比

| 操作 | 表名 | 说明 |
|---|---|---|
| 删除 | `workflows` | 被 `task_nodes` 替代 |
| 删除 | `work_nodes` | 被 `task_nodes` 替代 |
| 删除 | `agent_executions` | 执行状态合并到 `task_nodes` |
| 删除 | `task_node_runs` | 不再需要运行子表 |
| 删除 | `project_settings` | 已废弃，当前代码无引用 |
| 新增 | `task_nodes` | 统一节点定义 + 执行状态 |
| 保留 | `tasks` | 调整字段（移除执行细节，新增聚合字段） |
| 保留 | `workflow_templates` | 仅作为创建任务时的快照来源 |
| 保留 | `workflow_template_nodes` | 同上 |
| 保留 | `projects` | 无变化 |
| 保留 | `agent_tool_configs` | 无变化 |

---

## 12. 无兼容前提下的落地步骤

1. 先落 DDL：新增 `task_nodes`，调整 `tasks` 字段。
2. 新增 `TaskNodeRepository`，实现节点 CRUD。
3. 重写 `DatabaseService` 中的状态推进方法（见第 10 节）。
4. 改造 `CliSessionService`，绑定 session 到 `task_nodes`（见第 8 节）。
5. 重写任务创建：统一写入 `task_nodes`。
6. 重写执行链：由 `task_nodes` 驱动状态流转。
7. 改造 IPC 通道（见第 7 节）。
8. 改造前端详情页读取逻辑。
9. 删除旧表（`workflows/work_nodes/agent_executions/task_node_runs/project_settings`）。
10. 删除旧仓储（`WorkflowRepository/AgentRepository`）及旧 IPC 通道。

---

## 13. 最终完整 SQL DDL（无兼容前提）

下面 SQL 以"直接采用新模型"为前提，包含：

- 核心表：`projects / agent_tool_configs / tasks / workflow_templates / workflow_template_nodes / task_nodes`
- 旧表清理：`workflows / work_nodes / agent_executions / task_node_runs / project_settings`
- 索引与唯一约束（含"单任务单执行中节点"）

```sql
PRAGMA foreign_keys = ON;

BEGIN;

-- =====================================================
-- 0) 清理旧结构（无兼容前提）
-- =====================================================
DROP TABLE IF EXISTS task_node_runs;
DROP TABLE IF EXISTS agent_executions;
DROP TABLE IF EXISTS work_nodes;
DROP TABLE IF EXISTS workflows;
DROP TABLE IF EXISTS project_settings;  -- 已废弃，当前代码无引用

-- =====================================================
-- 1) Agent 工具配置
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_tool_configs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_config
  ON agent_tool_configs(tool_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_default
  ON agent_tool_configs(tool_id)
  WHERE is_default = 1;

CREATE INDEX IF NOT EXISTS idx_agent_tool_configs_tool_id
  ON agent_tool_configs(tool_id);

-- =====================================================
-- 2) 项目
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (project_type IN ('normal', 'git')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

-- =====================================================
-- 3) 工作流模板（任务创建时快照来源）
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_template_name
  ON workflow_templates(name)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_template_name
  ON workflow_templates(project_id, name)
  WHERE scope = 'project';

CREATE TABLE IF NOT EXISTS workflow_template_nodes (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  node_order INTEGER NOT NULL CHECK (node_order >= 1),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
  UNIQUE (template_id, node_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_template_nodes_template_id
  ON workflow_template_nodes(template_id);

-- =====================================================
-- 4) 任务
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  task_mode TEXT NOT NULL DEFAULT 'conversation'
    CHECK (task_mode IN ('conversation', 'workflow')),

  project_id TEXT,
  worktree_path TEXT,
  branch_name TEXT,
  base_branch TEXT,
  workspace_path TEXT,

  started_at TEXT,
  completed_at TEXT,
  cost REAL,
  duration REAL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,

  CHECK (
    (worktree_path IS NULL AND branch_name IS NULL AND base_branch IS NULL)
    OR
    (worktree_path IS NOT NULL AND branch_name IS NOT NULL AND base_branch IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_worktree_path
  ON tasks(worktree_path)
  WHERE worktree_path IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_project_branch
  ON tasks(project_id, branch_name)
  WHERE project_id IS NOT NULL AND branch_name IS NOT NULL;

-- =====================================================
-- 5) 任务节点（节点定义 + 当前状态 + 执行结果）
-- =====================================================
CREATE TABLE IF NOT EXISTS task_nodes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,

  node_order INTEGER NOT NULL CHECK (node_order >= 1),

  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT
    CHECK (cli_tool_id IS NULL OR cli_tool_id IN (
      'claude-code', 'cursor-agent', 'gemini-cli', 'codex-cli', 'opencode'
    )),
  agent_tool_config_id TEXT,

  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),

  review_reason TEXT
    CHECK (
      (status = 'in_review' AND review_reason IN ('approval', 'error', 'rejected'))
      OR
      (status <> 'in_review' AND review_reason IS NULL)
    ),

  session_id TEXT,
  result_summary TEXT,
  error_message TEXT,
  cost REAL,
  duration REAL,

  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
  UNIQUE (task_id, node_order)
);

CREATE INDEX IF NOT EXISTS idx_task_nodes_task_id ON task_nodes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_nodes_status ON task_nodes(status);
CREATE INDEX IF NOT EXISTS idx_task_nodes_task_status_order
  ON task_nodes(task_id, status, node_order);
CREATE INDEX IF NOT EXISTS idx_task_nodes_session_id ON task_nodes(session_id);

-- 同一 task 同一时刻最多 1 个执行中的节点
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_nodes_single_in_progress
  ON task_nodes(task_id)
  WHERE status = 'in_progress';

COMMIT;
```
