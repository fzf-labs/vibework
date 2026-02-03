import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
}

type IpcResponse<T> = { success: boolean; data?: T; error?: string }

const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const response = await ipcRenderer.invoke(channel, ...args)
  if (response && typeof response === 'object' && 'success' in response) {
    const wrapped = response as IpcResponse<T>
    if ('data' in wrapped || 'error' in wrapped) {
      if (wrapped.success) {
        return wrapped.data as T
      }
      throw new Error(wrapped.error || 'IPC request failed')
    }
  }
  return response as T
}

// Custom APIs for renderer
const api = {
  projects: {
    getAll: () => invoke('projects:getAll'),
    get: (id: string) => invoke('projects:get', id),
    add: (project: Record<string, unknown>) => invoke('projects:add', project),
    update: (id: string, updates: Record<string, unknown>) =>
      invoke('projects:update', id, updates),
    delete: (id: string) => invoke('projects:delete', id),
    checkPath: (id: string) => invoke('projects:checkPath', id)
  },
  git: {
    checkInstalled: () => invoke('git:checkInstalled'),
    clone: (remoteUrl: string, targetPath: string) =>
      invoke('git:clone', remoteUrl, targetPath),
    init: (path: string) => invoke('git:init', path),
    listWorktrees: (repoPath: string) => invoke('git:listWorktrees', repoPath),
    addWorktree: (
      repoPath: string,
      worktreePath: string,
      branchName: string,
      createBranch: boolean,
      baseBranch?: string
    ) =>
      invoke(
        'git:addWorktree',
        repoPath,
        worktreePath,
        branchName,
        createBranch,
        baseBranch
      ),
    removeWorktree: (repoPath: string, worktreePath: string, force: boolean) =>
      invoke('git:removeWorktree', repoPath, worktreePath, force),
    pruneWorktrees: (repoPath: string) => invoke('git:pruneWorktrees', repoPath),
    getDiff: (repoPath: string, filePath?: string) =>
      invoke('git:getDiff', repoPath, filePath),
    getStagedDiff: (repoPath: string, filePath?: string) =>
      invoke('git:getStagedDiff', repoPath, filePath),
    getBranches: (repoPath: string) => invoke('git:getBranches', repoPath),
    getCurrentBranch: (repoPath: string) => invoke('git:getCurrentBranch', repoPath),
    getChangedFiles: (repoPath: string) => invoke('git:getChangedFiles', repoPath),
    getBranchDiffFiles: (
      repoPath: string,
      baseBranch: string,
      compareBranch?: string
    ) => invoke('git:getBranchDiffFiles', repoPath, baseBranch, compareBranch),
    stageFiles: (repoPath: string, filePaths: string[]) =>
      invoke('git:stageFiles', repoPath, filePaths),
    unstageFiles: (repoPath: string, filePaths: string[]) =>
      invoke('git:unstageFiles', repoPath, filePaths),
    mergeBranch: (repoPath: string, branchName: string) =>
      invoke('git:mergeBranch', repoPath, branchName),
    getConflictFiles: (repoPath: string) => invoke('git:getConflictFiles', repoPath),
    abortMerge: (repoPath: string) => invoke('git:abortMerge', repoPath),
    getConflictContent: (repoPath: string, filePath: string) =>
      invoke('git:getConflictContent', repoPath, filePath),
    resolveConflict: (repoPath: string, filePath: string, strategy: 'ours' | 'theirs') =>
      invoke('git:resolveConflict', repoPath, filePath, strategy),
    rebaseBranch: (repoPath: string, targetBranch: string) =>
      invoke('git:rebaseBranch', repoPath, targetBranch),
    rebaseContinue: (repoPath: string) => invoke('git:rebaseContinue', repoPath),
    rebaseAbort: (repoPath: string) => invoke('git:rebaseAbort', repoPath),
    rebaseSkip: (repoPath: string) => invoke('git:rebaseSkip', repoPath),
    getRemoteUrl: (repoPath: string, remoteName?: string) =>
      invoke('git:getRemoteUrl', repoPath, remoteName),
    pushBranch: (repoPath: string, branchName: string, remoteName?: string, force?: boolean) =>
      invoke('git:pushBranch', repoPath, branchName, remoteName, force),
    getCommitLog: (repoPath: string, limit?: number) =>
      invoke('git:getCommitLog', repoPath, limit),
    getParsedDiff: (repoPath: string, filePath?: string) =>
      invoke('git:getParsedDiff', repoPath, filePath),
    getParsedStagedDiff: (repoPath: string, filePath?: string) =>
      invoke('git:getParsedStagedDiff', repoPath, filePath),
    checkoutBranch: (repoPath: string, branchName: string) =>
      invoke('git:checkoutBranch', repoPath, branchName),
    createBranch: (repoPath: string, branchName: string) =>
      invoke('git:createBranch', repoPath, branchName)
  },
  cli: {
    startSession: (sessionId: string, command: string, args: string[], cwd?: string) =>
      invoke('cli:startSession', sessionId, command, args, cwd),
    stopSession: (sessionId: string) => invoke('cli:stopSession', sessionId),
    getOutput: (sessionId: string) => invoke('cli:getOutput', sessionId)
  },
  claudeCode: {
    getConfig: () => invoke('claudeCode:getConfig'),
    saveConfig: (config: Record<string, unknown>) =>
      invoke('claudeCode:saveConfig', config),
    startSession: (sessionId: string, workdir: string, options?: { model?: string; prompt?: string }) =>
      invoke('claudeCode:startSession', sessionId, workdir, options),
    stopSession: (sessionId: string) => invoke('claudeCode:stopSession', sessionId),
    sendInput: (sessionId: string, input: string) =>
      invoke('claudeCode:sendInput', sessionId, input),
    getOutput: (sessionId: string) => invoke('claudeCode:getOutput', sessionId),
    getSessions: () => invoke('claudeCode:getSessions'),
    getSession: (sessionId: string) => invoke('claudeCode:getSession', sessionId),
    onOutput: (callback: (data: { sessionId: string; type: string; content: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; type: string; content: string }) =>
        callback(data)
      ipcRenderer.on('claudeCode:output', listener)
      return () => ipcRenderer.removeListener('claudeCode:output', listener)
    },
    onClose: (callback: (data: { sessionId: string; code: number }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; code: number }) => callback(data)
      ipcRenderer.on('claudeCode:close', listener)
      return () => ipcRenderer.removeListener('claudeCode:close', listener)
    },
    onError: (callback: (data: { sessionId: string; error: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; error: string }) => callback(data)
      ipcRenderer.on('claudeCode:error', listener)
      return () => ipcRenderer.removeListener('claudeCode:error', listener)
    }
  },
  cliSession: {
    startSession: (
      sessionId: string,
      toolId: string,
      workdir: string,
      options?: { model?: string; prompt?: string }
    ) => invoke('cliSession:startSession', sessionId, toolId, workdir, options),
    stopSession: (sessionId: string) => invoke('cliSession:stopSession', sessionId),
    sendInput: (sessionId: string, input: string) =>
      invoke('cliSession:sendInput', sessionId, input),
    getSessions: () => invoke('cliSession:getSessions'),
    getSession: (sessionId: string) => invoke('cliSession:getSession', sessionId),
    appendLog: (sessionId: string, msg: unknown, projectId?: string | null) =>
      invoke('cliSession:appendLog', sessionId, msg, projectId),
    onStatus: (callback: (data: { sessionId: string; status: string; forced?: boolean }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; status: string; forced?: boolean }) =>
        callback(data)
      ipcRenderer.on('cliSession:status', listener)
      return () => ipcRenderer.removeListener('cliSession:status', listener)
    },
    onOutput: (callback: (data: { sessionId: string; type: string; content: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; type: string; content: string }) =>
        callback(data)
      ipcRenderer.on('cliSession:output', listener)
      return () => ipcRenderer.removeListener('cliSession:output', listener)
    },
    onClose: (callback: (data: { sessionId: string; code: number; forcedStatus?: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; code: number; forcedStatus?: string }) => callback(data)
      ipcRenderer.on('cliSession:close', listener)
      return () => ipcRenderer.removeListener('cliSession:close', listener)
    },
    onError: (callback: (data: { sessionId: string; error: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; error: string }) => callback(data)
      ipcRenderer.on('cliSession:error', listener)
      return () => ipcRenderer.removeListener('cliSession:error', listener)
    }
  },
  logStream: {
    subscribe: (sessionId: string) => invoke('logStream:subscribe', sessionId),
    unsubscribe: (sessionId: string) => invoke('logStream:unsubscribe', sessionId),
    getHistory: (sessionId: string) => invoke('logStream:getHistory', sessionId),
    onMessage: (callback: (sessionId: string, msg: unknown) => void) => {
      const listener = (_: unknown, sessionId: string, msg: unknown) => callback(sessionId, msg)
      ipcRenderer.on('logStream:message', listener)
      return () => ipcRenderer.removeListener('logStream:message', listener)
    }
  },
  workNode: {
    onCompleted: (callback: (data: { id: string; name?: string }) => void) => {
      const listener = (_: unknown, data: { id: string; name?: string }) => callback(data)
      ipcRenderer.on('workNode:completed', listener)
      return () => ipcRenderer.removeListener('workNode:completed', listener)
    },
    onReview: (callback: (data: { id: string; name?: string }) => void) => {
      const listener = (_: unknown, data: { id: string; name?: string }) => callback(data)
      ipcRenderer.on('workNode:review', listener)
      return () => ipcRenderer.removeListener('workNode:review', listener)
    }
  },
  cliTools: {
    getAll: () => invoke('cliTools:getAll'),
    detect: (toolId: string) => invoke('cliTools:detect', toolId),
    detectAll: () => invoke('cliTools:detectAll')
  },
  cliToolConfig: {
    get: (toolId: string) => invoke('cliToolConfig:get', toolId),
    save: (toolId: string, config: Record<string, unknown>) =>
      invoke('cliToolConfig:save', toolId, config)
  },
  editor: {
    getAvailable: () => invoke('editor:getAvailable'),
    openProject: (projectPath: string, editorCommand: string) =>
      invoke('editor:openProject', projectPath, editorCommand)
  },
  pipeline: {
    execute: (pipelineId: string, stages: unknown[], workingDirectory?: string) =>
      invoke('pipeline:execute', pipelineId, stages, workingDirectory),
    getExecution: (executionId: string) => invoke('pipeline:getExecution', executionId),
    getAllExecutions: () => invoke('pipeline:getAllExecutions'),
    approveStage: (stageExecutionId: string, approvedBy: string) =>
      invoke('pipeline:approveStage', stageExecutionId, approvedBy),
    cancel: (executionId: string) => invoke('pipeline:cancel', executionId)
  },
  previewConfig: {
    getAll: () => invoke('previewConfig:getAll'),
    getByProject: (projectId: string) =>
      invoke('previewConfig:getByProject', projectId),
    get: (id: string) => invoke('previewConfig:get', id),
    add: (config: Record<string, unknown>) => invoke('previewConfig:add', config),
    update: (id: string, updates: Record<string, unknown>) =>
      invoke('previewConfig:update', id, updates),
    delete: (id: string) => invoke('previewConfig:delete', id)
  },
  preview: {
    start: (
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      cwd?: string,
      env?: Record<string, string>
    ) => invoke('preview:start', instanceId, configId, command, args, cwd, env),
    stop: (instanceId: string) => invoke('preview:stop', instanceId),
    getInstance: (instanceId: string) => invoke('preview:getInstance', instanceId),
    getAllInstances: () => invoke('preview:getAllInstances'),
    getOutput: (instanceId: string, limit?: number) =>
      invoke('preview:getOutput', instanceId, limit),
    clearInstance: (instanceId: string) => invoke('preview:clearInstance', instanceId)
  },
  notification: {
    show: (options: {
      title: string
      body: string
      icon?: string
      silent?: boolean
      urgency?: 'normal' | 'critical' | 'low'
    }) => invoke('notification:show', options),
    setEnabled: (enabled: boolean) => invoke('notification:setEnabled', enabled),
    isEnabled: () => invoke('notification:isEnabled'),
    setSoundEnabled: (enabled: boolean) =>
      invoke('notification:setSoundEnabled', enabled),
    isSoundEnabled: () => invoke('notification:isSoundEnabled'),
    setSoundSettings: (settings: {
      enabled?: boolean
      taskComplete?: boolean
      stageComplete?: boolean
      error?: boolean
    }) => invoke('notification:setSoundSettings', settings),
    getSoundSettings: () => invoke('notification:getSoundSettings')
  },
  database: {
    // Task operations
    createTask: (input: unknown) => invoke('db:createTask', input),
    getTask: (id: string) => invoke('db:getTask', id),
    getAllTasks: () => invoke('db:getAllTasks'),
    updateTask: (id: string, updates: unknown) => invoke('db:updateTask', id, updates),
    deleteTask: (id: string) => invoke('db:deleteTask', id),
    getTasksByProjectId: (projectId: string) =>
      invoke('db:getTasksByProjectId', projectId),
    // Workflow template operations
    getGlobalWorkflowTemplates: () => invoke('db:getGlobalWorkflowTemplates'),
    getWorkflowTemplatesByProject: (projectId: string) =>
      invoke('db:getWorkflowTemplatesByProject', projectId),
    getWorkflowTemplate: (templateId: string) =>
      invoke('db:getWorkflowTemplate', templateId),
    createWorkflowTemplate: (input: unknown) =>
      invoke('db:createWorkflowTemplate', input),
    updateWorkflowTemplate: (input: unknown) =>
      invoke('db:updateWorkflowTemplate', input),
    deleteWorkflowTemplate: (templateId: string, scope: string) =>
      invoke('db:deleteWorkflowTemplate', templateId, scope),
    copyGlobalWorkflowToProject: (globalTemplateId: string, projectId: string) =>
      invoke('db:copyGlobalWorkflowToProject', globalTemplateId, projectId),
    // Workflow instance operations
    createWorkflow: (taskId: string) =>
      invoke('db:createWorkflow', taskId),
    getWorkflow: (id: string) => invoke('db:getWorkflow', id),
    getWorkflowByTaskId: (taskId: string) => invoke('db:getWorkflowByTaskId', taskId),
    updateWorkflowStatus: (id: string, status: string, nodeIndex?: number) =>
      invoke('db:updateWorkflowStatus', id, status, nodeIndex),
    // WorkNode instance operations
    createWorkNode: (workflowId: string, templateId: string, nodeOrder: number) =>
      invoke('db:createWorkNode', workflowId, templateId, nodeOrder),
    getWorkNodesByWorkflowId: (workflowId: string) =>
      invoke('db:getWorkNodesByWorkflowId', workflowId),
    updateWorkNodeStatus: (id: string, status: string) =>
      invoke('db:updateWorkNodeStatus', id, status),
    approveWorkNode: (id: string) => invoke('db:approveWorkNode', id),
    rejectWorkNode: (id: string) => invoke('db:rejectWorkNode', id),
    approveTask: (id: string) => invoke('db:approveTask', id),
    // AgentExecution operations
    createAgentExecution: (workNodeId: string) =>
      invoke('db:createAgentExecution', workNodeId),
    getAgentExecutionsByWorkNodeId: (workNodeId: string) =>
      invoke('db:getAgentExecutionsByWorkNodeId', workNodeId),
    getLatestAgentExecution: (workNodeId: string) =>
      invoke('db:getLatestAgentExecution', workNodeId),
    updateAgentExecutionStatus: (id: string, status: string, cost?: number, duration?: number) =>
      invoke('db:updateAgentExecutionStatus', id, status, cost, duration)
  },
  fs: {
    readFile: (path: string) => invoke('fs:readFile', path),
    readTextFile: (path: string) => invoke('fs:readTextFile', path),
    writeFile: (path: string, data: unknown) => invoke('fs:writeFile', path, data),
    writeTextFile: (path: string, content: string) =>
      invoke('fs:writeTextFile', path, content),
    appendTextFile: (path: string, content: string) =>
      invoke('fs:appendTextFile', path, content),
    stat: (path: string) => invoke('fs:stat', path),
    readDir: (path: string, options?: { maxDepth?: number }) =>
      invoke('fs:readDir', path, options),
    exists: (path: string) => invoke('fs:exists', path),
    remove: (path: string, options?: { recursive?: boolean }) =>
      invoke('fs:remove', path, options),
    mkdir: (path: string) => invoke('fs:mkdir', path)
  },
  dialog: {
    save: (options: unknown) => invoke('dialog:save', options),
    open: (options: unknown) => invoke('dialog:open', options)
  },
  shell: {
    openUrl: (url: string) => invoke('shell:openUrl', url),
    openPath: (path: string) => invoke('shell:openPath', path),
    showItemInFolder: (path: string) => invoke('shell:showItemInFolder', path)
  },
  path: {
    appDataDir: () => invoke('path:appDataDir'),
    appConfigDir: () => invoke('path:appConfigDir'),
    tempDir: () => invoke('path:tempDir'),
    resourcesDir: () => invoke('path:resourcesDir'),
    appPath: () => invoke('path:appPath'),
    vibeworkDataDir: () => invoke('path:vibeworkDataDir'),
    homeDir: () => invoke('path:homeDir')
  },
  app: {
    getVersion: () => invoke('app:getVersion')
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (updates: unknown) => invoke('settings:update', updates),
    reset: () => invoke('settings:reset')
  },
  task: {
    create: (options: {
      title: string
      prompt: string
      projectId?: string
      projectPath?: string
      createWorktree?: boolean
      baseBranch?: string
      worktreeBranchPrefix?: string
      worktreeRootPath?: string
      cliToolId?: string
      workflowTemplateId?: string
    }) => invoke('task:create', options),
    get: (id: string) => invoke('task:get', id),
    getAll: () => invoke('task:getAll'),
    getByProject: (projectId: string) => invoke('task:getByProject', projectId),
    updateStatus: (id: string, status: string) => invoke('task:updateStatus', id, status),
    delete: (id: string, removeWorktree?: boolean) =>
      invoke('task:delete', id, removeWorktree)
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
