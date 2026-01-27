import { ApiService } from './api'
import type { Project, ProjectConfig } from '@/types'

export class ProjectService extends ApiService {
  async getAll(): Promise<Project[]> {
    return this.call('projects:getAll')
  }

  async get(id: string): Promise<Project | null> {
    return this.call('projects:get', id)
  }

  async add(config: ProjectConfig): Promise<Project> {
    return this.call('projects:add', config)
  }

  async update(id: string, updates: Partial<ProjectConfig>): Promise<void> {
    return this.call('projects:update', id, updates)
  }

  async delete(id: string): Promise<void> {
    return this.call('projects:delete', id)
  }

  async setActive(id: string): Promise<void> {
    return this.call('projects:setActive', id)
  }

  async getActive(): Promise<Project | null> {
    return this.call('projects:getActive')
  }
}

export const projectService = new ProjectService()
