import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerCliIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { cliProcessService } = services

  handle(
    IPC_CHANNELS.cli.startSession,
    [v.string(), v.string(), v.array(v.string()), v.optional(v.string())],
    (_, sessionId, command, args, cwd) => {
      cliProcessService.startSession(sessionId, command, args, cwd)
    }
  )

  handle(IPC_CHANNELS.cli.stopSession, [v.string()], (_, sessionId) => {
    cliProcessService.stopSession(sessionId)
  })

  handle(IPC_CHANNELS.cli.getOutput, [v.string()], (_, sessionId) => {
    return cliProcessService.getSessionOutput(sessionId)
  })
}
