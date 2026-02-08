export interface DbWorkflowTemplate {
  id: string
  name: string
  description: string | null
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  nodes: DbTaskNodeTemplate[]
}

export interface DbTaskNodeTemplate {
  id: string
  template_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval: boolean
  continue_on_error: boolean
  created_at: string
  updated_at: string
}

export interface CreateTaskNodeTemplateInput {
  name: string
  prompt: string
  node_order: number
  cli_tool_id?: string
  agent_tool_config_id?: string
  requires_approval?: boolean
  continue_on_error?: boolean
}

export interface CreateWorkflowTemplateInput {
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateTaskNodeTemplateInput[]
}

export interface UpdateWorkflowTemplateInput {
  id: string
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateTaskNodeTemplateInput[]
}
