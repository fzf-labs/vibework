# 数据库重设计方案（对话日志外置）

本文档基于现有项目使用方式进行重设计：
- 每个 Task 代表一次对话（**1 Task = 1 Log**）。
- Task 可持有 `session_id` 作为 CLI 会话 ID（对话启动后生成）。
- 所有 Agent/CLI 对话记录不入库，统一写入文件 `~/.vibework/data/sessions/<project_id>/<task_id>.jsonl`。

重做前提（无历史迁移）：
- **不考虑旧数据迁移**，启动即使用新结构，旧数据可直接忽略/丢弃。
- **统一日志定位**：对话日志文件以 `task_id` 命名，`session_id` 仅用于 CLI 会话。

目标：
- 结构更清晰、状态更稳定。
- 去掉无用字段与冗余表。
- 字段顺序统一，便于长期维护。

---

## 核心数据流

```
project (1) → task (N)
               └→ workflow (1) → work_nodes (N) → agent_executions (N)
workflow_templates (1) → workflow_template_nodes (N)
```

## UI/状态查询（无 messages）

在移除 messages 功能后，UI 与状态仅从数据库与执行日志文件获取：
- 任务列表/看板：`tasks`（title/status/favorite/created_at 等）
- 工作流进度：`workflows.current_node_index` + `work_nodes.status`
- 当前节点展示：`work_nodes`（按 node_order 排序）
- 执行状态：`agent_executions.status`（running/completed）
- 执行日志展示：`~/.vibework/data/sessions/<project_id>/<task_id>.jsonl`（仅 Agent/CLI 输出）

---

## 执行日志存储（文件系统）

- 目录：`~/.vibework/data/sessions/<project_id>/`
- 推荐文件：`<task_id>.jsonl`
- 每行 JSON：
  - `type`（stdout/stderr/normalized/finished 等）
  - `content` / `entry` / `exit_code`
  - `tool_name` / `tool_input` / `tool_output` / `tool_use_id`
  - `created_at`
  - `schema_version`

数据库只存任务与执行结构，不再存消息明细。
仅保存 Agent/CLI 执行产生的数据到 `<task_id>.jsonl`（不再单独写 logs/sessions）；消息相关功能整体移除。

**约束说明：**
- 不再使用 `sessions` 表。
- 不再使用 `task_index`（每个 Task 即唯一对话）。

---

## 推荐表结构（SQL）

### projects（项目）

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  project_type TEXT NOT NULL DEFAULT 'normal'
    CHECK(project_type IN ('normal', 'git')),
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**变更：移除 `config` 字段**

### tasks（任务）

