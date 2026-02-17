type ValueOf<T> = T[keyof T]

type NestedValueOf<T> = ValueOf<ValueOf<T>>

export const IPC_CHANNELS = {
  app: {
    getVersion: 'app:getVersion'
  },
  projects: {
    getAll: 'projects:getAll',
    get: 'projects:get',
    add: 'projects:add',
    update: 'projects:update',
    delete: 'projects:delete',
    checkPath: 'projects:checkPath'
  },
  git: {
    checkInstalled: 'git:checkInstalled',
    clone: 'git:clone',
    init: 'git:init',
    listWorktrees: 'git:listWorktrees',
    addWorktree: 'git:addWorktree',
    removeWorktree: 'git:removeWorktree',
    pruneWorktrees: 'git:pruneWorktrees',
    getDiff: 'git:getDiff',
    getStagedDiff: 'git:getStagedDiff',
    getBranches: 'git:getBranches',
    getCurrentBranch: 'git:getCurrentBranch',
    getChangedFiles: 'git:getChangedFiles',
    getBranchDiffFiles: 'git:getBranchDiffFiles',
    getBranchDiff: 'git:getBranchDiff',
    stageFiles: 'git:stageFiles',
    unstageFiles: 'git:unstageFiles',
    commit: 'git:commit',
    mergeBranch: 'git:mergeBranch',
    getConflictFiles: 'git:getConflictFiles',
    abortMerge: 'git:abortMerge',
    getConflictContent: 'git:getConflictContent',
    resolveConflict: 'git:resolveConflict',
    rebaseBranch: 'git:rebaseBranch',
    rebaseContinue: 'git:rebaseContinue',
    rebaseAbort: 'git:rebaseAbort',
    rebaseSkip: 'git:rebaseSkip',
    getRemoteUrl: 'git:getRemoteUrl',
    pushBranch: 'git:pushBranch',
    getCommitLog: 'git:getCommitLog',
    getParsedDiff: 'git:getParsedDiff',
    getParsedStagedDiff: 'git:getParsedStagedDiff',
    checkoutBranch: 'git:checkoutBranch',
    createBranch: 'git:createBranch'
  },
  cli: {
    startSession: 'cli:startSession',
    stopSession: 'cli:stopSession',
    getOutput: 'cli:getOutput'
  },
  terminal: {
    startSession: 'terminal:startSession',
    write: 'terminal:write',
    resize: 'terminal:resize',
    signal: 'terminal:signal',
    kill: 'terminal:kill',
    detach: 'terminal:detach',
    killByWorkspaceId: 'terminal:killByWorkspaceId'
  },
  cliSession: {
    startSession: 'cliSession:startSession',
    stopSession: 'cliSession:stopSession',
    sendInput: 'cliSession:sendInput',
    getSessions: 'cliSession:getSessions',
    getSession: 'cliSession:getSession'
  },
  logStream: {
    subscribe: 'logStream:subscribe',
    unsubscribe: 'logStream:unsubscribe',
    getHistory: 'logStream:getHistory'
  },
  cliTools: {
    getAll: 'cliTools:getAll',
    getSnapshot: 'cliTools:getSnapshot',
    refresh: 'cliTools:refresh',
    detect: 'cliTools:detect',
    detectAll: 'cliTools:detectAll'
  },
  cliToolConfig: {
    get: 'cliToolConfig:get',
    save: 'cliToolConfig:save'
  },
  editor: {
    getAvailable: 'editor:getAvailable',
    openProject: 'editor:openProject'
  },
  pipeline: {
    execute: 'pipeline:execute',
    getExecution: 'pipeline:getExecution',
    getAllExecutions: 'pipeline:getAllExecutions',
    approveStage: 'pipeline:approveStage',
    cancel: 'pipeline:cancel'
  },
  previewConfig: {
    getAll: 'previewConfig:getAll',
    getByProject: 'previewConfig:getByProject',
    get: 'previewConfig:get',
    add: 'previewConfig:add',
    update: 'previewConfig:update',
    delete: 'previewConfig:delete'
  },
  preview: {
    start: 'preview:start',
    stop: 'preview:stop',
    getInstance: 'preview:getInstance',
    getAllInstances: 'preview:getAllInstances',
    getOutput: 'preview:getOutput',
    clearInstance: 'preview:clearInstance'
  },
  notification: {
    show: 'notification:show',
    setEnabled: 'notification:setEnabled',
    isEnabled: 'notification:isEnabled',
    setSoundEnabled: 'notification:setSoundEnabled',
    isSoundEnabled: 'notification:isSoundEnabled',
    setSoundSettings: 'notification:setSoundSettings',
    getSoundSettings: 'notification:getSoundSettings'
  },
  database: {
    createTask: 'db:createTask',
    getTask: 'db:getTask',
    getAllTasks: 'db:getAllTasks',
    updateTask: 'db:updateTask',
    deleteTask: 'db:deleteTask',
    getTasksByProjectId: 'db:getTasksByProjectId',
    listAgentToolConfigs: 'db:listAgentToolConfigs',
    getAgentToolConfig: 'db:getAgentToolConfig',
    createAgentToolConfig: 'db:createAgentToolConfig',
    updateAgentToolConfig: 'db:updateAgentToolConfig',
    deleteAgentToolConfig: 'db:deleteAgentToolConfig',
    setDefaultAgentToolConfig: 'db:setDefaultAgentToolConfig',
    getGlobalWorkflowTemplates: 'db:getGlobalWorkflowTemplates',
    getWorkflowTemplatesByProject: 'db:getWorkflowTemplatesByProject',
    getWorkflowTemplate: 'db:getWorkflowTemplate',
    createWorkflowTemplate: 'db:createWorkflowTemplate',
    updateWorkflowTemplate: 'db:updateWorkflowTemplate',
    deleteWorkflowTemplate: 'db:deleteWorkflowTemplate',
    copyGlobalWorkflowToProject: 'db:copyGlobalWorkflowToProject',
    getTaskNodes: 'db:getTaskNodes',
    getTaskNode: 'db:getTaskNode',
    getCurrentTaskNode: 'db:getCurrentTaskNode',
    updateCurrentTaskNodeRuntime: 'db:updateCurrentTaskNodeRuntime',
    getTaskNodesByStatus: 'db:getTaskNodesByStatus',
    completeTaskNode: 'db:completeTaskNode',
    markTaskNodeErrorReview: 'db:markTaskNodeErrorReview',
    approveTaskNode: 'db:approveTaskNode',
    rerunTaskNode: 'db:rerunTaskNode',
    stopTaskNodeExecution: 'db:stopTaskNodeExecution'
  },
  fs: {
    readFile: 'fs:readFile',
    readTextFile: 'fs:readTextFile',
    writeFile: 'fs:writeFile',
    writeTextFile: 'fs:writeTextFile',
    appendTextFile: 'fs:appendTextFile',
    stat: 'fs:stat',
    readDir: 'fs:readDir',
    exists: 'fs:exists',
    remove: 'fs:remove',
    mkdir: 'fs:mkdir'
  },
  dialog: {
    save: 'dialog:save',
    open: 'dialog:open'
  },
  shell: {
    openUrl: 'shell:openUrl',
    openPath: 'shell:openPath',
    showItemInFolder: 'shell:showItemInFolder'
  },
  path: {
    appConfigDir: 'path:appConfigDir',
    tempDir: 'path:tempDir',
    resourcesDir: 'path:resourcesDir',
    appPath: 'path:appPath',
    vibeworkDataDir: 'path:vibeworkDataDir',
    homeDir: 'path:homeDir'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    reset: 'settings:reset'
  },
  task: {
    create: 'task:create',
    get: 'task:get',
    getAll: 'task:getAll',
    getByProject: 'task:getByProject',
    updateStatus: 'task:updateStatus',
    delete: 'task:delete',
    startExecution: 'task:startExecution',
    stopExecution: 'task:stopExecution'
  },
  automation: {
    create: 'automation:create',
    update: 'automation:update',
    delete: 'automation:delete',
    get: 'automation:get',
    list: 'automation:list',
    setEnabled: 'automation:setEnabled',
    runNow: 'automation:runNow',
    listRuns: 'automation:listRuns'
  }
} as const

