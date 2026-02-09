import type { IpcModuleContext } from './types'
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
          taskId: v.optional(v.string()),
          taskNodeId: v.optional(v.string()),
          configId: v.optional(v.nullable(v.string({ allowEmpty: true })))
        })
      )
    ],
    async (
      _,
      sessionId,
      toolId,
      workdir,
      options?: {
        prompt?: string
        model?: string
        projectId?: string | null
        taskId?: string
        taskNodeId?: string
        configId?: string | null
      }
    ) => {
      const taskNode = options?.taskNodeId ? databaseService.getTaskNode(options.taskNodeId) : null
      const resolvedTaskId = options?.taskId ?? taskNode?.task_id
      const task = resolvedTaskId ? databaseService.getTask(resolvedTaskId) : null
      const projectId = options?.projectId ?? task?.project_id ?? resolveProjectIdForSession(sessionId)

      await cliSessionService.startSession(
        sessionId,
        toolId,
        workdir,
        options?.prompt,
        undefined,
        options?.model,
        projectId,
        resolvedTaskId,
        options?.configId ?? null,
        options?.taskNodeId
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
    }
  )

  handle(IPC_CHANNELS.cliSession.getSessions, [], () => cliSessionService.getAllSessions())

  handle(IPC_CHANNELS.cliSession.getSession, [v.string()], (_, sessionId) => {
    const session = cliSessionService.getSession(sessionId)
    if (!session) return null
    return session
  })

  handle(IPC_CHANNELS.logStream.subscribe, [v.string()], (event, sessionId) => {
    const webContents = event.sender
    const key = `${webContents.id}-${sessionId}`
    const existing = logStreamSubscriptions.get(key)
    if (existing) {
      existing()
      logStreamSubscriptions.delete(key)
    }

    const unsubscribe = cliSessionService.subscribeToSession(sessionId, (msg) => {
      if (!webContents.isDestroyed()) {
        webContents.send(IPC_EVENTS.logStream.message, sessionId, msg)
      }
    })

    if (!unsubscribe) {
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
    [
      v.string(),
      v.optional(v.nullable(v.string({ allowEmpty: true }))),
      v.optional(v.nullable(v.string({ allowEmpty: true })))
    ],
    (_, taskId, sessionId, taskNodeId) => {
      return cliSessionService.getSessionLogHistory(sessionId ?? null, taskId, taskNodeId ?? null)
    }
  )
}
