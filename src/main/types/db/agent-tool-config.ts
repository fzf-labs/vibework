export interface DbAgentToolConfig {
  id: string
  tool_id: string
  name: string
  description: string | null
  config_json: string
  is_default: number
  created_at: string
  updated_at: string
}

export interface CreateAgentToolConfigInput {
  id: string
  tool_id: string
  name: string
  description?: string | null
  config_json: string
  is_default?: number
}

export interface UpdateAgentToolConfigInput {
  name?: string
  description?: string | null
  config_json?: string
  is_default?: number
}
