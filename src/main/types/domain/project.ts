export interface Project {
  id: string
  name: string
  path: string
  description?: string
  projectType: 'normal' | 'git'
  createdAt: string
  updatedAt: string
}

export interface CreateProjectOptions {
  name: string
  path: string
  description?: string
  projectType?: 'normal' | 'git'
}
