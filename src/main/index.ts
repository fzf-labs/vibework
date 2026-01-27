import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectManager } from './managers/ProjectManager'
import { GitManager } from './managers/GitManager'
import { CLIProcessManager } from './managers/CLIProcessManager'
import { ClaudeCodeManager } from './managers/ClaudeCodeManager'
import { CLIToolDetector } from './managers/CLIToolDetector'
import { CLIToolConfigManager } from './managers/CLIToolConfigManager'
import { EditorManager } from './managers/EditorManager'
import { PipelineExecutor } from './managers/PipelineExecutor'
import { PreviewConfigManager } from './managers/PreviewConfigManager'
import { PreviewExecutor } from './managers/PreviewExecutor'
import { NotificationManager } from './managers/NotificationManager'

let projectManager: ProjectManager
let gitManager: GitManager
let cliProcessManager: CLIProcessManager
let claudeCodeManager: ClaudeCodeManager
let cliToolDetector: CLIToolDetector
let cliToolConfigManager: CLIToolConfigManager
let editorManager: EditorManager
let pipelineExecutor: PipelineExecutor
let previewConfigManager: PreviewConfigManager
let previewExecutor: PreviewExecutor
let notificationManager: NotificationManager

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize managers
  projectManager = new ProjectManager()
  gitManager = new GitManager()
  cliProcessManager = new CLIProcessManager()
  claudeCodeManager = new ClaudeCodeManager()
  cliToolDetector = new CLIToolDetector()
  cliToolConfigManager = new CLIToolConfigManager()
  editorManager = new EditorManager()
  pipelineExecutor = new PipelineExecutor()
  previewConfigManager = new PreviewConfigManager()
  previewExecutor = new PreviewExecutor()
  notificationManager = new NotificationManager()

  // IPC handlers for project management
  ipcMain.handle('projects:getAll', () => {
    return projectManager.getAllProjects()
  })

  ipcMain.handle('projects:get', (_, id: string) => {
    return projectManager.getProject(id)
  })

  ipcMain.handle('projects:add', (_, project) => {
    return projectManager.addProject(project)
  })

  ipcMain.handle('projects:update', (_, id: string, updates) => {
    return projectManager.updateProject(id, updates)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    return projectManager.deleteProject(id)
  })

  // IPC handlers for Git operations
  ipcMain.handle('git:clone', async (_, remoteUrl: string, targetPath: string) => {
    try {
      await gitManager.clone(remoteUrl, targetPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:init', async (_, path: string) => {
    try {
      await gitManager.init(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:listWorktrees', async (_, repoPath: string) => {
    try {
      const worktrees = await gitManager.listWorktrees(repoPath)
      return { success: true, data: worktrees }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:addWorktree', async (_, repoPath: string, worktreePath: string, branchName: string, createBranch: boolean) => {
    try {
      await gitManager.addWorktree(repoPath, worktreePath, branchName, createBranch)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:removeWorktree', async (_, repoPath: string, worktreePath: string, force: boolean) => {
    try {
      await gitManager.removeWorktree(repoPath, worktreePath, force)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:pruneWorktrees', async (_, repoPath: string) => {
    try {
      await gitManager.pruneWorktrees(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diff = await gitManager.getDiff(repoPath, filePath)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getStagedDiff', async (_, repoPath: string, filePath?: string) => {
    try {
      const diff = await gitManager.getStagedDiff(repoPath, filePath)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getBranches', async (_, repoPath: string) => {
    try {
      const branches = await gitManager.getBranches(repoPath)
      return { success: true, data: branches }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getCurrentBranch', async (_, repoPath: string) => {
    try {
      const branch = await gitManager.getCurrentBranch(repoPath)
      return { success: true, data: branch }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getChangedFiles', async (_, repoPath: string) => {
    try {
      const files = await gitManager.getChangedFiles(repoPath)
      return { success: true, data: files }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:stageFiles', async (_, repoPath: string, filePaths: string[]) => {
    try {
      await gitManager.stageFiles(repoPath, filePaths)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:unstageFiles', async (_, repoPath: string, filePaths: string[]) => {
    try {
      await gitManager.unstageFiles(repoPath, filePaths)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:mergeBranch', async (_, repoPath: string, branchName: string) => {
    try {
      const result = await gitManager.mergeBranch(repoPath, branchName)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getConflictFiles', async (_, repoPath: string) => {
    try {
      const conflicts = await gitManager.getConflictFiles(repoPath)
      return { success: true, data: conflicts }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:abortMerge', async (_, repoPath: string) => {
    try {
      await gitManager.abortMerge(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getConflictContent', async (_, repoPath: string, filePath: string) => {
    try {
      const content = await gitManager.getConflictContent(repoPath, filePath)
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:resolveConflict', async (_, repoPath: string, filePath: string, strategy: 'ours' | 'theirs') => {
    try {
      await gitManager.resolveConflict(repoPath, filePath, strategy)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseBranch', async (_, repoPath: string, targetBranch: string) => {
    try {
      const result = await gitManager.rebaseBranch(repoPath, targetBranch)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseContinue', async (_, repoPath: string) => {
    try {
      const result = await gitManager.rebaseContinue(repoPath)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseAbort', async (_, repoPath: string) => {
    try {
      await gitManager.rebaseAbort(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:rebaseSkip', async (_, repoPath: string) => {
    try {
      const result = await gitManager.rebaseSkip(repoPath)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getRemoteUrl', async (_, repoPath: string, remoteName?: string) => {
    try {
      const url = await gitManager.getRemoteUrl(repoPath, remoteName)
      return { success: true, data: url }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:pushBranch', async (_, repoPath: string, branchName: string, remoteName?: string, force?: boolean) => {
    try {
      await gitManager.pushBranch(repoPath, branchName, remoteName, force)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:getCommitLog', async (_, repoPath: string, limit?: number) => {
    try {
      const commits = await gitManager.getCommitLog(repoPath, limit)
      return { success: true, data: commits }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for CLI process management
  ipcMain.handle('cli:startSession', (_, sessionId: string, command: string, args: string[], cwd?: string) => {
    try {
      cliProcessManager.startSession(sessionId, command, args, cwd)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('cli:stopSession', (_, sessionId: string) => {
    try {
      cliProcessManager.stopSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('cli:getOutput', (_, sessionId: string) => {
    try {
      return cliProcessManager.getSessionOutput(sessionId)
    } catch (error) {
      return []
    }
  })

  // IPC handlers for Claude Code
  ipcMain.handle('claudeCode:getConfig', () => {
    return claudeCodeManager.getConfig()
  })

  ipcMain.handle('claudeCode:saveConfig', (_, config) => {
    try {
      claudeCodeManager.saveConfig(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:startSession', (_, sessionId: string, workdir: string, options) => {
    try {
      claudeCodeManager.startSession(sessionId, workdir, options)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:stopSession', (_, sessionId: string) => {
    try {
      claudeCodeManager.stopSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:sendInput', (_, sessionId: string, input: string) => {
    try {
      claudeCodeManager.sendInput(sessionId, input)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('claudeCode:getOutput', (_, sessionId: string) => {
    try {
      return claudeCodeManager.getSessionOutput(sessionId)
    } catch (error) {
      return []
    }
  })

  ipcMain.handle('claudeCode:getSessions', () => {
    return claudeCodeManager.getAllSessions()
  })

  // IPC handlers for CLI tool detection
  ipcMain.handle('cliTools:getAll', () => {
    return cliToolDetector.getAllTools()
  })

  ipcMain.handle('cliTools:detect', async (_, toolId: string) => {
    return await cliToolDetector.detectTool(toolId)
  })

  ipcMain.handle('cliTools:detectAll', async () => {
    return await cliToolDetector.detectAllTools()
  })

  // IPC handlers for CLI tool config
  ipcMain.handle('cliToolConfig:get', (_, toolId: string) => {
    return cliToolConfigManager.getConfig(toolId)
  })

  ipcMain.handle('cliToolConfig:save', (_, toolId: string, config: any) => {
    try {
      cliToolConfigManager.saveConfig(toolId, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for editor management
  ipcMain.handle('editor:getAvailable', () => {
    return editorManager.getAvailableEditors()
  })

  ipcMain.handle('editor:openProject', async (_, projectPath: string, editorCommand: string) => {
    try {
      await editorManager.openProject(projectPath, editorCommand)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for pipeline execution
  ipcMain.handle('pipeline:execute', async (_, pipelineId: string, stages: any[], workingDirectory?: string) => {
    try {
      const executionId = await pipelineExecutor.executePipeline(pipelineId, stages, workingDirectory)
      return { success: true, executionId }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('pipeline:getExecution', (_, executionId: string) => {
    return pipelineExecutor.getExecution(executionId)
  })

  ipcMain.handle('pipeline:getAllExecutions', () => {
    return pipelineExecutor.getAllExecutions()
  })

  ipcMain.handle('pipeline:approveStage', (_, stageExecutionId: string, approvedBy: string) => {
    try {
      pipelineExecutor.approveStage(stageExecutionId, approvedBy)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('pipeline:cancel', (_, executionId: string) => {
    try {
      pipelineExecutor.cancelExecution(executionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for preview config management
  ipcMain.handle('previewConfig:getAll', () => {
    return previewConfigManager.getAllConfigs()
  })

  ipcMain.handle('previewConfig:getByProject', (_, projectId: string) => {
    return previewConfigManager.getConfigsByProject(projectId)
  })

  ipcMain.handle('previewConfig:get', (_, id: string) => {
    return previewConfigManager.getConfig(id)
  })

  ipcMain.handle('previewConfig:add', (_, config: any) => {
    try {
      const newConfig = previewConfigManager.addConfig(config)
      return { success: true, data: newConfig }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('previewConfig:update', (_, id: string, updates: any) => {
    try {
      const updatedConfig = previewConfigManager.updateConfig(id, updates)
      return { success: true, data: updatedConfig }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('previewConfig:delete', (_, id: string) => {
    try {
      const deleted = previewConfigManager.deleteConfig(id)
      return { success: true, data: deleted }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for preview execution
  ipcMain.handle('preview:start', (_, instanceId: string, configId: string, command: string, args: string[], cwd?: string, env?: Record<string, string>) => {
    try {
      previewExecutor.startPreview(instanceId, configId, command, args, cwd, env)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('preview:stop', (_, instanceId: string) => {
    try {
      previewExecutor.stopPreview(instanceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('preview:getInstance', (_, instanceId: string) => {
    return previewExecutor.getInstance(instanceId)
  })

  ipcMain.handle('preview:getAllInstances', () => {
    return previewExecutor.getAllInstances()
  })

  ipcMain.handle('preview:getOutput', (_, instanceId: string, limit?: number) => {
    return previewExecutor.getOutput(instanceId, limit)
  })

  ipcMain.handle('preview:clearInstance', (_, instanceId: string) => {
    try {
      previewExecutor.clearInstance(instanceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC handlers for notifications
  ipcMain.handle('notification:show', (_, options: any) => {
    try {
      notificationManager.showNotification(options)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('notification:setEnabled', (_, enabled: boolean) => {
    notificationManager.setEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('notification:isEnabled', () => {
    return notificationManager.isEnabled()
  })

  ipcMain.handle('notification:setSoundEnabled', (_, enabled: boolean) => {
    notificationManager.setSoundEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('notification:isSoundEnabled', () => {
    return notificationManager.isSoundEnabled()
  })

  ipcMain.handle('notification:setSoundSettings', (_, settings: any) => {
    notificationManager.setSoundSettings(settings)
    return { success: true }
  })

  ipcMain.handle('notification:getSoundSettings', () => {
    return notificationManager.getSoundSettings()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
