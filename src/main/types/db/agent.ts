export interface DbAgentExecution {
  id: string
  work_node_id: string
  execution_index: number
  status: 'idle' | 'running' | 'completed'
  started_at: string | null
  completed_at: string | null
  cost: number | null
  duration: number | null
  created_at: string
}
