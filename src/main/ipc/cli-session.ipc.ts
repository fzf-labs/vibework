import type { IpcModuleContext } from './types'
import type { LogMsgInput } from '../types/log'
import { IPC_CHANNELS, IPC_EVENTS } from './channels'

export const registerCliSessionIpc = ({
  handle,
  v,
  services,
  resolveProjectIdForSession
}: IpcModuleContext): void => {
  const { cliSessionService, databaseService } = services
  const logStreamSubscriptions = new Map<string, () => void>()

  handle(
    IPC_CHANNELS.cliSession.startSession,
    [
      v.string(),
      v.string(),
      v.string(),
      v.optional(
        v.shape({
          prompt: v.optional(v.string({ allowEmpty: true })),
          model: v.optional(v.string()),
          projectId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          taskId: v.optional(v.string())
        })
      )
    ],
    async (
      _,
      sessionId,
      toolId,
      workdir,
      options?: { prompt?: string; model?: string; projectId?: string | null; taskId?: string }
    ) => {
      const task = options?.taskId ? databaseService.getTask(options.taskId) : null
      const projectId =
        options?.projectId ?? task?.project_id ?? resolveProjectIdForSession(sessionId)
      await cliSessionService.startSession(
        sessionId,
        toolId,
        workdir,
        options?.prompt,
        undefined,
        options?.model,
        projectId,
        options?.taskId
      )
    }
  )

  handle(IPC_CHANNELS.cliSession.stopSession, [v.string()], (_, sessionId) => {
    cliSessionService.stopSession(sessionId)
  })

  handle(
    IPC_CHANNELS.cliSession.sendInput,
    [v.string(), v.string({ allowEmpty: true })],
    (_, sessionId, input) => {
    cliSessionService.sendInput(sessionId, input)
  })

  handle(IPC_CHANNELS.cliSession.getSessions, [], () => cliSessionService.getAllSessions())

  handle(IPC_CHANNELS.cliSession.getSession, [v.string()], (_, sessionId) => {
    const session = cliSessionService.getSession(sessionId)
    if (!session) return null
    return session
  })

  handle(
    IPC_CHANNELS.cliSession.appendLog,
    [
      v.string(),
      v.string(),
      v.object(),
      v.optional(v.nullable(v.string({ allowEmpty: true })))
    ],
    (_, taskId, sessionId, msg, projectId) => {
      cliSessionService.appendSessionLog(taskId, sessionId, msg as LogMsgInput, projectId ?? null)
    }
  )

  handle(IPC_CHANNELS.logStream.subscribe, [v.string()], (event, sessionId) => {
    console.log('[IPC] logStream:subscribe called:', sessionId)
    const webContents = event.sender
    const key = `${webContents.id}-${sessionId}`
    const existing = logStreamSubscriptions.get(key)
    if (existing) {
      existing()
      logStreamSubscriptions.delete(key)
    }

    const unsubscribe = cliSessionService.subscribeToSession(sessionId, (msg) => {
      console.log('[IPC] logStream:message sending:', sessionId, msg.type)
      if (!webContents.isDestroyed()) {
        webContents.send(IPC_EVENTS.logStream.message, sessionId, msg)
      }
    })

    if (!unsubscribe) {
      console.log('[IPC] logStream:subscribe failed - session not found')
      throw new Error('Session not found')
    }

    logStreamSubscriptions.set(key, unsubscribe)
    webContents.once('destroyed', () => {
      const sub = logStreamSubscriptions.get(key)
      if (sub) {
        sub()
        logStreamSubscriptions.delete(key)
      }
    })
    console.log('[IPC] logStream:subscribe success')
    return { success: true }
  })

  handle(IPC_CHANNELS.logStream.unsubscribe, [v.string()], (event, sessionId) => {
    const key = `${event.sender.id}-${sessionId}`
    const unsubscribe = logStreamSubscriptions.get(key)
    if (unsubscribe) {
      unsubscribe()
      logStreamSubscriptions.delete(key)
    }
    return { success: true }
  })

  handle(
    IPC_CHANNELS.logStream.getHistory,
    [v.string(), v.optional(v.nullable(v.string({ allowEmpty: true })))],
    (_, taskId, sessionId) => {
      console.log('[IPC] logStream:getHistory called:', { taskId, sessionId })
      const history = cliSessionService.getSessionLogHistory(sessionId ?? null, taskId)
      console.log('[IPC] logStream:getHistory returning:', history.length, 'messages')
      return history
    }
  )
}
