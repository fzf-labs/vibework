export interface DbWorkflowTemplate {
  id: string
  name: string
  description: string | null
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  nodes: DbWorkNodeTemplate[]
}

export interface DbWorkNodeTemplate {
  id: string
  template_id: string
  node_order: number
  name: string
  prompt: string
  requires_approval: boolean
  continue_on_error: boolean
  created_at: string
  updated_at: string
}

export interface DbWorkflow {
  id: string
  task_id: string
  current_node_index: number
  status: 'todo' | 'in_progress' | 'done'
  created_at: string
  updated_at: string
}

export interface DbWorkNode {
  id: string
  workflow_id: string
  template_node_id: string | null
  node_order: number
  name: string
  prompt: string
  requires_approval: boolean
  continue_on_error: boolean
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateWorkNodeTemplateInput {
  name: string
  prompt: string
  node_order: number
  requires_approval?: boolean
  continue_on_error?: boolean
}

export interface CreateWorkflowTemplateInput {
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}

export interface UpdateWorkflowTemplateInput {
  id: string
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}
