import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerPreviewIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewService } = services

  handle(
    IPC_CHANNELS.preview.start,
    [
      v.string(),
      v.string(),
      v.string(),
      v.array(v.string()),
      v.optional(v.string()),
      v.optional(v.object())
    ],
    (_, instanceId, configId, command, args, cwd, env) => {
      previewService.startPreview(
        instanceId,
        configId,
        command,
        args,
        cwd,
        env as Record<string, string> | undefined
      )
    }
  )

  handle(IPC_CHANNELS.preview.stop, [v.string()], async (_, instanceId) => {
    await previewService.stopPreview(instanceId)
  })

  handle(IPC_CHANNELS.preview.getInstance, [v.string()], (_, instanceId) =>
    previewService.getInstance(instanceId)
  )

  handle(IPC_CHANNELS.preview.getAllInstances, [], () => previewService.getAllInstances())

  handle(
    IPC_CHANNELS.preview.getOutput,
    [v.string(), v.optional(v.number({ min: 1 }))],
    (_, instanceId, limit) => previewService.getOutput(instanceId, limit)
  )

  handle(IPC_CHANNELS.preview.clearInstance, [v.string()], (_, instanceId) => {
    previewService.clearInstance(instanceId)
  })
}
