import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, stat, rm, access, readdir, realpath, mkdir } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconMac from '../../resources/icon-mac.png?asset'
import { getAppPaths } from './services/AppPaths'
import { ProjectService } from './services/ProjectService'
import { GitService } from './services/GitService'
import { CLIProcessService } from './services/CLIProcessService'
import { ClaudeCodeService } from './services/ClaudeCodeService'
import { CLIToolDetectorService } from './services/CLIToolDetectorService'
import { CLIToolConfigService } from './services/CLIToolConfigService'
import { EditorService } from './services/EditorService'
import { PipelineService } from './services/PipelineService'
import { PreviewConfigService } from './services/PreviewConfigService'
import { PreviewService } from './services/PreviewService'
import { NotificationService } from './services/NotificationService'
import { DatabaseService } from './services/DatabaseService'
import { SettingsService } from './services/SettingsService'
import { TaskService } from './services/TaskService'
import { CliSessionService } from './services/cli/CliSessionService'

let projectService: ProjectService
let gitService: GitService
let cliProcessService: CLIProcessService
let claudeCodeService: ClaudeCodeService
let cliToolDetectorService: CLIToolDetectorService
let cliToolConfigService: CLIToolConfigService
let editorService: EditorService
let pipelineService: PipelineService
let previewConfigService: PreviewConfigService
let previewService: PreviewService
let notificationService: NotificationService
let databaseService: DatabaseService
let settingsService: SettingsService
let taskService: TaskService
let cliSessionService: CliSessionService

const APP_NAME = 'VibeWork'
const APP_IDENTIFIER = 'com.fzf-labs.vibework'

