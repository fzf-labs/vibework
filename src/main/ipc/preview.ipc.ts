import type { IpcModuleContext } from './types'

export const registerPreviewIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewService } = services

  handle(
    'preview:start',
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

  handle('preview:stop', [v.string()], async (_, instanceId) => {
    await previewService.stopPreview(instanceId)
  })

  handle('preview:getInstance', [v.string()], (_, instanceId) =>
    previewService.getInstance(instanceId)
  )

  handle('preview:getAllInstances', [], () => previewService.getAllInstances())

  handle(
    'preview:getOutput',
    [v.string(), v.optional(v.number({ min: 1 }))],
    (_, instanceId, limit) => previewService.getOutput(instanceId, limit)
  )

  handle('preview:clearInstance', [v.string()], (_, instanceId) => {
    previewService.clearInstance(instanceId)
  })
}
