export interface DbAgentExecution {
  id: string
  task_id: string
  work_node_id: string | null
  execution_scope: 'conversation' | 'workflow'
  execution_index: number
  status: 'idle' | 'running' | 'completed'
  session_id: string | null
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  started_at: string | null
  completed_at: string | null
  cost: number | null
  duration: number | null
  created_at: string
}
