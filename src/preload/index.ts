import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, IPC_EVENTS } from '../main/ipc/channels'

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
    getAll: () => invoke(IPC_CHANNELS.projects.getAll),
    get: (id: string) => invoke(IPC_CHANNELS.projects.get, id),
    add: (project: Record<string, unknown>) => invoke(IPC_CHANNELS.projects.add, project),
    update: (id: string, updates: Record<string, unknown>) =>
      invoke(IPC_CHANNELS.projects.update, id, updates),
    delete: (id: string) => invoke(IPC_CHANNELS.projects.delete, id),
    checkPath: (id: string) => invoke(IPC_CHANNELS.projects.checkPath, id)
  },
  git: {
    checkInstalled: () => invoke(IPC_CHANNELS.git.checkInstalled),
    clone: (remoteUrl: string, targetPath: string) =>
      invoke(IPC_CHANNELS.git.clone, remoteUrl, targetPath),
    init: (path: string) => invoke(IPC_CHANNELS.git.init, path),
    listWorktrees: (repoPath: string) => invoke(IPC_CHANNELS.git.listWorktrees, repoPath),
    addWorktree: (
      repoPath: string,
      worktreePath: string,
      branchName: string,
      createBranch: boolean,
      baseBranch?: string
    ) =>
      invoke(
        IPC_CHANNELS.git.addWorktree,
        repoPath,
        worktreePath,
        branchName,
        createBranch,
        baseBranch
      ),
    removeWorktree: (repoPath: string, worktreePath: string, force: boolean) =>
      invoke(IPC_CHANNELS.git.removeWorktree, repoPath, worktreePath, force),
    pruneWorktrees: (repoPath: string) => invoke(IPC_CHANNELS.git.pruneWorktrees, repoPath),
    getDiff: (repoPath: string, filePath?: string) =>
      invoke(IPC_CHANNELS.git.getDiff, repoPath, filePath),
    getStagedDiff: (repoPath: string, filePath?: string) =>
      invoke(IPC_CHANNELS.git.getStagedDiff, repoPath, filePath),
    getBranches: (repoPath: string) => invoke(IPC_CHANNELS.git.getBranches, repoPath),
    getCurrentBranch: (repoPath: string) => invoke(IPC_CHANNELS.git.getCurrentBranch, repoPath),
    getChangedFiles: (repoPath: string) => invoke(IPC_CHANNELS.git.getChangedFiles, repoPath),
    getBranchDiffFiles: (
      repoPath: string,
      baseBranch: string,
      compareBranch?: string
    ) => invoke(IPC_CHANNELS.git.getBranchDiffFiles, repoPath, baseBranch, compareBranch),
    getBranchDiff: (
      repoPath: string,
      baseBranch: string,
      compareBranch?: string,
      filePath?: string
    ) => invoke(IPC_CHANNELS.git.getBranchDiff, repoPath, baseBranch, compareBranch, filePath),
    stageFiles: (repoPath: string, filePaths: string[]) =>
      invoke(IPC_CHANNELS.git.stageFiles, repoPath, filePaths),
    unstageFiles: (repoPath: string, filePaths: string[]) =>
      invoke(IPC_CHANNELS.git.unstageFiles, repoPath, filePaths),
    commit: (repoPath: string, message: string) =>
      invoke(IPC_CHANNELS.git.commit, repoPath, message),
    mergeBranch: (repoPath: string, branchName: string) =>
      invoke(IPC_CHANNELS.git.mergeBranch, repoPath, branchName),
    getConflictFiles: (repoPath: string) => invoke(IPC_CHANNELS.git.getConflictFiles, repoPath),
    abortMerge: (repoPath: string) => invoke(IPC_CHANNELS.git.abortMerge, repoPath),
    getConflictContent: (repoPath: string, filePath: string) =>
      invoke(IPC_CHANNELS.git.getConflictContent, repoPath, filePath),
    resolveConflict: (repoPath: string, filePath: string, strategy: 'ours' | 'theirs') =>
      invoke(IPC_CHANNELS.git.resolveConflict, repoPath, filePath, strategy),
    rebaseBranch: (repoPath: string, targetBranch: string) =>
      invoke(IPC_CHANNELS.git.rebaseBranch, repoPath, targetBranch),
    rebaseContinue: (repoPath: string) => invoke(IPC_CHANNELS.git.rebaseContinue, repoPath),
    rebaseAbort: (repoPath: string) => invoke(IPC_CHANNELS.git.rebaseAbort, repoPath),
    rebaseSkip: (repoPath: string) => invoke(IPC_CHANNELS.git.rebaseSkip, repoPath),
    getRemoteUrl: (repoPath: string, remoteName?: string) =>
      invoke(IPC_CHANNELS.git.getRemoteUrl, repoPath, remoteName),
    pushBranch: (repoPath: string, branchName: string, remoteName?: string, force?: boolean) =>
      invoke(IPC_CHANNELS.git.pushBranch, repoPath, branchName, remoteName, force),
    getCommitLog: (repoPath: string, limit?: number) =>
      invoke(IPC_CHANNELS.git.getCommitLog, repoPath, limit),
    getParsedDiff: (repoPath: string, filePath?: string) =>
      invoke(IPC_CHANNELS.git.getParsedDiff, repoPath, filePath),
    getParsedStagedDiff: (repoPath: string, filePath?: string) =>
      invoke(IPC_CHANNELS.git.getParsedStagedDiff, repoPath, filePath),
    checkoutBranch: (repoPath: string, branchName: string) =>
      invoke(IPC_CHANNELS.git.checkoutBranch, repoPath, branchName),
    createBranch: (repoPath: string, branchName: string) =>
      invoke(IPC_CHANNELS.git.createBranch, repoPath, branchName)
  },
  cli: {
    startSession: (sessionId: string, command: string, args: string[], cwd?: string) =>
      invoke(IPC_CHANNELS.cli.startSession, sessionId, command, args, cwd),
    stopSession: (sessionId: string) => invoke(IPC_CHANNELS.cli.stopSession, sessionId),
    getOutput: (sessionId: string) => invoke(IPC_CHANNELS.cli.getOutput, sessionId)
  },
  terminal: {
    startSession: (
      paneId: string,
      cwd: string,
      cols?: number,
      rows?: number,
      workspaceId?: string
    ) => invoke(IPC_CHANNELS.terminal.startSession, paneId, cwd, cols, rows, workspaceId),
    write: (paneId: string, data: string) => invoke(IPC_CHANNELS.terminal.write, paneId, data),
    resize: (paneId: string, cols: number, rows: number) =>
      invoke(IPC_CHANNELS.terminal.resize, paneId, cols, rows),
    signal: (paneId: string, signal?: string) =>
      invoke(IPC_CHANNELS.terminal.signal, paneId, signal),
    kill: (paneId: string) => invoke(IPC_CHANNELS.terminal.kill, paneId),
    detach: (paneId: string) => invoke(IPC_CHANNELS.terminal.detach, paneId),
    killByWorkspaceId: (workspaceId: string) =>
      invoke(IPC_CHANNELS.terminal.killByWorkspaceId, workspaceId),
    onData: (callback: (data: { paneId: string; data: string }) => void) => {
      const listener = (_: unknown, data: { paneId: string; data: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.terminal.data, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.terminal.data, listener)
    },
    onExit: (callback: (data: { paneId: string; exitCode: number; signal?: number }) => void) => {
      const listener = (
        _: unknown,
        data: { paneId: string; exitCode: number; signal?: number }
      ) => callback(data)
      ipcRenderer.on(IPC_EVENTS.terminal.exit, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.terminal.exit, listener)
    },
    onError: (callback: (data: { paneId: string; error: string }) => void) => {
      const listener = (_: unknown, data: { paneId: string; error: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.terminal.error, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.terminal.error, listener)
    }
  },
  cliSession: {
    startSession: (
      sessionId: string,
      toolId: string,
      workdir: string,
      options?: { model?: string; prompt?: string; projectId?: string | null; taskId?: string; configId?: string | null }
    ) => invoke(IPC_CHANNELS.cliSession.startSession, sessionId, toolId, workdir, options),
    stopSession: (sessionId: string) => invoke(IPC_CHANNELS.cliSession.stopSession, sessionId),
    sendInput: (sessionId: string, input: string) =>
      invoke(IPC_CHANNELS.cliSession.sendInput, sessionId, input),
    getSessions: () => invoke(IPC_CHANNELS.cliSession.getSessions),
    getSession: (sessionId: string) => invoke(IPC_CHANNELS.cliSession.getSession, sessionId),
    appendLog: (taskId: string, sessionId: string, msg: unknown, projectId?: string | null) =>
      invoke(IPC_CHANNELS.cliSession.appendLog, taskId, sessionId, msg, projectId),
    onStatus: (callback: (data: { sessionId: string; status: string; forced?: boolean }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; status: string; forced?: boolean }) =>
        callback(data)
      ipcRenderer.on(IPC_EVENTS.cliSession.status, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.cliSession.status, listener)
    },
    onOutput: (callback: (data: { sessionId: string; type: string; content: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; type: string; content: string }) =>
        callback(data)
      ipcRenderer.on(IPC_EVENTS.cliSession.output, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.cliSession.output, listener)
    },
    onClose: (callback: (data: { sessionId: string; code: number; forcedStatus?: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; code: number; forcedStatus?: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.cliSession.close, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.cliSession.close, listener)
    },
    onError: (callback: (data: { sessionId: string; error: string }) => void) => {
      const listener = (_: unknown, data: { sessionId: string; error: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.cliSession.error, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.cliSession.error, listener)
    }
  },
  logStream: {
    subscribe: (sessionId: string) => invoke(IPC_CHANNELS.logStream.subscribe, sessionId),
    unsubscribe: (sessionId: string) => invoke(IPC_CHANNELS.logStream.unsubscribe, sessionId),
    getHistory: (taskId: string, sessionId?: string | null) =>
      invoke(IPC_CHANNELS.logStream.getHistory, taskId, sessionId || null),
    onMessage: (callback: (sessionId: string, msg: unknown) => void) => {
      const listener = (_: unknown, sessionId: string, msg: unknown) => callback(sessionId, msg)
      ipcRenderer.on(IPC_EVENTS.logStream.message, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.logStream.message, listener)
    }
  },
  workNode: {
    onCompleted: (callback: (data: { id: string; name?: string }) => void) => {
      const listener = (_: unknown, data: { id: string; name?: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.workNode.completed, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.workNode.completed, listener)
    },
    onReview: (callback: (data: { id: string; name?: string }) => void) => {
      const listener = (_: unknown, data: { id: string; name?: string }) => callback(data)
      ipcRenderer.on(IPC_EVENTS.workNode.review, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.workNode.review, listener)
    }
  },
  cliTools: {
    getAll: () => invoke(IPC_CHANNELS.cliTools.getAll),
    detect: (toolId: string) => invoke(IPC_CHANNELS.cliTools.detect, toolId),
    detectAll: () => invoke(IPC_CHANNELS.cliTools.detectAll)
  },
  cliToolConfig: {
    get: (toolId: string) => invoke(IPC_CHANNELS.cliToolConfig.get, toolId),
    save: (toolId: string, config: Record<string, unknown>) =>
      invoke(IPC_CHANNELS.cliToolConfig.save, toolId, config)
  },
  editor: {
    getAvailable: () => invoke(IPC_CHANNELS.editor.getAvailable),
    openProject: (projectPath: string, editorCommand: string) =>
      invoke(IPC_CHANNELS.editor.openProject, projectPath, editorCommand)
  },
  pipeline: {
    execute: (pipelineId: string, stages: unknown[], workingDirectory?: string) =>
      invoke(IPC_CHANNELS.pipeline.execute, pipelineId, stages, workingDirectory),
    getExecution: (executionId: string) => invoke(IPC_CHANNELS.pipeline.getExecution, executionId),
    getAllExecutions: () => invoke(IPC_CHANNELS.pipeline.getAllExecutions),
    approveStage: (stageExecutionId: string, approvedBy: string) =>
      invoke(IPC_CHANNELS.pipeline.approveStage, stageExecutionId, approvedBy),
    cancel: (executionId: string) => invoke(IPC_CHANNELS.pipeline.cancel, executionId)
  },
  previewConfig: {
    getAll: () => invoke(IPC_CHANNELS.previewConfig.getAll),
    getByProject: (projectId: string) =>
      invoke(IPC_CHANNELS.previewConfig.getByProject, projectId),
    get: (id: string) => invoke(IPC_CHANNELS.previewConfig.get, id),
    add: (config: Record<string, unknown>) => invoke(IPC_CHANNELS.previewConfig.add, config),
    update: (id: string, updates: Record<string, unknown>) =>
      invoke(IPC_CHANNELS.previewConfig.update, id, updates),
    delete: (id: string) => invoke(IPC_CHANNELS.previewConfig.delete, id)
  },
  preview: {
    start: (
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      cwd?: string,
      env?: Record<string, string>
    ) => invoke(IPC_CHANNELS.preview.start, instanceId, configId, command, args, cwd, env),
    stop: (instanceId: string) => invoke(IPC_CHANNELS.preview.stop, instanceId),
    getInstance: (instanceId: string) => invoke(IPC_CHANNELS.preview.getInstance, instanceId),
    getAllInstances: () => invoke(IPC_CHANNELS.preview.getAllInstances),
    getOutput: (instanceId: string, limit?: number) =>
      invoke(IPC_CHANNELS.preview.getOutput, instanceId, limit),
    clearInstance: (instanceId: string) => invoke(IPC_CHANNELS.preview.clearInstance, instanceId)
  },
  notification: {
    show: (options: {
      title: string
      body: string
      icon?: string
      silent?: boolean
      urgency?: 'normal' | 'critical' | 'low'
    }) => invoke(IPC_CHANNELS.notification.show, options),
    setEnabled: (enabled: boolean) => invoke(IPC_CHANNELS.notification.setEnabled, enabled),
    isEnabled: () => invoke(IPC_CHANNELS.notification.isEnabled),
    setSoundEnabled: (enabled: boolean) =>
      invoke(IPC_CHANNELS.notification.setSoundEnabled, enabled),
    isSoundEnabled: () => invoke(IPC_CHANNELS.notification.isSoundEnabled),
    setSoundSettings: (settings: {
      enabled?: boolean
      taskComplete?: boolean
      stageComplete?: boolean
      error?: boolean
    }) => invoke(IPC_CHANNELS.notification.setSoundSettings, settings),
    getSoundSettings: () => invoke(IPC_CHANNELS.notification.getSoundSettings)
  },
  database: {
    // Task operations
    createTask: (input: unknown) => invoke(IPC_CHANNELS.database.createTask, input),
    getTask: (id: string) => invoke(IPC_CHANNELS.database.getTask, id),
    getAllTasks: () => invoke(IPC_CHANNELS.database.getAllTasks),
    updateTask: (id: string, updates: unknown) =>
      invoke(IPC_CHANNELS.database.updateTask, id, updates),
    deleteTask: (id: string) => invoke(IPC_CHANNELS.database.deleteTask, id),
    getTasksByProjectId: (projectId: string) =>
      invoke(IPC_CHANNELS.database.getTasksByProjectId, projectId),
    listAgentToolConfigs: (toolId?: string) =>
      invoke(IPC_CHANNELS.database.listAgentToolConfigs, toolId),
    getAgentToolConfig: (id: string) =>
      invoke(IPC_CHANNELS.database.getAgentToolConfig, id),
    createAgentToolConfig: (input: unknown) =>
      invoke(IPC_CHANNELS.database.createAgentToolConfig, input),
    updateAgentToolConfig: (id: string, updates: unknown) =>
      invoke(IPC_CHANNELS.database.updateAgentToolConfig, id, updates),
    deleteAgentToolConfig: (id: string) =>
      invoke(IPC_CHANNELS.database.deleteAgentToolConfig, id),
    setDefaultAgentToolConfig: (id: string) =>
      invoke(IPC_CHANNELS.database.setDefaultAgentToolConfig, id),
    // Workflow template operations
    getGlobalWorkflowTemplates: () => invoke(IPC_CHANNELS.database.getGlobalWorkflowTemplates),
    getWorkflowTemplatesByProject: (projectId: string) =>
      invoke(IPC_CHANNELS.database.getWorkflowTemplatesByProject, projectId),
    getWorkflowTemplate: (templateId: string) =>
      invoke(IPC_CHANNELS.database.getWorkflowTemplate, templateId),
    createWorkflowTemplate: (input: unknown) =>
      invoke(IPC_CHANNELS.database.createWorkflowTemplate, input),
    updateWorkflowTemplate: (input: unknown) =>
      invoke(IPC_CHANNELS.database.updateWorkflowTemplate, input),
    deleteWorkflowTemplate: (templateId: string, scope: string) =>
      invoke(IPC_CHANNELS.database.deleteWorkflowTemplate, templateId, scope),
    copyGlobalWorkflowToProject: (globalTemplateId: string, projectId: string) =>
      invoke(IPC_CHANNELS.database.copyGlobalWorkflowToProject, globalTemplateId, projectId),
    // Workflow instance operations
    createWorkflow: (taskId: string) =>
      invoke(IPC_CHANNELS.database.createWorkflow, taskId),
    getWorkflow: (id: string) => invoke(IPC_CHANNELS.database.getWorkflow, id),
    getWorkflowByTaskId: (taskId: string) =>
      invoke(IPC_CHANNELS.database.getWorkflowByTaskId, taskId),
    updateWorkflowStatus: (id: string, status: string, nodeIndex?: number) =>
      invoke(IPC_CHANNELS.database.updateWorkflowStatus, id, status, nodeIndex),
    // WorkNode instance operations
    createWorkNode: (workflowId: string, templateId: string, nodeOrder: number) =>
      invoke(IPC_CHANNELS.database.createWorkNode, workflowId, templateId, nodeOrder),
    getWorkNodesByWorkflowId: (workflowId: string) =>
      invoke(IPC_CHANNELS.database.getWorkNodesByWorkflowId, workflowId),
    updateWorkNodeStatus: (id: string, status: string) =>
      invoke(IPC_CHANNELS.database.updateWorkNodeStatus, id, status),
    approveWorkNode: (id: string) => invoke(IPC_CHANNELS.database.approveWorkNode, id),
    rejectWorkNode: (id: string) => invoke(IPC_CHANNELS.database.rejectWorkNode, id),
    approveTask: (id: string) => invoke(IPC_CHANNELS.database.approveTask, id),
    // AgentExecution operations
    createAgentExecution: (workNodeId: string) =>
      invoke(IPC_CHANNELS.database.createAgentExecution, workNodeId),
    getAgentExecutionsByWorkNodeId: (workNodeId: string) =>
      invoke(IPC_CHANNELS.database.getAgentExecutionsByWorkNodeId, workNodeId),
    getLatestAgentExecution: (workNodeId: string) =>
      invoke(IPC_CHANNELS.database.getLatestAgentExecution, workNodeId),
    updateAgentExecutionStatus: (id: string, status: string, cost?: number, duration?: number) =>
      invoke(IPC_CHANNELS.database.updateAgentExecutionStatus, id, status, cost, duration)
  },
  fs: {
    readFile: (path: string) => invoke(IPC_CHANNELS.fs.readFile, path),
    readTextFile: (path: string) => invoke(IPC_CHANNELS.fs.readTextFile, path),
    writeFile: (path: string, data: unknown) => invoke(IPC_CHANNELS.fs.writeFile, path, data),
    writeTextFile: (path: string, content: string) =>
      invoke(IPC_CHANNELS.fs.writeTextFile, path, content),
    appendTextFile: (path: string, content: string) =>
      invoke(IPC_CHANNELS.fs.appendTextFile, path, content),
    stat: (path: string) => invoke(IPC_CHANNELS.fs.stat, path),
    readDir: (path: string, options?: { maxDepth?: number }) =>
      invoke(IPC_CHANNELS.fs.readDir, path, options),
    exists: (path: string) => invoke(IPC_CHANNELS.fs.exists, path),
    remove: (path: string, options?: { recursive?: boolean }) =>
      invoke(IPC_CHANNELS.fs.remove, path, options),
    mkdir: (path: string) => invoke(IPC_CHANNELS.fs.mkdir, path)
  },
  dialog: {
    save: (options: unknown) => invoke(IPC_CHANNELS.dialog.save, options),
    open: (options: unknown) => invoke(IPC_CHANNELS.dialog.open, options)
  },
  shell: {
    openUrl: (url: string) => invoke(IPC_CHANNELS.shell.openUrl, url),
    openPath: (path: string) => invoke(IPC_CHANNELS.shell.openPath, path),
    showItemInFolder: (path: string) => invoke(IPC_CHANNELS.shell.showItemInFolder, path)
  },
  path: {
    appDataDir: () => invoke(IPC_CHANNELS.path.appDataDir),
    appConfigDir: () => invoke(IPC_CHANNELS.path.appConfigDir),
    tempDir: () => invoke(IPC_CHANNELS.path.tempDir),
    resourcesDir: () => invoke(IPC_CHANNELS.path.resourcesDir),
    appPath: () => invoke(IPC_CHANNELS.path.appPath),
    vibeworkDataDir: () => invoke(IPC_CHANNELS.path.vibeworkDataDir),
    homeDir: () => invoke(IPC_CHANNELS.path.homeDir)
  },
  app: {
    getVersion: () => invoke(IPC_CHANNELS.app.getVersion)
  },
  settings: {
    get: () => invoke(IPC_CHANNELS.settings.get),
    update: (updates: unknown) => invoke(IPC_CHANNELS.settings.update, updates),
    reset: () => invoke(IPC_CHANNELS.settings.reset)
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
      agentToolConfigId?: string
      agentToolConfigSnapshot?: string
      workflowTemplateId?: string
    }) => invoke(IPC_CHANNELS.task.create, options),
    get: (id: string) => invoke(IPC_CHANNELS.task.get, id),
    getAll: () => invoke(IPC_CHANNELS.task.getAll),
    getByProject: (projectId: string) => invoke(IPC_CHANNELS.task.getByProject, projectId),
    updateStatus: (id: string, status: string) =>
      invoke(IPC_CHANNELS.task.updateStatus, id, status),
    delete: (id: string, removeWorktree?: boolean) =>
      invoke(IPC_CHANNELS.task.delete, id, removeWorktree)
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