```sql
CREATE TABLE tasks (
  -- 主键
  id TEXT PRIMARY KEY,

  -- CLI 会话 ID（对话启动后生成）
  session_id TEXT UNIQUE,

  -- 关联
  project_id TEXT,
  workflow_template_id TEXT,
  cli_tool_id TEXT,

  -- 核心内容
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK(status IN ('todo', 'in_progress', 'in_review', 'done')),

  -- 工作目录
  workspace_path TEXT,
  worktree_path TEXT,
  branch_name TEXT,
  base_branch TEXT,

  -- 统计
  cost REAL,
  duration REAL,
  favorite INTEGER NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

**变更：**
- 保留 `session_id`，且每个 task 对应唯一 session（`UNIQUE`）。
- 移除 `task_index`（每个 task 就是一段对话）。
- 重命名 `pipeline_template_id` → `workflow_template_id`。
- **固定策略：日志文件以 `task_id` 命名，`session_id` 由 CLI 启动时生成**。

### workflow_templates（工作流模板）

```sql
CREATE TABLE workflow_templates (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('global', 'project')),
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (scope, project_id, name)
);
```

**变更：**
- 合并 `global_workflow_templates` / `project_workflow_templates`。
- 移除 `workflow_type`。
- **唯一性约束修正**：
  - 方案 A（推荐）：`scope = 'global'` 时强制 `project_id = 'global'`（固定值），保证唯一性；
  - 方案 B：使用部分唯一索引（SQLite 支持）：
    - `CREATE UNIQUE INDEX uniq_global_template_name ON workflow_templates(name) WHERE scope = 'global';`
    - `CREATE UNIQUE INDEX uniq_project_template_name ON workflow_templates(project_id, name) WHERE scope = 'project';`

### workflow_template_nodes（模板节点）

```sql
CREATE TABLE workflow_template_nodes (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  node_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  continue_on_error INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, node_order)
);
```

**变更：**
- 合并 `global_work_node_templates` / `project_work_node_templates`。

### workflows（工作流实例）

```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  current_node_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK(status IN ('todo', 'in_progress', 'done')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**变更：**
- 保留 `workflows` 表，用于追踪工作流执行进度。
- `task_id` 改为 `UNIQUE`，强制 Task 与 Workflow 1:1 关系。
- 移除 `workflow_template_scope`（可通过 `workflow_templates.scope` 查询）。
- 移除 `workflow_template_id`（模板仅在创建 task 时使用，后续以 `work_nodes` 快照为准）。

### work_nodes（工作节点实例）

```sql
CREATE TABLE work_nodes (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  template_node_id TEXT,
  node_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  continue_on_error INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK(status IN ('todo', 'in_progress', 'in_review', 'done')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE (workflow_id, node_order)
);
```

**变更：**
- 保持 `workflow_id` 关联（通过 `workflows` 表间接关联 `tasks`）。
- 新增快照字段：`name`、`prompt`、`requires_approval`、`continue_on_error`。
- 新增时间字段：`started_at`、`completed_at`。
- 快照字段在**任务创建时**从 `workflow_template_nodes` 写入，并与 `workflows`/`work_nodes` 一并插入。

### agent_executions（执行记录）

```sql
CREATE TABLE agent_executions (
  id TEXT PRIMARY KEY,
  work_node_id TEXT NOT NULL,
  execution_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK(status IN ('idle', 'running', 'completed')),
  cli_tool_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  cost REAL,
  duration REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_node_id) REFERENCES work_nodes(id) ON DELETE CASCADE,
  UNIQUE (work_node_id, execution_index)
);
```

---

## 字段说明

### projects

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 项目唯一标识 | 建议 ULID |
| name | 项目名称 | 展示用 |
| path | 项目本地路径 | 唯一 |
| project_type | 项目类型 | `normal` / `git` |
| description | 项目描述 | 可空 |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### tasks

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 任务唯一标识 | 建议 ULID |
| session_id | CLI 会话 ID | 对话启动后生成 |
| project_id | 关联项目 | 可空 |
| workflow_template_id | 选用模板 | 可空 |
| cli_tool_id | 使用的 CLI 工具 | 可空 |
| title | 任务标题 | 展示用 |
| prompt | 任务提示词 | 原始输入 |
| status | 任务状态 | `todo/in_progress/in_review/done`（`in_review` 由人工交互页面触发/确认） |
| workspace_path | 实际工作目录 | worktree 或项目路径 |
| worktree_path | git worktree 路径 | 可空 |
| branch_name | worktree 分支名 | 可空 |
| base_branch | 创建 worktree 基分支 | 可空 |
| cost | 任务成本 | 可空 |
| duration | 任务耗时 | 可空 |
| favorite | 收藏标记 | 0/1 |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### workflow_templates

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 模板唯一标识 | 建议 ULID |
| scope | 模板范围 | `global` / `project` |
| project_id | 所属项目 | `scope=project` 时必填 |
| name | 模板名称 | 同范围内唯一 |
| description | 模板描述 | 可空 |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### workflow_template_nodes

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 模板节点 ID | 建议 ULID |
| template_id | 所属模板 | 外键 `workflow_templates.id` |
| node_order | 节点顺序 | 从 1 开始 |
| name | 节点名称 | 展示用 |
| prompt | 节点提示词 | 与任务提示词合成 |
| requires_approval | 是否需要审核 | 0/1 |
| continue_on_error | 错误是否继续 | 0/1 |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### workflows

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 工作流实例 ID | 建议 ULID |
| task_id | 所属任务 | 外键 `tasks.id`，UNIQUE |
| current_node_index | 当前执行节点索引 | 从 0 开始 |
| status | 工作流状态 | `todo/in_progress/done` |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### work_nodes

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 工作节点实例 ID | 建议 ULID |
| workflow_id | 所属工作流 | 外键 `workflows.id` |
| template_node_id | 模板节点 ID | 可空（快照后续可脱钩） |
| node_order | 节点顺序 | 与模板顺序一致 |
| name | 节点名称 | 快照字段 |
| prompt | 节点提示词 | 快照字段 |
| requires_approval | 是否需要审核 | 快照字段 |
| continue_on_error | 错误是否继续 | 快照字段 |
| status | 节点状态 | `todo/in_progress/in_review/done` |
| started_at | 开始时间 | 可空 |
| completed_at | 完成时间 | 可空 |
| created_at | 创建时间 | ISO 字符串 |
| updated_at | 更新时间 | ISO 字符串 |

### agent_executions

| 字段 | 含义与作用 | 备注 |
| --- | --- | --- |
| id | 执行记录 ID | 建议 ULID |
| work_node_id | 所属工作节点 | 外键 `work_nodes.id` |
| execution_index | 第几次执行 | 从 1 开始 |
| status | 执行状态 | `idle/running/completed` |
| cli_tool_id | 使用的 CLI 工具 | 可空 |
| started_at | 开始时间 | 可空 |
| completed_at | 完成时间 | 可空 |
| cost | 执行成本 | 可空 |
| duration | 执行耗时 | 可空 |
| created_at | 创建时间 | ISO 字符串 |

---

## 推荐索引

```sql
CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_session_id ON tasks(session_id);
CREATE INDEX idx_workflows_task_id ON workflows(task_id);
CREATE INDEX idx_work_nodes_workflow_id ON work_nodes(workflow_id);
CREATE INDEX idx_agent_exec_work_node_id ON agent_executions(work_node_id);

-- workflow_templates 唯一性（方案 B：部分索引）
CREATE UNIQUE INDEX uniq_global_template_name
  ON workflow_templates(name)
  WHERE scope = 'global';
CREATE UNIQUE INDEX uniq_project_template_name
  ON workflow_templates(project_id, name)
  WHERE scope = 'project';
```

---

## 删除的表

| 表名 | 删除原因 |
|------|----------|
| `sessions` | 对话日志由 `task_id` 文件承载，无需单独 sessions 表 |
| `messages` | 对话明细外置到文件系统 |
| `global_workflow_templates` | 合并到 `workflow_templates` |
| `project_workflow_templates` | 合并到 `workflow_templates` |
| `global_work_node_templates` | 合并到 `workflow_template_nodes` |
| `project_work_node_templates` | 合并到 `workflow_template_nodes` |

---

## 完全重做策略（不迁移历史）

**适用场景：** 不需要保留旧数据，直接启用新结构。

**执行要点：**
1. 启动时删除旧数据库文件（`~/.vibework/data/vibework.db` 及 `-wal/-shm`，若存在）。
2. 初始化新表结构（本方案中的 `projects` / `tasks` / `workflows` / `workflow_templates` / `workflow_template_nodes` / `work_nodes` / `agent_executions`）。
3. 统一日志定位：创建 task 后，对话日志以 `task_id` 命名存储。
4. 创建 task 时，同时插入 `workflows` 与 `work_nodes`（从 `workflow_template_nodes` 快照写入 name/prompt/approval 等字段）。
5. 执行日志读写全部改为 JSONL 文件：
   - 写入：`~/.vibework/data/sessions/<project_id>/<task_id>.jsonl`
   - 读取：按需加载，不再通过 DB。
6. 只保留 Agent/CLI 执行日志（stdout/stderr/normalized/finished）写入 `<task_id>.jsonl`，移除 `logs/sessions` 与对应读写逻辑。
7. 删除相关旧逻辑：`sessions`/`messages`/`task_index` 及其 IPC 与 UI 调用路径。

**收益：**
- 逻辑统一、状态稳定、避免历史迁移复杂性。
- 消息存储与 CLI/Agent 记录天然一致（按 session 目录归档）。

---

## 风险点与推荐方案（按本方案执行）

- **执行日志 JSONL 字段不足**
  - 推荐：定义执行日志 schema v1（仅 Agent/CLI 数据），包含：  
    `id, task_id, session_id, type, content|entry|exit_code, tool_name, tool_input, tool_output, tool_use_id, created_at, meta, schema_version`

- **性能（轮询读取全量 JSONL）**
  - 推荐：改为“增量读取 + 订阅推送”
    1. 主进程维护 `MsgStoreService` 内存缓存 + 文件追加写。
    2. Renderer 订阅 IPC 实时推送；历史只在首次加载时读取（按 offset）。
    3. 文件增量读：保存每个 task 的 `lastOffset` 到内存/轻量索引文件。

- **不做历史迁移**
  - 约定：完全忽略旧数据（含 DB 与旧 logs/sessions），直接启用新结构。

- **路径不统一**
  - 推荐统一在 `AppPaths` 增加 `getTaskDataDir(taskId)`，路径固定到 `~/.vibework/data/sessions/<project_id>/<task_id>/`；
  - CLI 输出、agent 消息、附件都走这一个入口，避免 `~/.VibeWork` / `~/.vibework/logs` 分叉。

- **删除任务后的垃圾文件**
  - 推荐：在 `TaskService.deleteTask` 增加清理对应 task 目录或日志文件（`~/.vibework/data/sessions/<project_id>/<task_id>.jsonl`）。
