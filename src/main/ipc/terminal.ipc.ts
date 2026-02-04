import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerTerminalIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { terminalService } = services

  handle(
    IPC_CHANNELS.terminal.startSession,
    [
      v.string(),
      v.string(),
      v.optional(v.number()),
      v.optional(v.number()),
      v.optional(v.string())
    ],
    async (_, paneId, cwd, cols, rows, workspaceId) => {
      return terminalService.createOrAttach({
        paneId,
        cwd,
        cols: cols ?? undefined,
        rows: rows ?? undefined,
        workspaceId: workspaceId ?? null
      })
    }
  )

  handle(
    IPC_CHANNELS.terminal.write,
    [v.string(), v.string({ allowEmpty: true })],
    (_, paneId, data) => {
      terminalService.write({ paneId, data })
    }
  )

  handle(
    IPC_CHANNELS.terminal.resize,
    [v.string(), v.number(), v.number()],
    (_, paneId, cols, rows) => {
      terminalService.resize({ paneId, cols, rows })
    }
  )

  handle(
    IPC_CHANNELS.terminal.signal,
    [v.string(), v.optional(v.string())],
    (_, paneId, signal) => {
      terminalService.signal({ paneId, signal: signal ?? undefined })
    }
  )

  handle(IPC_CHANNELS.terminal.kill, [v.string()], (_, paneId) => {
    terminalService.kill({ paneId })
  })

  handle(IPC_CHANNELS.terminal.detach, [v.string()], (_, paneId) => {
    terminalService.detach({ paneId })
  })

  handle(IPC_CHANNELS.terminal.killByWorkspaceId, [v.string()], (_, workspaceId) => {
    return terminalService.killByWorkspaceId(workspaceId)
  })
}