export const IPC_EVENTS = {
  cliSession: {
    status: 'cliSession:status',
    output: 'cliSession:output',
    close: 'cliSession:close',
    error: 'cliSession:error'
  },
  terminal: {
    data: 'terminal:data',
    exit: 'terminal:exit',
    error: 'terminal:error'
  },
  logStream: {
    message: 'logStream:message'
  },
  taskNode: {
    completed: 'taskNode:completed',
    review: 'taskNode:review'
  },
  cliTools: {
    updated: 'cliTools:updated'
  }
} as const

export type IpcChannel = NestedValueOf<typeof IPC_CHANNELS>
export type IpcEvent = NestedValueOf<typeof IPC_EVENTS>

export type IpcContract<Args extends unknown[] = unknown[], Result = unknown> = {
  args: Args
  result: Result
}

export type OutputSnapshot = {
  output: string[]
  truncated: boolean
  byteLength: number
  entryCount: number
}

type UnknownRecord = Record<string, unknown>

export interface IpcContracts {
  'app:getVersion': IpcContract<[], string>

  'projects:getAll': IpcContract<[], unknown[]>
  'projects:get': IpcContract<[string], unknown>
  'projects:add': IpcContract<[UnknownRecord], unknown>
  'projects:update': IpcContract<[string, UnknownRecord], unknown>
  'projects:delete': IpcContract<[string], boolean>
  'projects:checkPath': IpcContract<
    [string],
    { exists: boolean; projectType?: 'normal' | 'git'; updated: boolean }
  >

