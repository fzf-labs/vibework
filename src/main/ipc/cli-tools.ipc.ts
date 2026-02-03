import type { IpcModuleContext } from './types'
import type { CLIToolConfigService } from '../services/CLIToolConfigService'
import { IPC_CHANNELS } from './channels'

export const registerCliToolsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { cliToolDetectorService, cliToolConfigService } = services

  handle(IPC_CHANNELS.cliTools.getAll, [], () => cliToolDetectorService.getAllTools())
  handle(
    IPC_CHANNELS.cliTools.detect,
    [v.string()],
    async (_, toolId) => cliToolDetectorService.detectTool(toolId)
  )
  handle(
    IPC_CHANNELS.cliTools.detectAll,
    [],
    async () => cliToolDetectorService.detectAllTools()
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
