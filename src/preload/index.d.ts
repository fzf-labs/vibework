import { ElectronAPI } from '@electron-toolkit/preload'

type UnknownRecord = Record<string, unknown>
type CliSessionStatus = 'idle' | 'running' | 'stopped' | 'error'

interface CliSessionInfo {
  id: string
  status: CliSessionStatus
  workdir: string
  toolId: string
  startTime: string
}
interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

interface ProjectAPI {
  getAll: () => Promise<unknown[]>
  get: (id: string) => Promise<unknown>
  add: (project: UnknownRecord) => Promise<unknown>
  update: (id: string, updates: UnknownRecord) => Promise<unknown>
  delete: (id: string) => Promise<boolean>
  checkPath: (
    id: string
  ) => Promise<{ exists: boolean; projectType?: 'normal' | 'git'; updated: boolean }>
}

interface GitAPI {
  checkInstalled: () => Promise<unknown>
  clone: (remoteUrl: string, targetPath: string) => Promise<unknown>
  init: (path: string) => Promise<unknown>
  listWorktrees: (repoPath: string) => Promise<unknown>
  addWorktree: (
    repoPath: string,
    worktreePath: string,
    branchName: string,
    createBranch: boolean,
    baseBranch?: string
  ) => Promise<unknown>
  removeWorktree: (repoPath: string, worktreePath: string, force: boolean) => Promise<unknown>
  pruneWorktrees: (repoPath: string) => Promise<unknown>
  getDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  getStagedDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  getBranches: (repoPath: string) => Promise<unknown>
  getCurrentBranch: (repoPath: string) => Promise<unknown>
  getChangedFiles: (repoPath: string) => Promise<unknown>
  getBranchDiffFiles: (
    repoPath: string,
    baseBranch: string,
    compareBranch?: string
  ) => Promise<unknown>
  getBranchDiff: (
    repoPath: string,
    baseBranch: string,
    compareBranch?: string,
    filePath?: string
  ) => Promise<unknown>
  stageFiles: (repoPath: string, filePaths: string[]) => Promise<unknown>
  unstageFiles: (repoPath: string, filePaths: string[]) => Promise<unknown>
  commit: (repoPath: string, message: string) => Promise<unknown>
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
  getParsedDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  getParsedStagedDiff: (repoPath: string, filePath?: string) => Promise<unknown>
  checkoutBranch: (repoPath: string, branchName: string) => Promise<unknown>
  createBranch: (repoPath: string, branchName: string) => Promise<unknown>
}

interface CLIAPI {
  startSession: (
    sessionId: string,
    command: string,
    args: string[],
    cwd?: string
  ) => Promise<unknown>
  stopSession: (sessionId: string) => Promise<unknown>
  getOutput: (sessionId: string) => Promise<{
    output: string[]
    truncated: boolean
    byteLength: number
    entryCount: number
  }>
}

interface TerminalAPI {
  startSession: (
    paneId: string,
    cwd: string,
    cols?: number,
    rows?: number,
    workspaceId?: string
  ) => Promise<{ paneId: string; isNew: boolean }>
  write: (paneId: string, data: string) => Promise<unknown>
  resize: (paneId: string, cols: number, rows: number) => Promise<unknown>
  signal: (paneId: string, signal?: string) => Promise<unknown>
  kill: (paneId: string) => Promise<unknown>
  detach: (paneId: string) => Promise<unknown>
  killByWorkspaceId: (workspaceId: string) => Promise<{ killed: number; failed: number }>
  onData: (callback: (data: { paneId: string; data: string }) => void) => () => void
  onExit: (
    callback: (data: { paneId: string; exitCode: number; signal?: number }) => void
  ) => () => void
  onError: (callback: (data: { paneId: string; error: string }) => void) => () => void
}

interface CliSessionAPI {
  startSession: (
    sessionId: string,
    toolId: string,
    workdir: string,
    options?: { model?: string; prompt?: string; projectId?: string | null; taskId?: string; taskNodeId?: string; configId?: string | null }
  ) => Promise<unknown>
  stopSession: (sessionId: string) => Promise<unknown>
  sendInput: (sessionId: string, input: string) => Promise<unknown>
  getSessions: () => Promise<unknown[]>
  getSession: (sessionId: string) => Promise<CliSessionInfo | null>
  onStatus: (
    callback: (data: { sessionId: string; status: CliSessionStatus; forced?: boolean }) => void
  ) => () => void
  onOutput: (
    callback: (data: { sessionId: string; type: string; content: string }) => void
  ) => () => void
  onClose: (
    callback: (data: { sessionId: string; code: number; forcedStatus?: CliSessionStatus }) => void
  ) => () => void
  onError: (callback: (data: { sessionId: string; error: string }) => void) => () => void
}