  'git:checkInstalled': IpcContract<[], unknown>
  'git:clone': IpcContract<[string, string], unknown>
  'git:init': IpcContract<[string], unknown>
  'git:listWorktrees': IpcContract<[string], unknown>
  'git:addWorktree': IpcContract<[string, string, string, boolean, string?], unknown>
  'git:removeWorktree': IpcContract<[string, string, boolean], unknown>
  'git:pruneWorktrees': IpcContract<[string], unknown>
  'git:getDiff': IpcContract<[string, string?], unknown>
  'git:getStagedDiff': IpcContract<[string, string?], unknown>
  'git:getBranches': IpcContract<[string], unknown>
  'git:getCurrentBranch': IpcContract<[string], unknown>
  'git:getChangedFiles': IpcContract<[string], unknown>
  'git:getBranchDiffFiles': IpcContract<[string, string, string?], unknown>
  'git:getBranchDiff': IpcContract<[string, string, string?, string?], unknown>
  'git:stageFiles': IpcContract<[string, string[]], unknown>
  'git:unstageFiles': IpcContract<[string, string[]], unknown>
  'git:commit': IpcContract<[string, string], unknown>
  'git:mergeBranch': IpcContract<[string, string], unknown>
  'git:getConflictFiles': IpcContract<[string], unknown>
  'git:abortMerge': IpcContract<[string], unknown>
  'git:getConflictContent': IpcContract<[string, string], unknown>
  'git:resolveConflict': IpcContract<[string, string, 'ours' | 'theirs'], unknown>
  'git:rebaseBranch': IpcContract<[string, string], unknown>
  'git:rebaseContinue': IpcContract<[string], unknown>
  'git:rebaseAbort': IpcContract<[string], unknown>
  'git:rebaseSkip': IpcContract<[string], unknown>
  'git:getRemoteUrl': IpcContract<[string, string?], unknown>
  'git:pushBranch': IpcContract<[string, string, string?, boolean?], unknown>
  'git:getCommitLog': IpcContract<[string, number?], unknown>
  'git:getParsedDiff': IpcContract<[string, string?], unknown>
  'git:getParsedStagedDiff': IpcContract<[string, string?], unknown>
  'git:checkoutBranch': IpcContract<[string, string], unknown>
  'git:createBranch': IpcContract<[string, string], unknown>

  'cli:startSession': IpcContract<[string, string, string[], string?], unknown>
  'cli:stopSession': IpcContract<[string], unknown>
  'cli:getOutput': IpcContract<[string], OutputSnapshot>

  'terminal:startSession': IpcContract<[string, string, number?, number?, string?], { paneId: string; isNew: boolean }>
  'terminal:write': IpcContract<[string, string], unknown>
  'terminal:resize': IpcContract<[string, number, number], unknown>
  'terminal:signal': IpcContract<[string, string?], unknown>
  'terminal:kill': IpcContract<[string], unknown>
  'terminal:detach': IpcContract<[string], unknown>
  'terminal:killByWorkspaceId': IpcContract<[string], { killed: number; failed: number }>

