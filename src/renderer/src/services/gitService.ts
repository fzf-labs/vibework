import { ApiService } from './api'

export class GitService extends ApiService {
  async clone(url: string, targetPath: string): Promise<void> {
    return this.call('git:clone', url, targetPath)
  }

  async init(projectPath: string): Promise<void> {
    return this.call('git:init', projectPath)
  }
}

export const gitService = new GitService()
