import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconMac from '../../resources/icon-mac.png?asset'
import { assertUrlAllowed } from './utils/url-guard'
import { addAllowedRoot } from './utils/fs-allowlist'
import { registerIpcHandlers } from './ipc'
import { IPC_EVENTS } from './ipc/channels'
import { AppContext } from './app/AppContext'
import { createAppContext } from './app/create-app-context'

let appContext: AppContext | null = null

const APP_NAME = 'VibeWork'
const APP_IDENTIFIER = 'com.fzf-labs.vibework'

let mainWindow: BrowserWindow | null = null
const resolveProjectIdForSession = (sessionId: string): string | null =>
  appContext?.resolveProjectIdForSession(sessionId) ?? null

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
app.whenReady().then(async () => {
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

  appContext = createAppContext()
  await appContext.init()

  const { services, appPaths } = appContext
  const { databaseService, claudeCodeService, cliSessionService, terminalService } = services

  try {
    await addAllowedRoot(process.resourcesPath)
  } catch (error) {
    console.warn('[fs-allowlist] Failed to add resources root:', error)
  }
  try {
    await addAllowedRoot(app.getAppPath())
  } catch (error) {
    console.warn('[fs-allowlist] Failed to add app root:', error)
  }

  appContext.trackDisposable(
    databaseService.onWorkNodeStatusChange((node) => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (node.status === 'in_review') {
      mainWindow.webContents.send(IPC_EVENTS.workNode.review, {
        id: node.id,
        name: node.name || ''
      })
      return
    }

    if (node.status === 'done') {
      mainWindow.webContents.send(IPC_EVENTS.workNode.completed, {
        id: node.id,
        name: node.name || ''
      })
    }
    })
  )

  // Forward ClaudeCode events to renderer
  appContext.trackEvent(claudeCodeService, 'output', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.claudeCode.output, data)
    }
  })

  appContext.trackEvent(claudeCodeService, 'close', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.claudeCode.close, data)
    }
  })

  appContext.trackEvent(claudeCodeService, 'error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.claudeCode.error, data)
    }
  })

  // Forward unified CLI session events to renderer
  appContext.trackEvent(cliSessionService, 'output', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.cliSession.output, data)
    }
  })

  appContext.trackEvent(cliSessionService, 'status', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.cliSession.status, data)
    }
  })

  appContext.trackEvent(cliSessionService, 'close', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.cliSession.close, data)
    }
  })

  appContext.trackEvent(cliSessionService, 'error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.cliSession.error, data)
    }
  })

  appContext.trackEvent(terminalService, 'data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.terminal.data, data)
    }
  })

  appContext.trackEvent(terminalService, 'exit', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.terminal.exit, data)
    }
  })

  appContext.trackEvent(terminalService, 'error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.terminal.error, data)
    }
  })

  registerIpcHandlers({
    services,
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
  if (appContext) {
    void appContext.dispose()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
