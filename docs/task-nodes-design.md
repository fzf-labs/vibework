# Task Nodes 方案设计（方案A，极简状态版）

## 1. 背景与目标

当前任务运行模型包含 `tasks -> workflows -> work_nodes -> agent_executions` 多层状态联动，运行链路较长，状态来源分散。

本方案目标：

1. 用最少核心实体表达任务执行。
2. 统一 `conversation` 与 `workflow` 的运行路径。
3. 节点状态只保留 4 个：`todo/in_progress/in_review/done`。
4. 每个任务在数据库层保证“同一时刻最多一个执行中节点”。

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

## 3.1 `tasks`（保留）

建议保留主字段，并去除节点级字段：

- 保留：
  - `id/title/prompt/status/task_mode/project_id/workspace_path/worktree_path/branch_name/base_branch/cost/duration/created_at/updated_at`
- 新增（可选）：
  - `started_at TEXT`
  - `completed_at TEXT`
- 移除：
  - `session_id`
  - `cli_tool_id`
  - `agent_tool_config_id`

> 会话、工具配置等执行细节统一记录在 `task_nodes`。

---

## 3.2 `task_nodes`（新）

表示任务节点快照 + 当前执行状态 + 执行结果。

```sql
CREATE TABLE IF NOT EXISTS task_nodes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,

  node_order INTEGER NOT NULL CHECK (node_order >= 1),
  node_kind TEXT NOT NULL CHECK (node_kind IN ('conversation', 'workflow')),

  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,

  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),

  session_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_task_nodes_task_status_order ON task_nodes(task_id, status, node_order);

-- 同一 task 同一时刻最多 1 个执行中的节点
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_nodes_single_in_progress
  ON task_nodes(task_id)
  WHERE status = 'in_progress';
```

设计说明：

- `task_nodes` 同时承担“节点定义”和“节点执行结果”。
- `node_order` 保证任务内顺序执行语义。
- `error_message` 承担失败信息表达，不再引入额外失败状态。

---

## 4. 状态机设计

## 4.1 Node 状态机（`task_nodes.status`）

- 初始：`todo`
- 运行：`todo -> in_progress`
- 成功：
  - 不需审批：`in_progress -> done`
  - 需审批：`in_progress -> in_review`
- 执行异常：`in_progress -> in_review`（写入 `error_message`，进入人工处理）
- 审批通过：`in_review -> done`
- 审批驳回：保持 `in_review`，更新 `error_message`

> 约定：有错误、待人工处理、审批未通过等异常态统一落在 `in_review`。

## 4.2 Task 状态聚合（`tasks.status`）

推荐聚合规则：

1. 任一节点为 `in_progress` => `tasks.status = in_progress`
2. 无 `in_progress` 且任一节点为 `in_review` => `tasks.status = in_review`
3. 全部节点为 `done` => `tasks.status = done`
4. 全部节点为 `todo` => `tasks.status = todo`
5. 其他情况（例如部分 `done` + 部分 `todo`）=> `tasks.status = in_progress`

---

## 5. 执行流程

## 5.1 创建任务

### conversation

1. 创建 `tasks`（`task_mode=conversation`）。
2. 插入 1 条 `task_nodes`：
   - `node_order=1`
   - `node_kind='conversation'`
   - `name='Conversation'`
   - `prompt=tasks.prompt`

### workflow

1. 创建 `tasks`（`task_mode=workflow`）。
2. 按模板节点快照插入 N 条 `task_nodes`（包含 `node_order/prompt/审批/容错/工具配置`）。

> 约定：`conversation` 本质是“单节点 workflow”，创建后与 workflow 使用同一套调度、审批、完成逻辑。

---

## 5.2 运行器取下一步

统一查询：

```sql
SELECT *
FROM task_nodes
WHERE task_id = ?
  AND status = 'todo'
ORDER BY node_order ASC
LIMIT 1;
```

执行时在事务中：

1. `UPDATE task_nodes SET status='in_progress', session_id=?, started_at=?, updated_at=? WHERE id=? AND status='todo'`
2. 聚合刷新 `tasks.status`

