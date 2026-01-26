import { ElectronAPI } from '@electron-toolkit/preload'

interface ProjectAPI {
  getAll: () => Promise<any[]>
  get: (id: string) => Promise<any>
  add: (project: any) => Promise<any>
  update: (id: string, updates: any) => Promise<any>
  delete: (id: string) => Promise<boolean>
}

interface GitAPI {
  clone: (remoteUrl: string, targetPath: string) => Promise<any>
  init: (path: string) => Promise<any>
}

interface API {
  projects: ProjectAPI
  git: GitAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
