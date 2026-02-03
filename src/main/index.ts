import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
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
import { assertUrlAllowed } from './utils/url-guard'
import { registerIpcHandlers } from './ipc'

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

let mainWindow: BrowserWindow | null = null

function resolveProjectIdForSession(sessionId: string): string | null {
  try {
    return taskService.getTaskBySessionId(sessionId)?.projectId ?? null
  } catch {
    return null
  }
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      assertUrlAllowed(details.url, 'window:open')
      shell.openExternal(details.url)
    } catch (error) {
      console.error('Blocked window open:', error)
    }
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

  // Initialize app paths
  const appPaths = getAppPaths()

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
      mainWindow.webContents.send('workNode:review', {
        id: node.id,
        name: node.name || ''
      })
      return
    }

    if (node.status === 'done') {
      mainWindow.webContents.send('workNode:completed', {
        id: node.id,
        name: node.name || ''
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

  cliSessionService.on('status', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cliSession:status', data)
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

  registerIpcHandlers({
    services: {
      projectService,
      gitService,
      cliProcessService,
      claudeCodeService,
      cliToolDetectorService,
      cliToolConfigService,
      editorService,
      pipelineService,
      previewConfigService,
      previewService,
      notificationService,
      databaseService,
      settingsService,
      taskService,
      cliSessionService
    },
    appPaths,
    resolveProjectIdForSession
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
