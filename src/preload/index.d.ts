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
  listWorktrees: (repoPath: string) => Promise<any>
  addWorktree: (repoPath: string, worktreePath: string, branchName: string, createBranch: boolean) => Promise<any>
  removeWorktree: (repoPath: string, worktreePath: string, force: boolean) => Promise<any>
  pruneWorktrees: (repoPath: string) => Promise<any>
  getDiff: (repoPath: string, filePath?: string) => Promise<any>
  getStagedDiff: (repoPath: string, filePath?: string) => Promise<any>
  getBranches: (repoPath: string) => Promise<any>
  getCurrentBranch: (repoPath: string) => Promise<any>
  getChangedFiles: (repoPath: string) => Promise<any>
  stageFiles: (repoPath: string, filePaths: string[]) => Promise<any>
  unstageFiles: (repoPath: string, filePaths: string[]) => Promise<any>
  mergeBranch: (repoPath: string, branchName: string) => Promise<any>
  getConflictFiles: (repoPath: string) => Promise<any>
  abortMerge: (repoPath: string) => Promise<any>
  getConflictContent: (repoPath: string, filePath: string) => Promise<any>
  resolveConflict: (repoPath: string, filePath: string, strategy: 'ours' | 'theirs') => Promise<any>
  rebaseBranch: (repoPath: string, targetBranch: string) => Promise<any>
  rebaseContinue: (repoPath: string) => Promise<any>
  rebaseAbort: (repoPath: string) => Promise<any>
  rebaseSkip: (repoPath: string) => Promise<any>
  getRemoteUrl: (repoPath: string, remoteName?: string) => Promise<any>
  pushBranch: (repoPath: string, branchName: string, remoteName?: string, force?: boolean) => Promise<any>
  getCommitLog: (repoPath: string, limit?: number) => Promise<any>
}

interface CLIAPI {
  startSession: (sessionId: string, command: string, args: string[], cwd?: string) => Promise<any>
  stopSession: (sessionId: string) => Promise<any>
  getOutput: (sessionId: string) => Promise<string[]>
}

interface ClaudeCodeAPI {
  getConfig: () => Promise<any>
  saveConfig: (config: any) => Promise<any>
  startSession: (sessionId: string, workdir: string, options?: any) => Promise<any>
  stopSession: (sessionId: string) => Promise<any>
  sendInput: (sessionId: string, input: string) => Promise<any>
  getOutput: (sessionId: string) => Promise<string[]>
  getSessions: () => Promise<any[]>
}

interface CLIToolsAPI {
  getAll: () => Promise<any[]>
  detect: (toolId: string) => Promise<any>
  detectAll: () => Promise<any[]>
}

interface CLIToolConfigAPI {
  get: (toolId: string) => Promise<any>
  save: (toolId: string, config: any) => Promise<any>
}

interface EditorAPI {
  getAvailable: () => Promise<any[]>
  openProject: (projectPath: string, editorCommand: string) => Promise<any>
}

interface PipelineAPI {
  execute: (pipelineId: string, stages: any[], workingDirectory?: string) => Promise<any>
  getExecution: (executionId: string) => Promise<any>
  getAllExecutions: () => Promise<any[]>
  approveStage: (stageExecutionId: string, approvedBy: string) => Promise<any>
  cancel: (executionId: string) => Promise<any>
}

interface PreviewConfigAPI {
  getAll: () => Promise<any[]>
  getByProject: (projectId: string) => Promise<any[]>
  get: (id: string) => Promise<any>
  add: (config: any) => Promise<any>
  update: (id: string, updates: any) => Promise<any>
  delete: (id: string) => Promise<any>
}

interface PreviewAPI {
  start: (instanceId: string, configId: string, command: string, args: string[], cwd?: string, env?: Record<string, string>) => Promise<any>
  stop: (instanceId: string) => Promise<any>
  getInstance: (instanceId: string) => Promise<any>
  getAllInstances: () => Promise<any[]>
  getOutput: (instanceId: string, limit?: number) => Promise<string[]>
  clearInstance: (instanceId: string) => Promise<any>
}

interface NotificationAPI {
  show: (options: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    urgency?: 'normal' | 'critical' | 'low'
  }) => Promise<any>
  setEnabled: (enabled: boolean) => Promise<any>
  isEnabled: () => Promise<boolean>
  setSoundEnabled: (enabled: boolean) => Promise<any>
  isSoundEnabled: () => Promise<boolean>
  setSoundSettings: (settings: {
    enabled?: boolean
    taskComplete?: boolean
    stageComplete?: boolean
    error?: boolean
  }) => Promise<any>
  getSoundSettings: () => Promise<{
    enabled: boolean
    taskComplete: boolean
    stageComplete: boolean
    error: boolean
  }>
}

interface API {
  projects: ProjectAPI
  git: GitAPI
  cli: CLIAPI
  claudeCode: ClaudeCodeAPI
  cliTools: CLIToolsAPI
  cliToolConfig: CLIToolConfigAPI
  editor: EditorAPI
  pipeline: PipelineAPI
  previewConfig: PreviewConfigAPI
  preview: PreviewAPI
  notification: NotificationAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
