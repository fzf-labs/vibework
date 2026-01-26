import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectManager } from './managers/ProjectManager'
import { GitManager } from './managers/GitManager'
import { CLIProcessManager } from './managers/CLIProcessManager'

let projectManager: ProjectManager
let gitManager: GitManager
let cliProcessManager: CLIProcessManager

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