  'cliSession:startSession': IpcContract<
    [
      string,
      string,
      string,
      {
        model?: string
        prompt?: string
        projectId?: string | null
        taskId?: string
        taskNodeId?: string
        configId?: string | null
      }?
    ],
    unknown
  >
  'cliSession:stopSession': IpcContract<[string], unknown>
  'cliSession:sendInput': IpcContract<[string, string], unknown>
  'cliSession:getSessions': IpcContract<[], unknown[]>
  'cliSession:getSession': IpcContract<[string], unknown>

  'logStream:subscribe': IpcContract<[string], { success: boolean; error?: string }>
  'logStream:unsubscribe': IpcContract<[string], { success: boolean; error?: string }>
  'logStream:getHistory': IpcContract<[string, (string | null)?, (string | null)?], unknown[]>

  'cliTools:getAll': IpcContract<[], unknown[]>
  'cliTools:getSnapshot': IpcContract<[], unknown[]>
  'cliTools:refresh': IpcContract<[UnknownRecord?], unknown[]>
  'cliTools:detect': IpcContract<[string, UnknownRecord?], unknown>
  'cliTools:detectAll': IpcContract<[UnknownRecord?], unknown[]>

  'cliToolConfig:get': IpcContract<[string], UnknownRecord>
  'cliToolConfig:save': IpcContract<[string, UnknownRecord], unknown>

  'editor:getAvailable': IpcContract<[], unknown[]>
  'editor:openProject': IpcContract<[string, string], unknown>

  'pipeline:execute': IpcContract<[string, UnknownRecord[], string?], { executionId: string }>
  'pipeline:getExecution': IpcContract<[string], unknown>
  'pipeline:getAllExecutions': IpcContract<[], unknown[]>
  'pipeline:approveStage': IpcContract<[string, string], unknown>
  'pipeline:cancel': IpcContract<[string], unknown>

  'previewConfig:getAll': IpcContract<[], unknown[]>
  'previewConfig:getByProject': IpcContract<[string], unknown[]>
  'previewConfig:get': IpcContract<[string], unknown>
  'previewConfig:add': IpcContract<[UnknownRecord], unknown>
  'previewConfig:update': IpcContract<[string, UnknownRecord], unknown>
  'previewConfig:delete': IpcContract<[string], unknown>

  'preview:start': IpcContract<
    [string, string, string, string[], string?, Record<string, string>?],
    unknown
  >
  'preview:stop': IpcContract<[string], unknown>
  'preview:getInstance': IpcContract<[string], unknown>
  'preview:getAllInstances': IpcContract<[], unknown[]>
  'preview:getOutput': IpcContract<[string, number?], string[]>
  'preview:clearInstance': IpcContract<[string], unknown>

  'notification:show': IpcContract<
    [{ title: string; body: string; icon?: string; silent?: boolean; urgency?: 'normal' | 'critical' | 'low' }],
    unknown
  >
  'notification:setEnabled': IpcContract<[boolean], unknown>
  'notification:isEnabled': IpcContract<[], boolean>
  'notification:setSoundEnabled': IpcContract<[boolean], unknown>
  'notification:isSoundEnabled': IpcContract<[], boolean>
  'notification:setSoundSettings': IpcContract<
    [{ enabled?: boolean; taskComplete?: boolean; stageComplete?: boolean; error?: boolean }],
    unknown
  >
  'notification:getSoundSettings': IpcContract<[], unknown>