type CLIToolConfigInput = Parameters<CLIToolConfigService['saveConfig']>[1]
type ClaudeCodeConfigUpdate = Parameters<ClaudeCodeService['saveConfig']>[0]
type ClaudeCodeSessionOptions = Parameters<ClaudeCodeService['startSession']>[2]
type NotificationOptions = Parameters<NotificationService['showNotification']>[0]
type NotificationSoundSettings = Parameters<NotificationService['setSoundSettings']>[0]
type PipelineStages = Parameters<PipelineService['executePipeline']>[1]
type PreviewConfigInput = Parameters<PreviewConfigService['addConfig']>[0]
type PreviewConfigUpdates = Parameters<PreviewConfigService['updateConfig']>[1]

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: '',
    fullscreen: false,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  app.setName(APP_NAME)

  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_IDENTIFIER)

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconMac)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize app paths and migrate data from old location
  const appPaths = getAppPaths()
  const migration = appPaths.migrateFromOldLocation()
  if (migration.migrated) {
    console.log('[App] Data migration completed:')
    migration.details.forEach((detail) => console.log(`  - ${detail}`))
  }

  // Initialize services
  databaseService = new DatabaseService()
  projectService = new ProjectService(databaseService)
  gitService = new GitService()
  cliProcessService = new CLIProcessService()
  claudeCodeService = new ClaudeCodeService()
  cliToolDetectorService = new CLIToolDetectorService()
  cliToolConfigService = new CLIToolConfigService()
  cliSessionService = new CliSessionService(claudeCodeService, cliToolConfigService)
  editorService = new EditorService()
  pipelineService = new PipelineService()
  previewConfigService = new PreviewConfigService()
  previewService = new PreviewService()
  notificationService = new NotificationService()
  settingsService = new SettingsService()
  taskService = new TaskService(databaseService, gitService)

  databaseService.onWorkNodeStatusChange((node) => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (node.status === 'in_review') {
      const template = databaseService.getWorkNodeTemplate(node.work_node_template_id)
      mainWindow.webContents.send('workNode:review', {
        id: node.id,
        name: template?.name || ''
      })
      return
    }

    if (node.status === 'done') {
      const template = databaseService.getWorkNodeTemplate(node.work_node_template_id)
      mainWindow.webContents.send('workNode:completed', {
        id: node.id,
        name: template?.name || ''
      })
    }
  })

  // Forward ClaudeCode events to renderer
  claudeCodeService.on('output', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claudeCode:output', data)
    }
  })

  claudeCodeService.on('close', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claudeCode:close', data)
    }
  })

  claudeCodeService.on('error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claudeCode:error', data)
    }
  })

  // Forward unified CLI session events to renderer
  cliSessionService.on('output', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cliSession:output', data)
    }
  })

  cliSessionService.on('close', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cliSession:close', data)
    }
  })

  cliSessionService.on('error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cliSession:error', data)
    }
  })

  // IPC handlers for project management
  ipcMain.handle('projects:getAll', () => {
    return projectService.getAllProjects()
  })

  ipcMain.handle('projects:get', (_, id: string) => {
    return projectService.getProject(id)
  })

  ipcMain.handle('projects:add', (_, project) => {
    try {
      const result = projectService.addProject(project)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('projects:update', (_, id: string, updates) => {
    return projectService.updateProject(id, updates)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    return projectService.deleteProject(id)
  })

  ipcMain.handle('projects:checkPath', (_, id: string) => {
    return projectService.checkProjectPath(id)
  })

  // IPC handlers for Git operations
  ipcMain.handle('git:checkInstalled', async () => {
    try {
      const installed = await gitService.isInstalled()
      return { success: true, data: installed }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:clone', async (_, remoteUrl: string, targetPath: string) => {
    try {
      await gitService.clone(remoteUrl, targetPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:init', async (_, path: string) => {
    try {
      await gitService.init(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:listWorktrees', async (_, repoPath: string) => {
    try {
      const worktrees = await gitService.listWorktrees(repoPath)
      return { success: true, data: worktrees }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:addWorktree',
    async (
      _,
      repoPath: string,
      worktreePath: string,
      branchName: string,
      createBranch: boolean,
      baseBranch?: string
    ) => {
      try {
        await gitService.addWorktree(
          repoPath,
          worktreePath,
          branchName,
          createBranch,
          baseBranch
        )
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'git:removeWorktree',
    async (_, repoPath: string, worktreePath: string, force: boolean) => {
      try {
        await gitService.removeWorktree(repoPath, worktreePath, force)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:pruneWorktrees', async (_, repoPath: string) => {
    try {
      await gitService.pruneWorktrees(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diff = await gitService.getDiff(repoPath, filePath)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getStagedDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diff = await gitService.getStagedDiff(repoPath, filePath)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getBranches', async (_, repoPath: string) => {
    try {
      const branches = await gitService.getBranches(repoPath)
      return { success: true, data: branches }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getCurrentBranch', async (_, repoPath: string) => {
    try {
      const branch = await gitService.getCurrentBranch(repoPath)
      return { success: true, data: branch }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getChangedFiles', async (_, repoPath: string) => {
    try {
      const files = await gitService.getChangedFiles(repoPath)
      return { success: true, data: files }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:getBranchDiffFiles',
    async (_, repoPath: string, baseBranch: string, compareBranch?: string) => {
      try {
        const files = await gitService.getBranchDiffFiles(
          repoPath,
          baseBranch,
          compareBranch
        )
        return { success: true, data: files }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:stageFiles', async (_, repoPath: string, filePaths: string[]) => {
    try {
      await gitService.stageFiles(repoPath, filePaths)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:unstageFiles', async (_, repoPath: string, filePaths: string[]) => {
    try {
      await gitService.unstageFiles(repoPath, filePaths)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:mergeBranch', async (_, repoPath: string, branchName: string) => {
    try {
      const result = await gitService.mergeBranch(repoPath, branchName)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getConflictFiles', async (_, repoPath: string) => {
    try {
      const conflicts = await gitService.getConflictFiles(repoPath)
      return { success: true, data: conflicts }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:abortMerge', async (_, repoPath: string) => {
    try {
      await gitService.abortMerge(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getConflictContent', async (_, repoPath: string, filePath: string) => {
    try {
      const content = await gitService.getConflictContent(repoPath, filePath)
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:resolveConflict',
    async (_, repoPath: string, filePath: string, strategy: 'ours' | 'theirs') => {
      try {
        await gitService.resolveConflict(repoPath, filePath, strategy)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:rebaseBranch', async (_, repoPath: string, targetBranch: string) => {
    try {
      const result = await gitService.rebaseBranch(repoPath, targetBranch)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseContinue', async (_, repoPath: string) => {
    try {
      const result = await gitService.rebaseContinue(repoPath)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseAbort', async (_, repoPath: string) => {
    try {
      await gitService.rebaseAbort(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseSkip', async (_, repoPath: string) => {
    try {
      const result = await gitService.rebaseSkip(repoPath)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getRemoteUrl', async (_, repoPath: string, remoteName?: string) => {
    try {
      const url = await gitService.getRemoteUrl(repoPath, remoteName)
      return { success: true, data: url }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:pushBranch',
    async (_, repoPath: string, branchName: string, remoteName?: string, force?: boolean) => {
      try {
        await gitService.pushBranch(repoPath, branchName, remoteName, force)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:getCommitLog', async (_, repoPath: string, limit?: number) => {
    try {
      const commits = await gitService.getCommitLog(repoPath, limit)
      return { success: true, data: commits }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getParsedDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diffs = await gitService.getParsedDiff(repoPath, filePath)
      return { success: true, data: diffs }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getParsedStagedDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diffs = await gitService.getParsedStagedDiff(repoPath, filePath)
      return { success: true, data: diffs }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:checkoutBranch', async (_, repoPath: string, branchName: string) => {
    try {
      await gitService.checkoutBranch(repoPath, branchName)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:createBranch', async (_, repoPath: string, branchName: string) => {
    try {
      await gitService.createBranch(repoPath, branchName)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for CLI process management (legacy; prefer cliSession)
  ipcMain.handle(
    'cli:startSession',
    (_, sessionId: string, command: string, args: string[], cwd?: string) => {
      try {
        cliProcessService.startSession(sessionId, command, args, cwd)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('cli:stopSession', (_, sessionId: string) => {
    try {
      cliProcessService.stopSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('cli:getOutput', (_, sessionId: string) => {
    try {
      return cliProcessService.getSessionOutput(sessionId)
    } catch (error) {
      console.error('Failed to get CLI output:', error)
      return []
    }
  })

  // IPC handlers for Claude Code
  ipcMain.handle('claudeCode:getConfig', () => {
    return claudeCodeService.getConfig()
  })

  ipcMain.handle('claudeCode:saveConfig', (_, config: ClaudeCodeConfigUpdate) => {
    try {
      claudeCodeService.saveConfig(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'claudeCode:startSession',
    async (_, sessionId: string, workdir: string, options?: ClaudeCodeSessionOptions) => {
      console.log('[IPC] claudeCode:startSession called:', sessionId, workdir)
      if (options?.prompt) {
        console.log('[IPC] claudeCode:startSession prompt:', options.prompt)
      }
      try {
        await cliSessionService.startSession(
          sessionId,
          'claude-code',
          workdir,
          options?.prompt,
          undefined,
          options?.model
        )
        console.log('[IPC] claudeCode:startSession success')
        return { success: true }
      } catch (error) {
        console.error('[IPC] claudeCode:startSession error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('claudeCode:stopSession', (_, sessionId: string) => {
    try {
      cliSessionService.stopSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:sendInput', (_, sessionId: string, input: string) => {
    try {
      console.log('[IPC] claudeCode:sendInput prompt:', input)
      cliSessionService.sendInput(sessionId, input)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:getOutput', (_, sessionId: string) => {
    try {
      return claudeCodeService.getSessionOutput(sessionId)
    } catch (error) {
      console.error('Failed to get Claude Code output:', error)
      return []
    }
  })

  ipcMain.handle('claudeCode:getSessions', () => {
    return cliSessionService
      .getAllSessions()
      .filter((session) => session.toolId === 'claude-code')
  })

  ipcMain.handle('claudeCode:getSession', (_, sessionId: string) => {
    const session = cliSessionService.getSession(sessionId)
    if (!session) return null
    return {
      id: session.id,
      status: session.status,
      workdir: session.workdir,
      startTime: session.startTime
    }
  })

  // IPC handlers for unified CLI sessions
  ipcMain.handle(
    'cliSession:startSession',
    async (
      _,
      sessionId: string,
      toolId: string,
      workdir: string,
      options?: { prompt?: string; model?: string }
    ) => {
      try {
        await cliSessionService.startSession(
          sessionId,
          toolId,
          workdir,
          options?.prompt,
          undefined,
          options?.model
        )
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('cliSession:stopSession', (_, sessionId: string) => {
    try {
      cliSessionService.stopSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('cliSession:sendInput', (_, sessionId: string, input: string) => {
    try {
      cliSessionService.sendInput(sessionId, input)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('cliSession:getSessions', () => {
    return cliSessionService.getAllSessions()
  })

  ipcMain.handle('cliSession:getSession', (_, sessionId: string) => {
    const session = cliSessionService.getSession(sessionId)
    if (!session) return null
    return session
  })

  // IPC handlers for log stream
  const logStreamSubscriptions = new Map<string, () => void>()

  ipcMain.handle('logStream:subscribe', (event, sessionId: string) => {
    console.log('[IPC] logStream:subscribe called:', sessionId)
    const webContents = event.sender
    const unsubscribe = cliSessionService.subscribeToSession(sessionId, (msg) => {
      console.log('[IPC] logStream:message sending:', sessionId, msg.type)
      if (!webContents.isDestroyed()) {
        webContents.send('logStream:message', sessionId, msg)
      }
    })

    if (unsubscribe) {
      const key = `${webContents.id}-${sessionId}`
      logStreamSubscriptions.set(key, unsubscribe)
      console.log('[IPC] logStream:subscribe success')
      return { success: true }
    }
    console.log('[IPC] logStream:subscribe failed - session not found')
    return { success: false, error: 'Session not found' }
  })

  ipcMain.handle('logStream:unsubscribe', (event, sessionId: string) => {
    const key = `${event.sender.id}-${sessionId}`
    const unsubscribe = logStreamSubscriptions.get(key)
    if (unsubscribe) {
      unsubscribe()
      logStreamSubscriptions.delete(key)
    }
    return { success: true }
  })

  ipcMain.handle('logStream:getHistory', (_, sessionId: string) => {
    console.log('[IPC] logStream:getHistory called:', sessionId)
    const history = cliSessionService.getSessionLogHistory(sessionId)
    console.log('[IPC] logStream:getHistory returning:', history.length, 'messages')
    return history
  })

  // IPC handlers for CLI tool detection
  ipcMain.handle('cliTools:getAll', () => {
    return cliToolDetectorService.getAllTools()
  })

  ipcMain.handle('cliTools:detect', async (_, toolId: string) => {
    return await cliToolDetectorService.detectTool(toolId)
  })

  ipcMain.handle('cliTools:detectAll', async () => {
    return await cliToolDetectorService.detectAllTools()
  })

  // IPC handlers for CLI tool config
  ipcMain.handle('cliToolConfig:get', (_, toolId: string) => {
    return cliToolConfigService.getConfig(toolId)
  })

  ipcMain.handle('cliToolConfig:save', (_, toolId: string, config: CLIToolConfigInput) => {
    try {
      cliToolConfigService.saveConfig(toolId, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for editor management
  ipcMain.handle('editor:getAvailable', () => {
    return editorService.getAvailableEditors()
  })

  ipcMain.handle('editor:openProject', async (_, projectPath: string, editorCommand: string) => {
    try {
      await editorService.openProject(projectPath, editorCommand)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for pipeline execution
  ipcMain.handle(
    'pipeline:execute',
    async (_, pipelineId: string, stages: PipelineStages, workingDirectory?: string) => {
      try {
        const executionId = await pipelineService.executePipeline(
          pipelineId,
          stages,
          workingDirectory
        )
        return { success: true, executionId }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('pipeline:getExecution', (_, executionId: string) => {
    return pipelineService.getExecution(executionId)
  })

  ipcMain.handle('pipeline:getAllExecutions', () => {
    return pipelineService.getAllExecutions()
  })

  ipcMain.handle('pipeline:approveStage', (_, stageExecutionId: string, approvedBy: string) => {
    try {
      pipelineService.approveStage(stageExecutionId, approvedBy)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('pipeline:cancel', (_, executionId: string) => {
    try {
      pipelineService.cancelExecution(executionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for preview config management
  ipcMain.handle('previewConfig:getAll', () => {
    return previewConfigService.getAllConfigs()
  })

  ipcMain.handle('previewConfig:getByProject', (_, projectId: string) => {
    return previewConfigService.getConfigsByProject(projectId)
  })

  ipcMain.handle('previewConfig:get', (_, id: string) => {
    return previewConfigService.getConfig(id)
  })

  ipcMain.handle('previewConfig:add', (_, config: PreviewConfigInput) => {
    try {
      const newConfig = previewConfigService.addConfig(config)
      return { success: true, data: newConfig }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('previewConfig:update', (_, id: string, updates: PreviewConfigUpdates) => {
    try {
      const updatedConfig = previewConfigService.updateConfig(id, updates)
      return { success: true, data: updatedConfig }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('previewConfig:delete', (_, id: string) => {
    try {
      const deleted = previewConfigService.deleteConfig(id)
      return { success: true, data: deleted }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for preview execution
  ipcMain.handle(
    'preview:start',
    (
      _,
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      cwd?: string,
      env?: Record<string, string>
    ) => {
      try {
        previewService.startPreview(instanceId, configId, command, args, cwd, env)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('preview:stop', (_, instanceId: string) => {
    try {
      previewService.stopPreview(instanceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('preview:getInstance', (_, instanceId: string) => {
    return previewService.getInstance(instanceId)
  })

  ipcMain.handle('preview:getAllInstances', () => {
    return previewService.getAllInstances()
  })

  ipcMain.handle('preview:getOutput', (_, instanceId: string, limit?: number) => {
    return previewService.getOutput(instanceId, limit)
  })

  ipcMain.handle('preview:clearInstance', (_, instanceId: string) => {
    try {
      previewService.clearInstance(instanceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for notifications
  ipcMain.handle('notification:show', (_, options: NotificationOptions) => {
    try {
      notificationService.showNotification(options)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('notification:setEnabled', (_, enabled: boolean) => {
    notificationService.setEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('notification:isEnabled', () => {
    return notificationService.isEnabled()
  })

  ipcMain.handle('notification:setSoundEnabled', (_, enabled: boolean) => {
    notificationService.setSoundEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('notification:isSoundEnabled', () => {
    return notificationService.isSoundEnabled()
  })

  ipcMain.handle('notification:setSoundSettings', (_, settings: NotificationSoundSettings) => {
    notificationService.setSoundSettings(settings)
    return { success: true }
  })

  ipcMain.handle('notification:getSoundSettings', () => {
    return notificationService.getSoundSettings()
  })

  // IPC handlers for database operations
  // Session operations
  ipcMain.handle('db:createSession', (_, input) => {
    try {
      return databaseService.createSession(input)
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error
    }
  })

  ipcMain.handle('db:getSession', (_, id: string) => {
    try {
      return databaseService.getSession(id)
    } catch (error) {
      console.error('Failed to get session:', error)
      throw error
    }
  })

  ipcMain.handle('db:getAllSessions', () => {
    try {
      return databaseService.getAllSessions()
    } catch (error) {
      console.error('Failed to get all sessions:', error)
      throw error
    }
  })

  ipcMain.handle('db:updateSessionTaskCount', (_, sessionId: string, count: number) => {
    try {
      databaseService.updateSessionTaskCount(sessionId, count)
      return { success: true }
    } catch (error) {
      console.error('Failed to update session task count:', error)
      throw error
    }
  })

  // Task operations
  ipcMain.handle('db:createTask', (_, input) => {
    try {
      return databaseService.createTask(input)
    } catch (error) {
      console.error('Failed to create task:', error)
      throw error
    }
  })

  ipcMain.handle('db:getTask', (_, id: string) => {
    try {
      return databaseService.getTask(id)
    } catch (error) {
      console.error('Failed to get task:', error)
      throw error
    }
  })

  ipcMain.handle('db:getAllTasks', () => {
    try {
      return databaseService.getAllTasks()
    } catch (error) {
      console.error('Failed to get all tasks:', error)
      throw error
    }
  })

  ipcMain.handle('db:updateTask', (_, id: string, updates) => {
    try {
      return databaseService.updateTask(id, updates)
    } catch (error) {
      console.error('Failed to update task:', error)
      throw error
    }
  })

  ipcMain.handle('db:deleteTask', (_, id: string) => {
    try {
      return databaseService.deleteTask(id)
    } catch (error) {
      console.error('Failed to delete task:', error)
      throw error
    }
  })

  ipcMain.handle('db:getTasksBySessionId', (_, sessionId: string) => {
    try {
      return databaseService.getTasksBySessionId(sessionId)
    } catch (error) {
      console.error('Failed to get tasks by session:', error)
      throw error
    }
  })

  ipcMain.handle('db:getTasksByProjectId', (_, projectId: string) => {
    try {
      return databaseService.getTasksByProjectId(projectId)
    } catch (error) {
      console.error('Failed to get tasks by project:', error)
      throw error
    }
  })

  // Workflow template operations
  ipcMain.handle('db:getGlobalWorkflowTemplates', () => {
    return databaseService.getGlobalWorkflowTemplates()
  })

  ipcMain.handle('db:getWorkflowTemplatesByProject', (_, projectId: string) => {
    return databaseService.getWorkflowTemplatesByProject(projectId)
  })

  ipcMain.handle('db:getWorkflowTemplate', (_, templateId: string) => {
    return databaseService.getWorkflowTemplate(templateId)
  })

  ipcMain.handle('db:createWorkflowTemplate', (_, input) => {
    return databaseService.createWorkflowTemplate(input)
  })

  ipcMain.handle('db:updateWorkflowTemplate', (_, input) => {
    return databaseService.updateWorkflowTemplate(input)
  })

  ipcMain.handle('db:deleteWorkflowTemplate', (_, templateId: string, scope: string) => {
    return databaseService.deleteWorkflowTemplate(templateId, scope === 'global' ? 'global' : 'project')
  })

  ipcMain.handle('db:copyGlobalWorkflowToProject', (_, globalTemplateId: string, projectId: string) => {
    return databaseService.copyGlobalWorkflowToProject(globalTemplateId, projectId)
  })

  // Workflow instance operations
  ipcMain.handle('db:createWorkflow', (_, taskId: string, templateId: string, scope: string) => {
    return databaseService.createWorkflow(taskId, templateId, scope === 'global' ? 'global' : 'project')
  })

  ipcMain.handle('db:getWorkflow', (_, id: string) => {
    return databaseService.getWorkflow(id)
  })

  ipcMain.handle('db:getWorkflowByTaskId', (_, taskId: string) => {
    return databaseService.getWorkflowByTaskId(taskId)
  })

  ipcMain.handle('db:updateWorkflowStatus', (_, id: string, status: string, nodeIndex?: number) => {
    return databaseService.updateWorkflowStatus(id, status, nodeIndex)
  })

  // WorkNode instance operations
  ipcMain.handle('db:createWorkNode', (_, workflowId: string, templateId: string, nodeOrder: number) => {
    return databaseService.createWorkNode(workflowId, templateId, nodeOrder)
  })

  ipcMain.handle('db:getWorkNodesByWorkflowId', (_, workflowId: string) => {
    return databaseService.getWorkNodesByWorkflowId(workflowId)
  })

  ipcMain.handle('db:updateWorkNodeStatus', (_, id: string, status: string) => {
    return databaseService.updateWorkNodeStatus(id, status)
  })

  ipcMain.handle('db:approveWorkNode', (_, id: string) => {
    return databaseService.approveWorkNode(id)
  })

  ipcMain.handle('db:rejectWorkNode', (_, id: string) => {
    return databaseService.rejectWorkNode(id)
  })

  ipcMain.handle('db:approveTask', (_, id: string) => {
    return databaseService.approveTask(id)
  })

  // AgentExecution operations
  ipcMain.handle('db:createAgentExecution', (_, workNodeId: string) => {
    return databaseService.createAgentExecution(workNodeId)
  })

  ipcMain.handle('db:getAgentExecutionsByWorkNodeId', (_, workNodeId: string) => {
    return databaseService.getAgentExecutionsByWorkNodeId(workNodeId)
  })

  ipcMain.handle('db:getLatestAgentExecution', (_, workNodeId: string) => {
    return databaseService.getLatestAgentExecution(workNodeId)
  })

  ipcMain.handle('db:updateAgentExecutionStatus', (_, id: string, status: string, cost?: number, duration?: number) => {
    return databaseService.updateAgentExecutionStatus(id, status as 'idle' | 'running' | 'completed', cost, duration)
  })

  // Message operations
  ipcMain.handle('db:createMessage', (_, input) => {
    try {
      return databaseService.createMessage(input)
    } catch (error) {
      console.error('Failed to create message:', error)
      throw error
    }
  })

  ipcMain.handle('db:getMessagesByTaskId', (_, taskId: string) => {
    try {
      return databaseService.getMessagesByTaskId(taskId)
    } catch (error) {
      console.error('Failed to get messages:', error)
      throw error
    }
  })

  ipcMain.handle('db:deleteMessagesByTaskId', (_, taskId: string) => {
    try {
      return databaseService.deleteMessagesByTaskId(taskId)
    } catch (error) {
      console.error('Failed to delete messages:', error)
      throw error
    }
  })

  // IPC handlers for file system operations
  type FileEntry = { name: string; path: string; isDir: boolean; children?: FileEntry[] }

  const readDirTree = async (
    targetPath: string,
    maxDepth: number,
    visited: Set<string>
  ): Promise<FileEntry[]> => {
    if (maxDepth <= 0) return []
    try {
      const resolved = await realpath(targetPath)
      if (visited.has(resolved)) return []
      visited.add(resolved)
    } catch {
      return []
    }
    const entries = await readdir(targetPath, { withFileTypes: true })
    const results: FileEntry[] = []

    for (const entry of entries) {
      const entryPath = join(targetPath, entry.name)
      let isDir = entry.isDirectory()
      let entryResolvedPath: string | null = null

      if (!isDir && entry.isSymbolicLink()) {
        try {
          entryResolvedPath = await realpath(entryPath)
          const targetStats = await stat(entryResolvedPath)
          isDir = targetStats.isDirectory()
        } catch {
          isDir = false
        }
      }

      if (isDir) {
        let children: FileEntry[] = []
        if (maxDepth > 1) {
          try {
            const resolvedPath = entryResolvedPath || (await realpath(entryPath))
            if (!visited.has(resolvedPath)) {
              children = await readDirTree(entryPath, maxDepth - 1, visited)
            }
          } catch {
            children = []
          }
        }
        results.push({ name: entry.name, path: entryPath, isDir: true, children })
      } else {
        results.push({ name: entry.name, path: entryPath, isDir: false })
      }
    }

    return results
  }

  ipcMain.handle('fs:readDir', async (_, path: string, options?: { maxDepth?: number }) => {
    try {
      const maxDepth = Math.max(1, options?.maxDepth ?? 1)
      return await readDirTree(path, maxDepth, new Set())
    } catch (error) {
      console.error('Failed to read directory:', error)
      throw error
    }
  })

  ipcMain.handle('fs:readFile', async (_, path: string) => {
    try {
      const buffer = await readFile(path)
      return new Uint8Array(buffer)
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:readTextFile', async (_, path: string) => {
    try {
      return await readFile(path, 'utf-8')
    } catch (error) {
      console.error('Failed to read text file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:writeFile', async (_, path: string, data: Uint8Array | string) => {
    try {
      await writeFile(path, data)
    } catch (error) {
      console.error('Failed to write file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:writeTextFile', async (_, path: string, content: string) => {
    try {
      await writeFile(path, content, 'utf-8')
    } catch (error) {
      console.error('Failed to write text file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:stat', async (_, path: string) => {
    try {
      const stats = await stat(path)
      return {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      }
    } catch (error) {
      console.error('Failed to stat file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:exists', async (_, path: string) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:remove', async (_, path: string, options?: { recursive?: boolean }) => {
    try {
      await rm(path, { recursive: options?.recursive || false })
    } catch (error) {
      console.error('Failed to remove file:', error)
      throw error
    }
  })

  ipcMain.handle('fs:mkdir', async (_, path: string) => {
    try {
      await mkdir(path, { recursive: true })
    } catch (error) {
      console.error('Failed to create directory:', error)
      throw error
    }
  })

  // IPC handlers for dialog operations
  ipcMain.handle('dialog:save', async (_, options) => {
    try {
      const result = await dialog.showSaveDialog(options)
      return result.canceled ? null : result.filePath
    } catch (error) {
      console.error('Failed to show save dialog:', error)
      throw error
    }
  })

  ipcMain.handle('dialog:open', async (_, options) => {
    try {
      const result = await dialog.showOpenDialog(options)
      if (result.canceled) return null
      return options.multiple ? result.filePaths : result.filePaths[0]
    } catch (error) {
      console.error('Failed to show open dialog:', error)
      throw error
    }
  })

  // IPC handlers for shell operations
  ipcMain.handle('shell:openUrl', async (_, url: string) => {
    try {
      await shell.openExternal(url)
    } catch (error) {
      console.error('Failed to open URL:', error)
      throw error
    }
  })

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    try {
      const result = await shell.openPath(path)
      if (result) {
        throw new Error(result)
      }
    } catch (error) {
      console.error('Failed to open path:', error)
      throw error
    }
  })

  ipcMain.handle('shell:showItemInFolder', async (_, path: string) => {
    try {
      shell.showItemInFolder(path)
    } catch (error) {
      console.error('Failed to show item in folder:', error)
      throw error
    }
  })

  // IPC handlers for path operations
  ipcMain.handle('path:appDataDir', () => {
    return app.getPath('appData')
  })

  ipcMain.handle('path:appConfigDir', () => {
    return app.getPath('userData')
  })

  ipcMain.handle('path:tempDir', () => {
    return app.getPath('temp')
  })

  ipcMain.handle('path:resourcesDir', () => {
    return process.resourcesPath
  })

  ipcMain.handle('path:appPath', () => {
    return app.getAppPath()
  })

  ipcMain.handle('path:vibeworkDataDir', () => {
    return appPaths.getRootDir()
  })

  ipcMain.handle('path:homeDir', () => {
    return app.getPath('home')
  })

  // IPC handlers for settings
  ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:update', (_, updates) => {
    return settingsService.updateSettings(updates)
  })

  ipcMain.handle('settings:reset', () => {
    return settingsService.resetSettings()
  })

  // IPC handlers for task service
  ipcMain.handle('task:create', async (_, options) => {
    try {
      const task = await taskService.createTask(options)
      return { success: true, data: task }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('task:get', (_, id: string) => {
    return taskService.getTask(id)
  })

  ipcMain.handle('task:getAll', () => {
    return taskService.getAllTasks()
  })

  ipcMain.handle('task:getBySession', (_, sessionId: string) => {
    return taskService.getTasksBySessionId(sessionId)
  })

  ipcMain.handle('task:getByProject', (_, projectId: string) => {
    return taskService.getTasksByProjectId(projectId)
  })

  ipcMain.handle('task:updateStatus', (_, id: string, status: string) => {
    return taskService.updateTaskStatus(id, status as any)
  })

  ipcMain.handle('task:delete', async (_, id: string, removeWorktree?: boolean) => {
    try {
      const result = await taskService.deleteTask(id, removeWorktree)
      return { success: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for app operations
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Close database connection before app quits
app.on('before-quit', () => {
  if (databaseService) {
    databaseService.close()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
