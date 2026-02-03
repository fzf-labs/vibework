import type { IpcModuleContext } from './types'

export const registerCliIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { cliProcessService } = services

  handle(
    'cli:startSession',
    [v.string(), v.string(), v.array(v.string()), v.optional(v.string())],
    (_, sessionId, command, args, cwd) => {
      cliProcessService.startSession(sessionId, command, args, cwd)
    }
  )

  handle('cli:stopSession', [v.string()], (_, sessionId) => {
    cliProcessService.stopSession(sessionId)
  })

  handle('cli:getOutput', [v.string()], (_, sessionId) => {
    return cliProcessService.getSessionOutput(sessionId)
  })
}
