import type { IpcModuleContext } from './types'
import type { PreviewConfigService } from '../services/PreviewConfigService'
import { IPC_CHANNELS } from './channels'

export const registerPreviewConfigIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewConfigService } = services

  handle(IPC_CHANNELS.previewConfig.getAll, [], () => previewConfigService.getAllConfigs())

  handle(IPC_CHANNELS.previewConfig.getByProject, [v.string()], (_, projectId) =>
    previewConfigService.getConfigsByProject(projectId)
  )

  handle(IPC_CHANNELS.previewConfig.get, [v.string()], (_, id) =>
    previewConfigService.getConfig(id)
  )

  handle(IPC_CHANNELS.previewConfig.add, [v.object()], (_, configValue) =>
    previewConfigService.addConfig(configValue as Parameters<PreviewConfigService['addConfig']>[0])
  )

  handle(
    IPC_CHANNELS.previewConfig.update,
    [v.string(), v.object()],
    (_, id, updatesValue) =>
      previewConfigService.updateConfig(
        id,
        updatesValue as Parameters<PreviewConfigService['updateConfig']>[1]
      )
  )

  handle(IPC_CHANNELS.previewConfig.delete, [v.string()], (_, id) =>
    previewConfigService.deleteConfig(id)
  )
}
