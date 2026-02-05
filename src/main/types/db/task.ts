export interface DbTask {
  id: string
  session_id: string | null
  title: string
  prompt: string
  status: string
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  base_branch: string | null
  workspace_path: string | null
  cli_tool_id: string | null
  workflow_template_id: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  id: string
  session_id?: string | null
  title: string
  prompt: string
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
  cli_tool_id?: string
  workflow_template_id?: string
}

export interface UpdateTaskInput {
  session_id?: string | null
  title?: string
  prompt?: string
  status?: string
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  cli_tool_id?: string | null
  workflow_template_id?: string | null
  cost?: number | null
  duration?: number | null
  favorite?: boolean
}
