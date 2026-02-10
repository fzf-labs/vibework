import { BrowserWindow } from 'electron'
import type { IpcModuleContext } from './types'
import type { CLIToolConfigService } from '../services/CLIToolConfigService'
import { IPC_CHANNELS, IPC_EVENTS } from './channels'

let cliToolEventBound = false

export const registerCliToolsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { cliToolDetectorService, cliToolConfigService } = services

  if (!cliToolEventBound) {
    cliToolEventBound = true
    cliToolDetectorService.on('updated', (tools) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(IPC_EVENTS.cliTools.updated, tools)
        }
      }
    })
  }

  handle(IPC_CHANNELS.cliTools.getAll, [], () => cliToolDetectorService.getAllTools())
  handle(IPC_CHANNELS.cliTools.getSnapshot, [], () => cliToolDetectorService.getSnapshot())
  handle(
    IPC_CHANNELS.cliTools.refresh,
    [v.optional(v.object())],
    (_, payload) =>
      cliToolDetectorService.refreshTools({
        level: payload?.level === 'full' ? 'full' : 'fast',
        force: Boolean(payload?.force),
        toolIds: Array.isArray(payload?.toolIds)
          ? payload.toolIds.filter((toolId): toolId is string => typeof toolId === 'string')
          : undefined
      })
  )
  handle(
    IPC_CHANNELS.cliTools.detect,
    [v.string(), v.optional(v.object())],
    async (_, toolId, options) =>
      cliToolDetectorService.detectTool(toolId, {
        level: options?.level === 'fast' ? 'fast' : 'full',
        force: Boolean(options?.force)
      })
  )
  handle(
    IPC_CHANNELS.cliTools.detectAll,
    [v.optional(v.object())],
    async (_, options) =>
      cliToolDetectorService.detectAllTools({
        level: options?.level === 'fast' ? 'fast' : 'full',
        force: Boolean(options?.force)
      })
  )

  handle(
    IPC_CHANNELS.cliToolConfig.get,
    [v.string()],
    (_, toolId) => cliToolConfigService.getConfig(toolId)
  )
  handle(IPC_CHANNELS.cliToolConfig.save, [v.string(), v.object()], (_, toolId, configValue) => {
    cliToolConfigService.saveConfig(toolId, configValue as Parameters<CLIToolConfigService['saveConfig']>[1])
  })
}
