export type TaskNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'

export type TaskNodeReviewReason = 'approval' | 'error' | 'rejected'

export interface DbTaskNode {
  id: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval: number
  continue_on_error: number
  status: TaskNodeStatus
  review_reason: TaskNodeReviewReason | null
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

export interface CreateTaskNodeInput {
  id?: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  requires_approval?: boolean
  continue_on_error?: boolean
}

export interface CompleteTaskNodeInput {
  node_id: string
  status: Extract<TaskNodeStatus, 'done' | 'in_review'>
  review_reason?: TaskNodeReviewReason | null
  result_summary?: string | null
  error_message?: string | null
  cost?: number | null
  duration?: number | null
}
