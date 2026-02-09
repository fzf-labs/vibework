export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface DbTask {
  id: string
  title: string
  prompt: string
  status: TaskStatus
  task_mode: 'conversation' | 'workflow'
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  base_branch: string | null
  workspace_path: string | null
  started_at: string | null
  completed_at: string | null
  cost: number | null
  duration: number | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  id: string
  title: string
  prompt: string
  task_mode?: 'conversation' | 'workflow'
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
}

export interface UpdateTaskInput {
  title?: string
  prompt?: string
  status?: TaskStatus
  task_mode?: 'conversation' | 'workflow'
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  started_at?: string | null
  completed_at?: string | null
  cost?: number | null
  duration?: number | null
}
