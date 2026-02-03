import type { IpcModuleContext } from './types'
import type { PreviewConfigService } from '../services/PreviewConfigService'

export const registerPreviewConfigIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewConfigService } = services

  handle('previewConfig:getAll', [], () => previewConfigService.getAllConfigs())

  handle('previewConfig:getByProject', [v.string()], (_, projectId) =>
    previewConfigService.getConfigsByProject(projectId)
  )

  handle('previewConfig:get', [v.string()], (_, id) => previewConfigService.getConfig(id))

  handle('previewConfig:add', [v.object()], (_, configValue) =>
    previewConfigService.addConfig(configValue as Parameters<PreviewConfigService['addConfig']>[0])
  )

  handle(
    'previewConfig:update',
    [v.string(), v.object()],
    (_, id, updatesValue) =>
      previewConfigService.updateConfig(
        id,
        updatesValue as Parameters<PreviewConfigService['updateConfig']>[1]
      )
  )

  handle('previewConfig:delete', [v.string()], (_, id) => previewConfigService.deleteConfig(id))
}
