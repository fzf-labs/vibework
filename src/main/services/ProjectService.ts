import {
  DatabaseService,
  Project as DbProject,
  CreateProjectInput,
  UpdateProjectInput
} from './DatabaseService'

export interface Project {
  id: string
  name: string
  path: string
  description?: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateProjectOptions {
  name: string
  path: string
  description?: string
  config?: Record<string, unknown>
}

export class ProjectService {
  private db: DatabaseService

  constructor(db: DatabaseService) {
    this.db = db
  }

  private toProject(dbProject: DbProject): Project {
    return {
      id: dbProject.id,
      name: dbProject.name,
      path: dbProject.path,
      description: dbProject.description || undefined,
      config: dbProject.config ? JSON.parse(dbProject.config) : {},
      createdAt: dbProject.created_at,
      updatedAt: dbProject.updated_at
    }
  }

  getAllProjects(): Project[] {
    return this.db.getAllProjects().map((p) => this.toProject(p))
  }

  getProject(id: string): Project | undefined {
    const project = this.db.getProject(id)
    return project ? this.toProject(project) : undefined
  }

  getProjectByPath(path: string): Project | undefined {
    const project = this.db.getProjectByPath(path)
    return project ? this.toProject(project) : undefined
  }

  addProject(options: CreateProjectOptions): Project {
    const existing = this.db.getProjectByPath(options.path)
    if (existing) {
      throw new Error(`项目路径已存在: ${options.path}`)
    }

    const input: CreateProjectInput = {
      name: options.name,
      path: options.path,
      description: options.description,
      config: options.config
    }

    const created = this.db.createProject(input)
    return this.toProject(created)
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const input: UpdateProjectInput = {}
    if (updates.name !== undefined) input.name = updates.name
    if (updates.description !== undefined) input.description = updates.description
    if (updates.config !== undefined) input.config = updates.config

    const updated = this.db.updateProject(id, input)
    return updated ? this.toProject(updated) : null
  }

  deleteProject(id: string): boolean {
    return this.db.deleteProject(id)
  }
}
