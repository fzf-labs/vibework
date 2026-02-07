// Database types for tasks and workflows

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskMode = 'conversation' | 'workflow'

export type WorkNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export type AgentExecutionStatus = 'idle' | 'running' | 'completed'

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
  session_id: string | null
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
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  id: string
  session_id?: string | null
  title: string
  prompt: string
  task_mode?: TaskMode
  project_id?: string | null
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
}

export interface UpdateTaskInput {
  session_id?: string | null
  title?: string
  prompt?: string
  status?: TaskStatus
  task_mode?: TaskMode
  cost?: number
  duration?: number
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
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
