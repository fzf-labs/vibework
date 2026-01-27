import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

interface Project {
  id: string
  name: string
  path: string
  type: 'local' | 'remote'
  remoteUrl?: string
  description?: string
  lastOpened?: string
  createdAt: string
  config: ProjectConfig
}

interface ProjectConfig {
  mcpServers?: unknown[]
  skills?: unknown[]
  pipelines?: unknown[]
  editor?: unknown
}

export class ProjectService {
  private projectsFile: string
  private projects: Project[] = []

  constructor() {
    const userDataPath = app.getPath('userData')
    const dataDir = join(userDataPath, 'data')

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    this.projectsFile = join(dataDir, 'projects.json')
    this.loadProjects()
  }

  private loadProjects(): void {
    try {
      if (existsSync(this.projectsFile)) {
        const data = readFileSync(this.projectsFile, 'utf-8')
        this.projects = JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
      this.projects = []
    }
  }

  private saveProjects(): void {
    try {
      writeFileSync(this.projectsFile, JSON.stringify(this.projects, null, 2))
    } catch (error) {
      console.error('Failed to save projects:', error)
    }
  }

  getAllProjects(): Project[] {
    return this.projects
  }

  getProject(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id)
  }

  addProject(project: Omit<Project, 'id' | 'createdAt'>): Project {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    }

    this.projects.push(newProject)
    this.saveProjects()
    return newProject
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const index = this.projects.findIndex((p) => p.id === id)
    if (index === -1) return null

    this.projects[index] = { ...this.projects[index], ...updates }
    this.saveProjects()
    return this.projects[index]
  }

  deleteProject(id: string): boolean {
    const index = this.projects.findIndex((p) => p.id === id)
    if (index === -1) return false

    this.projects.splice(index, 1)
    this.saveProjects()
    return true
  }

  updateLastOpened(id: string): void {
    const project = this.getProject(id)
    if (project) {
      project.lastOpened = new Date().toISOString()
      this.saveProjects()
    }
  }
}