  'db:createTask': IpcContract<[UnknownRecord], unknown>
  'db:getTask': IpcContract<[string], unknown>
  'db:getAllTasks': IpcContract<[], unknown[]>
  'db:updateTask': IpcContract<[string, UnknownRecord], unknown>
  'db:deleteTask': IpcContract<[string], unknown>
  'db:getTasksByProjectId': IpcContract<[string], unknown[]>
  'db:listAgentToolConfigs': IpcContract<[string?], unknown[]>
  'db:getAgentToolConfig': IpcContract<[string], unknown>
  'db:createAgentToolConfig': IpcContract<[UnknownRecord], unknown>
  'db:updateAgentToolConfig': IpcContract<[string, UnknownRecord], unknown>
  'db:deleteAgentToolConfig': IpcContract<[string], unknown>
  'db:setDefaultAgentToolConfig': IpcContract<[string], unknown>
  'db:getGlobalWorkflowTemplates': IpcContract<[], unknown[]>
  'db:getWorkflowTemplatesByProject': IpcContract<[string], unknown[]>
  'db:getWorkflowTemplate': IpcContract<[string], unknown>
  'db:createWorkflowTemplate': IpcContract<[UnknownRecord], unknown>
  'db:updateWorkflowTemplate': IpcContract<[UnknownRecord], unknown>
  'db:deleteWorkflowTemplate': IpcContract<[string, 'global' | 'project'], unknown>
  'db:copyGlobalWorkflowToProject': IpcContract<[string, string], unknown>
  'db:getTaskNodes': IpcContract<[string], unknown[]>
  'db:getTaskNode': IpcContract<[string], unknown>
  'db:getCurrentTaskNode': IpcContract<[string], unknown>
  'db:updateCurrentTaskNodeRuntime': IpcContract<
    [
      string,
      {
        session_id?: string | null
        resume_session_id?: string | null
        cli_tool_id?: string | null
        agent_tool_config_id?: string | null
      }
    ],
    unknown
  >
  'db:getTaskNodesByStatus': IpcContract<[string, string], unknown[]>
  'db:completeTaskNode': IpcContract<
    [
      string,
      {
        resultSummary?: string | null
        cost?: number | null
        duration?: number | null
        sessionId?: string | null
        allowConversationCompletion?: boolean
      }?
    ],
    unknown
  >
  'db:markTaskNodeErrorReview': IpcContract<[string, string], unknown>
  'db:approveTaskNode': IpcContract<[string], unknown>
  'db:rerunTaskNode': IpcContract<[string], unknown>
  'db:stopTaskNodeExecution': IpcContract<[string, string?], unknown>

  'fs:readFile': IpcContract<[string], Uint8Array>
  'fs:readTextFile': IpcContract<[string], string>
  'fs:writeFile': IpcContract<[string, Uint8Array | string], unknown>
  'fs:writeTextFile': IpcContract<[string, string], unknown>
  'fs:appendTextFile': IpcContract<[string, string], unknown>
  'fs:stat': IpcContract<[string], { size: number; isFile: boolean; isDirectory: boolean }>
  'fs:readDir': IpcContract<[string, { maxDepth?: number }?], unknown[]>
  'fs:exists': IpcContract<[string], boolean>
  'fs:remove': IpcContract<[string, { recursive?: boolean }?], unknown>
  'fs:mkdir': IpcContract<[string], unknown>

  'dialog:save': IpcContract<[UnknownRecord], string | null>
  'dialog:open': IpcContract<[UnknownRecord], string | string[] | null>

  'shell:openUrl': IpcContract<[string], unknown>
  'shell:openPath': IpcContract<[string], unknown>
  'shell:showItemInFolder': IpcContract<[string], unknown>

  'path:appConfigDir': IpcContract<[], string>
  'path:tempDir': IpcContract<[], string>
  'path:resourcesDir': IpcContract<[], string>
  'path:appPath': IpcContract<[], string>
  'path:vibeworkDataDir': IpcContract<[], string>
  'path:homeDir': IpcContract<[], string>

  'settings:get': IpcContract<[], UnknownRecord>
  'settings:update': IpcContract<[UnknownRecord], UnknownRecord>
  'settings:reset': IpcContract<[], UnknownRecord>

  'task:create': IpcContract<
    [
      {
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
      }
    ],
    unknown
  >
  'task:get': IpcContract<[string], unknown>
  'task:getAll': IpcContract<[], unknown[]>
  'task:getByProject': IpcContract<[string], unknown[]>
  'task:updateStatus': IpcContract<[string, string], unknown>
  'task:delete': IpcContract<[string, boolean?], unknown>
  'task:startExecution': IpcContract<[string], unknown>
  'task:stopExecution': IpcContract<[string], unknown>

  'automation:create': IpcContract<[UnknownRecord], unknown>
  'automation:update': IpcContract<[string, UnknownRecord], unknown>
  'automation:delete': IpcContract<[string], boolean>
  'automation:get': IpcContract<[string], unknown>
  'automation:list': IpcContract<[], unknown[]>
  'automation:setEnabled': IpcContract<[string, boolean], unknown>
  'automation:runNow': IpcContract<[string], unknown>
  'automation:listRuns': IpcContract<[string, number?], unknown[]>
}

export type IpcContractChannel = keyof IpcContracts
export type IpcArgs<C extends IpcContractChannel> = IpcContracts[C]['args']
export type IpcResult<C extends IpcContractChannel> = IpcContracts[C]['result']
