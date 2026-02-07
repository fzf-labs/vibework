-- Vibework 数据库改造（评审稿）
-- 日期: 2026-02-07
-- 目的: 仅用于评审确认，不直接执行到生产数据库
--
-- 已按当前确认点调整:
-- 1) 删除 tasks.agent_tool_config_snapshot
-- 2) 删除 work_nodes.template_node_id
-- 3) 保留 "1 Git 任务 = 1 Worktree" 的约束能力（通过唯一索引）

PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. Agent 配置
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

-- =====================================================
-- 2. 项目
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'normal' CHECK (project_type IN ('normal', 'git')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =====================================================
-- 3. 工作流模板
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

-- 模板节点可指定默认执行器（每个节点可不同 CLI）
CREATE TABLE IF NOT EXISTS workflow_template_nodes (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  node_order INTEGER NOT NULL,
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

-- =====================================================
-- 4. 任务（对话模式 / 工作流模式）
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  task_mode TEXT NOT NULL CHECK (task_mode IN ('conversation', 'workflow')),

  project_id TEXT,
  worktree_path TEXT,
  branch_name TEXT,
  base_branch TEXT,
  workspace_path TEXT,

  cli_tool_id TEXT,
  agent_tool_config_id TEXT,

  cost REAL,
  duration REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,

  -- 约束：
  -- 对话模式: 必须选择 CLI
  -- 工作流模式: 不在 tasks 存模板引用，任务创建时直接快照写入 workflows/work_nodes
  CHECK (
    (task_mode = 'conversation' AND cli_tool_id IS NOT NULL)
    OR
    (task_mode = 'workflow')
  ),

  -- 约束：Git 相关字段一致性
  CHECK (
    (worktree_path IS NULL AND branch_name IS NULL AND base_branch IS NULL)
    OR
    (worktree_path IS NOT NULL AND branch_name IS NOT NULL AND base_branch IS NOT NULL)
  )
);

-- 1 Git 任务 = 1 Worktree（同一路径不能被多个任务复用）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_worktree_path
  ON tasks(worktree_path)
  WHERE worktree_path IS NOT NULL;

-- 同一项目下，一个分支只对应一个任务（可按业务决定是否保留）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_project_branch
  ON tasks(project_id, branch_name)
  WHERE project_id IS NOT NULL AND branch_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);

-- =====================================================
-- 5. 工作流实例
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  current_node_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflows_task_id ON workflows(task_id);

-- 注意：本版已删除 template_node_id，work_nodes 仅保留执行快照
CREATE TABLE IF NOT EXISTS work_nodes (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  node_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  continue_on_error INTEGER NOT NULL DEFAULT 0 CHECK (continue_on_error IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
  UNIQUE (workflow_id, node_order)
);

CREATE INDEX IF NOT EXISTS idx_work_nodes_workflow_id ON work_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_work_nodes_status ON work_nodes(status);

-- =====================================================
-- 6. 执行记录
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  work_node_id TEXT,
  execution_scope TEXT NOT NULL CHECK (execution_scope IN ('conversation', 'workflow')),
  execution_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed')),
  session_id TEXT,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  cost REAL,
  duration REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (work_node_id) REFERENCES work_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,

  -- conversation: task 级执行，无 work_node_id
  -- workflow: 节点级执行，必须有 work_node_id
  CHECK (
    (execution_scope = 'conversation' AND work_node_id IS NULL)
    OR
    (execution_scope = 'workflow' AND work_node_id IS NOT NULL)
  )
);

-- 对话模式：同一个 task 的执行序号唯一
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_exec_task_idx
  ON agent_executions(task_id, execution_index)
  WHERE work_node_id IS NULL;

-- 工作流模式：同一个 work_node 的执行序号唯一
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_exec_work_node_idx
  ON agent_executions(work_node_id, execution_index)
  WHERE work_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_exec_task_id ON agent_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_exec_work_node_id ON agent_executions(work_node_id);
CREATE INDEX IF NOT EXISTS idx_agent_exec_session_id ON agent_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_exec_scope ON agent_executions(execution_scope);

-- =====================================================
-- 迁移提醒（仅文档说明，不直接执行）
-- =====================================================
-- 1) tasks: 删除列 agent_tool_config_snapshot
-- 2) work_nodes: 删除列 template_node_id
-- 3) 前端/服务层改为仅按 work_nodes.id + node_order 驱动，不再依赖 template_node_id
-- 4) agent_executions: 新增 task_id + execution_scope，work_node_id 改为可空
