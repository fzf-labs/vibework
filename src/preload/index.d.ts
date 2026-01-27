import { ElectronAPI } from '@electron-toolkit/preload'

type UnknownRecord = Record<string, unknown>

interface ProjectAPI {
  getAll: () => Promise<unknown[]>
  get: (id: string) => Promise<unknown>
  add: (project: UnknownRecord) => Promise<unknown>
  update: (id: string, updates: UnknownRecord) => Promise<unknown>
  delete: (id: string) => Promise<boolean>
}

interface GitAPI {
  clone: (remoteUrl: string, targetPath: string) => Promise<unknown>
  init: (path: string) => Promise<unknown>
  listWorktrees: (repoPath: string) => Promise<unknown>
  addWorktree: (
    repoPath: string,
    worktreePath: string,
    branchName: string,
    createBranch: boolean
  ) => Promise<unknown>
  removeWorktree: (repoPath: string, worktreePath: string, force: boolean) => Promise<unknown>
  pruneWorktrees: (repoPath: string) => Promise<unknown>
  getDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  getStagedDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  getBranches: (repoPath: string) => Promise<unknown>
  getCurrentBranch: (repoPath: string) => Promise<unknown>
  getChangedFiles: (repoPath: string) => Promise<unknown>
  stageFiles: (repoPath: string, filePaths: string[]) => Promise<unknown>
  unstageFiles: (repoPath: string, filePaths: string[]) => Promise<unknown>
  mergeBranch: (repoPath: string, branchName: string) => Promise<unknown>
  getConflictFiles: (repoPath: string) => Promise<unknown>
  abortMerge: (repoPath: string) => Promise<unknown>
  getConflictContent: (repoPath: string, filePath: string) => Promise<unknown>
  resolveConflict: (
    repoPath: string,
    filePath: string,
    strategy: 'ours' | 'theirs'
  ) => Promise<unknown>
  rebaseBranch: (repoPath: string, targetBranch: string) => Promise<unknown>
  rebaseContinue: (repoPath: string) => Promise<unknown>
  rebaseAbort: (repoPath: string) => Promise<unknown>
  rebaseSkip: (repoPath: string) => Promise<unknown>
  getRemoteUrl: (repoPath: string, remoteName?: string) => Promise<unknown>
  pushBranch: (
    repoPath: string,
    branchName: string,
    remoteName?: string,
    force?: boolean
  ) => Promise<unknown>
  getCommitLog: (repoPath: string, limit?: number) => Promise<unknown>
}

interface CLIAPI {
  startSession: (
    sessionId: string,
    command: string,
    args: string[],
    cwd?: string
  ) => Promise<unknown>
  stopSession: (sessionId: string) => Promise<unknown>
  getOutput: (sessionId: string) => Promise<string[]>
}

interface ClaudeCodeAPI {
  getConfig: () => Promise<UnknownRecord>
  saveConfig: (config: UnknownRecord) => Promise<unknown>
  startSession: (
    sessionId: string,
    workdir: string,
    options?: { model?: string }
  ) => Promise<unknown>
  stopSession: (sessionId: string) => Promise<unknown>
  sendInput: (sessionId: string, input: string) => Promise<unknown>
  getOutput: (sessionId: string) => Promise<string[]>
  getSessions: () => Promise<unknown[]>
}

interface CLIToolsAPI {
  getAll: () => Promise<unknown[]>
  detect: (toolId: string) => Promise<unknown>
  detectAll: () => Promise<unknown[]>
}

interface CLIToolConfigAPI {
  get: (toolId: string) => Promise<UnknownRecord>
  save: (toolId: string, config: UnknownRecord) => Promise<unknown>
}

interface EditorAPI {
  getAvailable: () => Promise<unknown[]>
  openProject: (projectPath: string, editorCommand: string) => Promise<unknown>
}

interface PipelineAPI {
  execute: (pipelineId: string, stages: unknown[], workingDirectory?: string) => Promise<unknown>
  getExecution: (executionId: string) => Promise<unknown>
  getAllExecutions: () => Promise<unknown[]>
  approveStage: (stageExecutionId: string, approvedBy: string) => Promise<unknown>
  cancel: (executionId: string) => Promise<unknown>
}

interface PreviewConfigAPI {
  getAll: () => Promise<unknown[]>
  getByProject: (projectId: string) => Promise<unknown[]>
  get: (id: string) => Promise<unknown>
  add: (config: UnknownRecord) => Promise<unknown>
  update: (id: string, updates: UnknownRecord) => Promise<unknown>
  delete: (id: string) => Promise<unknown>
}

interface PreviewAPI {
  start: (
    instanceId: string,
    configId: string,
    command: string,
    args: string[],
    cwd?: string,
    env?: Record<string, string>
  ) => Promise<unknown>
  stop: (instanceId: string) => Promise<unknown>
  getInstance: (instanceId: string) => Promise<unknown>
  getAllInstances: () => Promise<unknown[]>
  getOutput: (instanceId: string, limit?: number) => Promise<string[]>
  clearInstance: (instanceId: string) => Promise<unknown>
}

interface NotificationAPI {
  show: (options: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    urgency?: 'normal' | 'critical' | 'low'
  }) => Promise<unknown>
  setEnabled: (enabled: boolean) => Promise<unknown>
  isEnabled: () => Promise<boolean>
  setSoundEnabled: (enabled: boolean) => Promise<unknown>
  isSoundEnabled: () => Promise<boolean>
  setSoundSettings: (settings: {
    enabled?: boolean
    taskComplete?: boolean
    stageComplete?: boolean
    error?: boolean
  }) => Promise<unknown>
  getSoundSettings: () => Promise<{
    enabled: boolean
    taskComplete: boolean
    stageComplete: boolean
    error: boolean
  }>
}

interface FSAPI {
  readFile: (path: string) => Promise<Uint8Array>
  readTextFile: (path: string) => Promise<string>
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>
  writeTextFile: (path: string, content: string) => Promise<void>
  stat: (path: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean }>
  exists: (path: string) => Promise<boolean>
  remove: (path: string, options?: { recursive?: boolean }) => Promise<void>
}

interface DialogAPI {
  save: (options: UnknownRecord) => Promise<string | null>
  open: (options: UnknownRecord) => Promise<string | string[] | null>
}

interface ShellAPI {
  openUrl: (url: string) => Promise<void>
  openPath: (path: string) => Promise<void>
  showItemInFolder: (path: string) => Promise<void>
}

interface PathAPI {
  appDataDir: () => Promise<string>
  appConfigDir: () => Promise<string>
  tempDir: () => Promise<string>
}

interface AppAPI {
  getVersion: () => Promise<string>
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
  fs: FSAPI
  dialog: DialogAPI
  shell: ShellAPI
  path: PathAPI
  app: AppAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
