import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    add: (project: Record<string, unknown>) => ipcRenderer.invoke('projects:add', project),
    update: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('projects:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id)
  },
  git: {
    clone: (remoteUrl: string, targetPath: string) =>
      ipcRenderer.invoke('git:clone', remoteUrl, targetPath),
    init: (path: string) => ipcRenderer.invoke('git:init', path),
    listWorktrees: (repoPath: string) => ipcRenderer.invoke('git:listWorktrees', repoPath),
    addWorktree: (
      repoPath: string,
      worktreePath: string,
      branchName: string,
      createBranch: boolean
    ) => ipcRenderer.invoke('git:addWorktree', repoPath, worktreePath, branchName, createBranch),
    removeWorktree: (repoPath: string, worktreePath: string, force: boolean) =>
      ipcRenderer.invoke('git:removeWorktree', repoPath, worktreePath, force),
    pruneWorktrees: (repoPath: string) => ipcRenderer.invoke('git:pruneWorktrees', repoPath),
    getDiff: (repoPath: string, filePath?: string) =>
      ipcRenderer.invoke('git:getDiff', repoPath, filePath),
    getStagedDiff: (repoPath: string, filePath?: string) =>
      ipcRenderer.invoke('git:getStagedDiff', repoPath, filePath),
    getBranches: (repoPath: string) => ipcRenderer.invoke('git:getBranches', repoPath),
    getCurrentBranch: (repoPath: string) => ipcRenderer.invoke('git:getCurrentBranch', repoPath),
    getChangedFiles: (repoPath: string) => ipcRenderer.invoke('git:getChangedFiles', repoPath),
    stageFiles: (repoPath: string, filePaths: string[]) =>
      ipcRenderer.invoke('git:stageFiles', repoPath, filePaths),
    unstageFiles: (repoPath: string, filePaths: string[]) =>
      ipcRenderer.invoke('git:unstageFiles', repoPath, filePaths),
    mergeBranch: (repoPath: string, branchName: string) =>
      ipcRenderer.invoke('git:mergeBranch', repoPath, branchName),
    getConflictFiles: (repoPath: string) => ipcRenderer.invoke('git:getConflictFiles', repoPath),
    abortMerge: (repoPath: string) => ipcRenderer.invoke('git:abortMerge', repoPath),
    getConflictContent: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getConflictContent', repoPath, filePath),
    resolveConflict: (repoPath: string, filePath: string, strategy: 'ours' | 'theirs') =>
      ipcRenderer.invoke('git:resolveConflict', repoPath, filePath, strategy),
    rebaseBranch: (repoPath: string, targetBranch: string) =>
      ipcRenderer.invoke('git:rebaseBranch', repoPath, targetBranch),
    rebaseContinue: (repoPath: string) => ipcRenderer.invoke('git:rebaseContinue', repoPath),
    rebaseAbort: (repoPath: string) => ipcRenderer.invoke('git:rebaseAbort', repoPath),
    rebaseSkip: (repoPath: string) => ipcRenderer.invoke('git:rebaseSkip', repoPath),
    getRemoteUrl: (repoPath: string, remoteName?: string) =>
      ipcRenderer.invoke('git:getRemoteUrl', repoPath, remoteName),
    pushBranch: (repoPath: string, branchName: string, remoteName?: string, force?: boolean) =>
      ipcRenderer.invoke('git:pushBranch', repoPath, branchName, remoteName, force),
    getCommitLog: (repoPath: string, limit?: number) =>
      ipcRenderer.invoke('git:getCommitLog', repoPath, limit)
  },
  cli: {
    startSession: (sessionId: string, command: string, args: string[], cwd?: string) =>
      ipcRenderer.invoke('cli:startSession', sessionId, command, args, cwd),
    stopSession: (sessionId: string) => ipcRenderer.invoke('cli:stopSession', sessionId),
    getOutput: (sessionId: string) => ipcRenderer.invoke('cli:getOutput', sessionId)
  },
  claudeCode: {
    getConfig: () => ipcRenderer.invoke('claudeCode:getConfig'),
    saveConfig: (config: Record<string, unknown>) =>
      ipcRenderer.invoke('claudeCode:saveConfig', config),
    startSession: (sessionId: string, workdir: string, options?: { model?: string }) =>
      ipcRenderer.invoke('claudeCode:startSession', sessionId, workdir, options),
    stopSession: (sessionId: string) => ipcRenderer.invoke('claudeCode:stopSession', sessionId),
    sendInput: (sessionId: string, input: string) =>
      ipcRenderer.invoke('claudeCode:sendInput', sessionId, input),
    getOutput: (sessionId: string) => ipcRenderer.invoke('claudeCode:getOutput', sessionId),
    getSessions: () => ipcRenderer.invoke('claudeCode:getSessions')
  },
  cliTools: {
    getAll: () => ipcRenderer.invoke('cliTools:getAll'),
    detect: (toolId: string) => ipcRenderer.invoke('cliTools:detect', toolId),
    detectAll: () => ipcRenderer.invoke('cliTools:detectAll')
  },
  cliToolConfig: {
    get: (toolId: string) => ipcRenderer.invoke('cliToolConfig:get', toolId),
    save: (toolId: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('cliToolConfig:save', toolId, config)
  },
  editor: {
    getAvailable: () => ipcRenderer.invoke('editor:getAvailable'),
    openProject: (projectPath: string, editorCommand: string) =>
      ipcRenderer.invoke('editor:openProject', projectPath, editorCommand)
  },
  pipeline: {
    execute: (pipelineId: string, stages: unknown[], workingDirectory?: string) =>
      ipcRenderer.invoke('pipeline:execute', pipelineId, stages, workingDirectory),
    getExecution: (executionId: string) => ipcRenderer.invoke('pipeline:getExecution', executionId),
    getAllExecutions: () => ipcRenderer.invoke('pipeline:getAllExecutions'),
    approveStage: (stageExecutionId: string, approvedBy: string) =>
      ipcRenderer.invoke('pipeline:approveStage', stageExecutionId, approvedBy),
    cancel: (executionId: string) => ipcRenderer.invoke('pipeline:cancel', executionId)
  },
  previewConfig: {
    getAll: () => ipcRenderer.invoke('previewConfig:getAll'),
    getByProject: (projectId: string) =>
      ipcRenderer.invoke('previewConfig:getByProject', projectId),
    get: (id: string) => ipcRenderer.invoke('previewConfig:get', id),
    add: (config: Record<string, unknown>) => ipcRenderer.invoke('previewConfig:add', config),
    update: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('previewConfig:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('previewConfig:delete', id)
  },
  preview: {
    start: (
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      cwd?: string,
      env?: Record<string, string>
    ) => ipcRenderer.invoke('preview:start', instanceId, configId, command, args, cwd, env),
    stop: (instanceId: string) => ipcRenderer.invoke('preview:stop', instanceId),
    getInstance: (instanceId: string) => ipcRenderer.invoke('preview:getInstance', instanceId),
    getAllInstances: () => ipcRenderer.invoke('preview:getAllInstances'),
    getOutput: (instanceId: string, limit?: number) =>
      ipcRenderer.invoke('preview:getOutput', instanceId, limit),
    clearInstance: (instanceId: string) => ipcRenderer.invoke('preview:clearInstance', instanceId)
  },
  notification: {
    show: (options: {
      title: string
      body: string
      icon?: string
      silent?: boolean
      urgency?: 'normal' | 'critical' | 'low'
    }) => ipcRenderer.invoke('notification:show', options),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('notification:setEnabled', enabled),
    isEnabled: () => ipcRenderer.invoke('notification:isEnabled'),
    setSoundEnabled: (enabled: boolean) =>
      ipcRenderer.invoke('notification:setSoundEnabled', enabled),
    isSoundEnabled: () => ipcRenderer.invoke('notification:isSoundEnabled'),
    setSoundSettings: (settings: {
      enabled?: boolean
      taskComplete?: boolean
      stageComplete?: boolean
      error?: boolean
    }) => ipcRenderer.invoke('notification:setSoundSettings', settings),
    getSoundSettings: () => ipcRenderer.invoke('notification:getSoundSettings')
  },
  database: {
    // Session operations
    createSession: (input: unknown) => ipcRenderer.invoke('db:createSession', input),
    getSession: (id: string) => ipcRenderer.invoke('db:getSession', id),
    getAllSessions: () => ipcRenderer.invoke('db:getAllSessions'),
    updateSessionTaskCount: (sessionId: string, count: number) =>
      ipcRenderer.invoke('db:updateSessionTaskCount', sessionId, count),
    // Task operations
    createTask: (input: unknown) => ipcRenderer.invoke('db:createTask', input),
    getTask: (id: string) => ipcRenderer.invoke('db:getTask', id),
    getAllTasks: () => ipcRenderer.invoke('db:getAllTasks'),
    updateTask: (id: string, updates: unknown) => ipcRenderer.invoke('db:updateTask', id, updates),
    deleteTask: (id: string) => ipcRenderer.invoke('db:deleteTask', id),
    getTasksBySessionId: (sessionId: string) =>
      ipcRenderer.invoke('db:getTasksBySessionId', sessionId),
    // Message operations
    createMessage: (input: unknown) => ipcRenderer.invoke('db:createMessage', input),
    getMessagesByTaskId: (taskId: string) => ipcRenderer.invoke('db:getMessagesByTaskId', taskId),
    deleteMessagesByTaskId: (taskId: string) =>
      ipcRenderer.invoke('db:deleteMessagesByTaskId', taskId),
    // File operations
    createFile: (input: unknown) => ipcRenderer.invoke('db:createFile', input),
    getFilesByTaskId: (taskId: string) => ipcRenderer.invoke('db:getFilesByTaskId', taskId),
    getAllFiles: () => ipcRenderer.invoke('db:getAllFiles'),
    toggleFileFavorite: (fileId: number) => ipcRenderer.invoke('db:toggleFileFavorite', fileId),
    deleteFile: (fileId: number) => ipcRenderer.invoke('db:deleteFile', fileId)
  },
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    readTextFile: (path: string) => ipcRenderer.invoke('fs:readTextFile', path),
    writeFile: (path: string, data: unknown) => ipcRenderer.invoke('fs:writeFile', path, data),
    writeTextFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:writeTextFile', path, content),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    remove: (path: string, options?: { recursive?: boolean }) =>
      ipcRenderer.invoke('fs:remove', path, options)
  },
  dialog: {
    save: (options: unknown) => ipcRenderer.invoke('dialog:save', options),
    open: (options: unknown) => ipcRenderer.invoke('dialog:open', options)
  },
  shell: {
    openUrl: (url: string) => ipcRenderer.invoke('shell:openUrl', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
  },
  path: {
    appDataDir: () => ipcRenderer.invoke('path:appDataDir'),
    appConfigDir: () => ipcRenderer.invoke('path:appConfigDir'),
    tempDir: () => ipcRenderer.invoke('path:tempDir')
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
