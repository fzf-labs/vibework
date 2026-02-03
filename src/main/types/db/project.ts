export interface DbProject {
  id: string
  name: string
  path: string
  description: string | null
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

export interface UpdateProjectInput {
  name?: string
  description?: string
  project_type?: 'normal' | 'git'
}
