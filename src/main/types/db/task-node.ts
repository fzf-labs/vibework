export type TaskNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface DbTaskNode {
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
  resume_session_id: string | null
  result_summary: string | null
  error_message: string | null
  cost: number | null
  duration: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskNodeInput {
  id?: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  requires_approval?: boolean
}

export interface CompleteTaskNodeInput {
  node_id: string
  status: Extract<TaskNodeStatus, 'done' | 'in_review'>
  result_summary?: string | null
  error_message?: string | null
  cost?: number | null
  duration?: number | null
}