interface LogStreamAPI {
  subscribe: (sessionId: string) => Promise<{ success: boolean; error?: string }>
  unsubscribe: (sessionId: string) => Promise<unknown>
  getHistory: (taskId: string, sessionId?: string | null) => Promise<unknown[]>
  onMessage: (callback: (sessionId: string, msg: unknown) => void) => () => void
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

interface TaskNodeAPI {
  onCompleted: (callback: (data: { id: string; name?: string; taskId: string }) => void) => () => void
  onReview: (callback: (data: { id: string; name?: string; taskId: string }) => void) => () => void
  onCancelled: (callback: (data: { id: string; name?: string; taskId: string }) => void) => () => void
}

interface DatabaseAPI {
  createTask: (input: unknown) => Promise<unknown>
  getTask: (id: string) => Promise<unknown>
  getAllTasks: () => Promise<unknown[]>
  updateTask: (id: string, updates: unknown) => Promise<unknown>
  deleteTask: (id: string) => Promise<boolean>
  getTasksByProjectId: (projectId: string) => Promise<unknown[]>
  listAgentToolConfigs: (toolId?: string) => Promise<unknown[]>
  getAgentToolConfig: (id: string) => Promise<unknown>
  createAgentToolConfig: (input: unknown) => Promise<unknown>
  updateAgentToolConfig: (id: string, updates: unknown) => Promise<unknown>
  deleteAgentToolConfig: (id: string) => Promise<unknown>
  setDefaultAgentToolConfig: (id: string) => Promise<unknown>
  getGlobalWorkflowTemplates: () => Promise<unknown[]>
  getWorkflowTemplatesByProject: (projectId: string) => Promise<unknown[]>
  getWorkflowTemplate: (templateId: string) => Promise<unknown>
  createWorkflowTemplate: (input: unknown) => Promise<unknown>
  updateWorkflowTemplate: (input: unknown) => Promise<unknown>
  deleteWorkflowTemplate: (templateId: string, scope: string) => Promise<boolean>
  copyGlobalWorkflowToProject: (globalTemplateId: string, projectId: string) => Promise<unknown>
  getTaskNodes: (taskId: string) => Promise<unknown[]>
  getTaskNode: (nodeId: string) => Promise<unknown>
  getCurrentTaskNode: (taskId: string) => Promise<unknown>
  updateCurrentTaskNodeRuntime: (
    taskId: string,
    updates: {
      session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ) => Promise<unknown>
  getTaskNodesByStatus: (taskId: string, status: string) => Promise<unknown[]>
  completeTaskNode: (
    nodeId: string,
    result?: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
    }
  ) => Promise<unknown>
  markTaskNodeErrorReview: (nodeId: string, error: string) => Promise<unknown>
  approveTaskNode: (nodeId: string) => Promise<unknown>
  rejectTaskNode: (nodeId: string, reason?: string) => Promise<unknown>
  retryTaskNode: (nodeId: string) => Promise<unknown>
  cancelTaskNode: (nodeId: string) => Promise<unknown>
}

interface FSAPI {
  readFile: (path: string) => Promise<Uint8Array>
  readTextFile: (path: string) => Promise<string>
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>
  writeTextFile: (path: string, content: string) => Promise<void>
  appendTextFile: (path: string, content: string) => Promise<void>
  stat: (path: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean }>
  readDir: (
    path: string,
    options?: { maxDepth?: number }
  ) => Promise<FileEntry[]>
  exists: (path: string) => Promise<boolean>
  remove: (path: string, options?: { recursive?: boolean }) => Promise<void>
  mkdir: (path: string) => Promise<void>
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
  appConfigDir: () => Promise<string>
  tempDir: () => Promise<string>
  resourcesDir: () => Promise<string>
  appPath: () => Promise<string>
  vibeworkDataDir: () => Promise<string>
  homeDir: () => Promise<string>
}

interface AppAPI {
  getVersion: () => Promise<string>
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  accentColor: string
  backgroundStyle: string
  language: string
  notifications: {
    enabled: boolean
    sound: boolean
  }
}

interface SettingsAPI {
  get: () => Promise<AppSettings>
  update: (updates: Partial<AppSettings>) => Promise<AppSettings>
  reset: () => Promise<AppSettings>
}

interface TaskWithWorktree {
  id: string
  title: string
  prompt: string
  status: string
  taskMode: 'conversation' | 'workflow'
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  baseBranch?: string | null
  workspacePath?: string | null
  startedAt?: string | null
  completedAt?: string | null
  cost: number | null
  duration: number | null
  createdAt: string
  updatedAt: string
}

interface TaskAPI {
  create: (options: {
    title: string
    prompt: string
    taskMode: 'conversation' | 'workflow'
    projectId?: string
    projectPath?: string
    createWorktree?: boolean
    baseBranch?: string
    worktreeBranchPrefix?: string
    worktreeRootPath?: string
    cliToolId?: string
    agentToolConfigId?: string
    workflowTemplateId?: string
  }) => Promise<{ success: boolean; data?: TaskWithWorktree; error?: string }>
  get: (id: string) => Promise<TaskWithWorktree | null>
  getAll: () => Promise<TaskWithWorktree[]>
  getByProject: (projectId: string) => Promise<TaskWithWorktree[]>
  updateStatus: (id: string, status: string) => Promise<TaskWithWorktree | null>
  delete: (id: string, removeWorktree?: boolean) => Promise<boolean>
  startExecution: (taskId: string) => Promise<unknown>
  stopExecution: (taskId: string) => Promise<unknown>
}

interface API {
  projects: ProjectAPI
  git: GitAPI
  cli: CLIAPI
  terminal: TerminalAPI
  cliSession: CliSessionAPI
  logStream: LogStreamAPI
  taskNode: TaskNodeAPI
  cliTools: CLIToolsAPI
  cliToolConfig: CLIToolConfigAPI
  editor: EditorAPI
  pipeline: PipelineAPI
  previewConfig: PreviewConfigAPI
  preview: PreviewAPI
  notification: NotificationAPI
  database: DatabaseAPI
  fs: FSAPI
  dialog: DialogAPI
  shell: ShellAPI
  path: PathAPI
  app: AppAPI
  settings: SettingsAPI
  task: TaskAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
