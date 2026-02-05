import { BrowserWindow, dialog, ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import type { IpcMainInvokeEvent } from 'electron'
import type { IpcDependencies, IpcModuleContext } from './types'
import { wrapHandler, v, Validator } from '../utils/ipc-response'
import { auditSecurityEvent } from '../utils/security-audit'
import type { IpcArgs, IpcContractChannel, IpcResult } from './channels'
import { registerProjectsIpc } from './projects.ipc'
import { registerGitIpc } from './git.ipc'
import { registerCliIpc } from './cli.ipc'
import { registerCliSessionIpc } from './cli-session.ipc'
import { registerCliToolsIpc } from './cli-tools.ipc'
import { registerEditorIpc } from './editor.ipc'
import { registerPipelineIpc } from './pipeline.ipc'
import { registerPreviewConfigIpc } from './preview-config.ipc'
import { registerPreviewIpc } from './preview.ipc'
import { registerNotificationIpc } from './notification.ipc'
import { registerDatabaseIpc } from './database.ipc'
import { registerFilesystemIpc } from './filesystem.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerTaskIpc } from './task.ipc'
import { registerAppIpc } from './app.ipc'
import { registerTerminalIpc } from './terminal.ipc'

export const registerIpcHandlers = (deps: IpcDependencies): void => {
  const handle = <C extends IpcContractChannel>(
    channel: C,
    validators: ReadonlyArray<Validator<unknown>>,
    handler: (event: IpcMainInvokeEvent, ...args: IpcArgs<C>) => Promise<IpcResult<C>> | IpcResult<C>
  ): void => {
    ipcMain.handle(channel, wrapHandler(handler, validators))
  }

  const taskStatusValues = ['todo', 'in_progress', 'in_review', 'done'] as const
  const workflowStatusValues = ['todo', 'in_progress', 'done'] as const
  const workNodeStatusValues = ['todo', 'in_progress', 'in_review', 'done'] as const
  const agentExecutionStatusValues = ['idle', 'running', 'completed'] as const

  const fileDataValidator: Validator<Uint8Array | string> = (value, name) => {
    if (typeof value === 'string') return value
    if (value instanceof Uint8Array) return value
    throw new Error(`Invalid ${name}: expected string or Uint8Array`)
  }

  const getFsAllowlistRoots = (): string[] => {
    const projectRoots = deps.services.projectService
      .getAllProjects()
      .map((project) => project.path)

    const homeDir = homedir()
    const skillRoots = [
      join(homeDir, '.claude'),
      join(homeDir, '.claude.json'),
      join(homeDir, '.mcp.json'),
      join(homeDir, '.codex'),
      join(homeDir, '.gemini'),
      join(homeDir, '.opencode'),
      join(homeDir, '.cursor'),
      join(homeDir, '.agents'),
      join(homeDir, '.config', 'claude')
    ]

    return Array.from(new Set([...projectRoots, ...skillRoots]))
  }

  const confirmDestructiveOperation = async (
    event: IpcMainInvokeEvent,
    action: string,
    targetPath: string
  ): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showMessageBox(window, {
          type: 'warning',
          buttons: ['Cancel', 'Confirm'],
          defaultId: 1,
          cancelId: 0,
          title: 'Confirm Destructive Operation',
          message: `${action} will modify or remove data at:\n${targetPath}`,
          noLink: true
        })
      : await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Confirm'],
          defaultId: 1,
          cancelId: 0,
          title: 'Confirm Destructive Operation',
          message: `${action} will modify or remove data at:\n${targetPath}`,
          noLink: true
        })

    if (result.response !== 1) {
      auditSecurityEvent('destructive_operation_cancelled', { action, path: targetPath })
      throw new Error('Operation cancelled by user')
    }

    auditSecurityEvent('destructive_operation_confirmed', { action, path: targetPath })
  }

  const context: IpcModuleContext = {
    ...deps,
    handle,
    v,
    fileDataValidator,
    getFsAllowlistRoots,
    confirmDestructiveOperation,
    taskStatusValues,
    workflowStatusValues,
    workNodeStatusValues,
    agentExecutionStatusValues
  }

  registerProjectsIpc(context)
  registerGitIpc(context)
  registerCliIpc(context)
  registerCliSessionIpc(context)
  registerCliToolsIpc(context)
  registerEditorIpc(context)
  registerPipelineIpc(context)
  registerPreviewConfigIpc(context)
  registerPreviewIpc(context)
  registerNotificationIpc(context)
  registerDatabaseIpc(context)
  registerFilesystemIpc(context)
  registerSettingsIpc(context)
  registerTaskIpc(context)
  registerAppIpc(context)
  registerTerminalIpc(context)
}
