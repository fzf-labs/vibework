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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  app.setName(APP_NAME)
  electronApp.setAppUserModelId(APP_IDENTIFIER)

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconMac)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  appContext = createAppContext()
  await appContext.init()

  const { services, appPaths } = appContext
  const { databaseService, cliSessionService, terminalService } = services

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
    databaseService.onTaskNodeStatusChange((node) => {
      if (!mainWindow || mainWindow.isDestroyed()) return

      const payload = {
        id: node.id,
        name: node.name || '',
        taskId: node.task_id
      }

      if (node.status === 'in_review') {
        mainWindow.webContents.send(IPC_EVENTS.taskNode.review, payload)
        return
      }

      if (node.status === 'done') {
        mainWindow.webContents.send(IPC_EVENTS.taskNode.completed, payload)
        return
      }

    })
  )

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (appContext) {
    void appContext.dispose()
  }
})
