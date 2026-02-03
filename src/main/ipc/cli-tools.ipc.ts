import type { IpcModuleContext } from './types'
import type { CLIToolConfigService } from '../services/CLIToolConfigService'

export const registerCliToolsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { cliToolDetectorService, cliToolConfigService } = services

  handle('cliTools:getAll', [], () => cliToolDetectorService.getAllTools())
  handle('cliTools:detect', [v.string()], async (_, toolId) => cliToolDetectorService.detectTool(toolId))
  handle('cliTools:detectAll', [], async () => cliToolDetectorService.detectAllTools())

  handle('cliToolConfig:get', [v.string()], (_, toolId) => cliToolConfigService.getConfig(toolId))
  handle('cliToolConfig:save', [v.string(), v.object()], (_, toolId, configValue) => {
    cliToolConfigService.saveConfig(toolId, configValue as Parameters<CLIToolConfigService['saveConfig']>[1])
  })
}
