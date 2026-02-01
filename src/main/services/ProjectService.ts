import { existsSync } from 'fs'
import { join } from 'path'
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
      projectType: dbProject.project_type || 'normal',
      createdAt: dbProject.created_at,
      updatedAt: dbProject.updated_at
    }
  }

  private detectProjectType(projectPath: string): 'normal' | 'git' {
    return existsSync(join(projectPath, '.git')) ? 'git' : 'normal'
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

    const projectType = options.projectType ?? this.detectProjectType(options.path)
    const input: CreateProjectInput = {
      name: options.name,
      path: options.path,
      description: options.description,
      project_type: projectType
    }

    const created = this.db.createProject(input)
    return this.toProject(created)
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const input: UpdateProjectInput = {}
    if (updates.name !== undefined) input.name = updates.name
    if (updates.description !== undefined) input.description = updates.description
    if (updates.projectType !== undefined) input.project_type = updates.projectType

    const updated = this.db.updateProject(id, input)
    return updated ? this.toProject(updated) : null
  }

  deleteProject(id: string): boolean {
    return this.db.deleteProject(id)
  }

  checkProjectPath(id: string): {
    exists: boolean
    projectType?: 'normal' | 'git'
    updated: boolean
  } {
    const project = this.db.getProject(id)
    if (!project) {
      return { exists: false, updated: false }
    }

    if (!existsSync(project.path)) {
      return { exists: false, updated: false }
    }

    const detectedType = this.detectProjectType(project.path)
    if (project.project_type !== detectedType) {
      this.db.updateProject(id, { project_type: detectedType })
      return { exists: true, projectType: detectedType, updated: true }
    }

    return { exists: true, projectType: detectedType, updated: false }
  }
}
