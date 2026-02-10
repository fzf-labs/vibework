export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskMode = 'conversation' | 'workflow'

export type TaskNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface Project {
  id: string
  name: string
  path: string
  description?: string
  project_type: 'normal' | 'git'
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  project_type?: 'normal' | 'git'
}

export interface Task {
  id: string
  title: string
  prompt: string
  status: TaskStatus
  task_mode: TaskMode
  cost: number | null
  duration: number | null
  project_id?: string | null
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface TaskNode {
  id: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval: number
  status: TaskNodeStatus
  session_id: string | null
  result_summary: string | null
  error_message: string | null
  cost: number | null
  duration: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  id: string
  title: string
  prompt: string
  task_mode?: TaskMode
  project_id?: string | null
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
}

export interface UpdateTaskInput {
  title?: string
  prompt?: string
  status?: TaskStatus
  task_mode?: TaskMode
  cost?: number | null
  duration?: number | null
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  started_at?: string | null
  completed_at?: string | null
}

export interface AgentToolConfig {
  id: string
  tool_id: string
  name: string
  description?: string | null
  config_json: string
  is_default: number
  created_at: string
  updated_at: string
}

export type AutomationTriggerType = 'interval' | 'daily' | 'weekly'
export type AutomationRunStatus = 'running' | 'success' | 'failed' | 'skipped'

export interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger_type: AutomationTriggerType
  trigger_json:
    | { interval_seconds: number }
    | { time: string }
    | { day_of_week: number; time: string }
  timezone: string
  source_task_id: string | null
  template_json: {
    title: string
    prompt: string
    taskMode: 'conversation'
    projectId?: string
    projectPath?: string
    createWorktree?: boolean
    baseBranch?: string
    worktreeBranchPrefix?: string
    worktreeRootPath?: string
    cliToolId?: string
    agentToolConfigId?: string
  }
  next_run_at: string
  last_run_at: string | null
  last_status: AutomationRunStatus | null
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  scheduled_at: string
  triggered_at: string
  status: AutomationRunStatus
  task_id: string | null
  task_node_id: string | null
  session_id: string | null
  error_message: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}