---

## 5.3 完成/异常

成功完成：

1. 按 `requires_approval` 更新 `task_nodes.status` 为 `in_review` 或 `done`
2. 回填 `cost/duration/completed_at/updated_at`
3. 若当前节点变为 `done`，可继续调度下一 `todo` 节点
4. 聚合更新 `tasks.status`

执行异常：

1. 回填 `error_message/completed_at/updated_at`
2. 统一设置 `task_nodes.status = in_review`
3. 若 `continue_on_error=1`：允许继续调度下一 `todo` 节点（当前异常节点仍保持 `in_review`）
4. 若 `continue_on_error=0`：停止在当前节点，等待人工处理
5. 聚合更新 `tasks.status`

---

## 6. 读模型（常用查询）

## 6.1 任务进度

```sql
SELECT
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS finished,
  COUNT(*) AS total
FROM task_nodes
WHERE task_id = ?;
```

## 6.2 当前节点

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

## 6.3 节点执行详情

```sql
SELECT *
FROM task_nodes
WHERE id = ?;
```

---

## 7. IPC / Service 改造建议

建议收敛到“单一运行入口（Main）”：

- 删除/废弃：
  - `createWorkflow`
  - `createWorkNode`
  - `getWorkflowByTaskId`
  - `getWorkNodesByWorkflowId`
  - `createTaskExecution`
  - `createWorkNodeExecution`
  - `getLatestAgentExecution`
- 新增：
  - `getTaskNodes(taskId)`
  - `getCurrentTaskNode(taskId)`
  - `updateTaskNodeStatus(nodeId, status)`
  - `approveTaskNode(nodeId)`
  - `startTaskExecution(taskId)`
  - `stopTaskExecution(taskId)`

状态推进统一在 Main `DatabaseService/TaskExecutionService` 完成。

---

## 8. 与现有库表对比

- 删除：`workflows`, `work_nodes`, `agent_executions`, `task_node_runs`
- 新增：`task_nodes`
- 保留：`tasks`, `workflow_templates`, `workflow_template_nodes`, `projects`, `agent_tool_configs`

> `workflow_templates` 仅作为创建任务时的快照来源，运行期不参与状态推进。

---

## 9. 无兼容前提下的落地步骤

1. 先落 DDL：新增 `task_nodes`，调整 `tasks` 字段。
2. 重写任务创建：统一写入 `task_nodes`。
3. 重写执行链：由 `task_nodes` 驱动状态流转。
4. 改造 IPC 和前端详情页读取逻辑。
5. 删除旧表、旧仓储、旧 IPC 合同。

---

## 10. 实施时还需要补齐的点

1. **状态聚合落点**：由 `TaskExecutionService` 统一更新 `tasks.status`。
2. **并发控制**：调度启动节点必须在事务内进行（并依赖 `uniq_task_nodes_single_in_progress`）。
3. **重跑策略**：若需重跑，显式提供“重置节点”接口（例如 `in_review -> todo`），而非引入运行子表。
4. **会话延续策略**：`conversation` 节点的 `session_id` 复用规则（首次创建/恢复继续）需明确。
5. **可观测性**：日志链路以 `task_node_id` 为追踪主键。

---

## 11. 最终完整 SQL DDL（无兼容前提）

下面 SQL 以“直接采用新模型”为前提，包含：

- 核心表：`projects / agent_tool_configs / tasks / workflow_templates / workflow_template_nodes / task_nodes`
- 旧表清理：`workflows / work_nodes / agent_executions / task_node_runs`
- 索引与唯一约束（含“单任务单执行中节点”）

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
DROP TABLE IF EXISTS project_settings;

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
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
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
  node_kind TEXT NOT NULL CHECK (node_kind IN ('conversation', 'workflow')),

  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,

  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),

  session_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_task_nodes_task_status_order ON task_nodes(task_id, status, node_order);

-- 同一 task 同一时刻最多 1 个执行中的节点
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_nodes_single_in_progress
  ON task_nodes(task_id)
  WHERE status = 'in_progress';

COMMIT;
```
