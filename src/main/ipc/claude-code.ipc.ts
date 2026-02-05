import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerClaudeCodeIpc = ({
  handle,
  v,
  services,
  resolveProjectIdForSession
}: IpcModuleContext): void => {
  const { cliSessionService } = services

  handle(IPC_CHANNELS.claudeCode.getConfig, [], () =>
    cliSessionService.getToolConfig('claude-code')
  )

  handle(IPC_CHANNELS.claudeCode.saveConfig, [v.object()], (_, configValue) => {
    cliSessionService.saveToolConfig('claude-code', configValue as Record<string, unknown>)
  })

  handle(
    IPC_CHANNELS.claudeCode.startSession,
    [
      v.string(),
      v.string(),
      v.optional(
        v.shape({
          model: v.optional(v.string()),
          prompt: v.optional(v.string({ allowEmpty: true })),
          projectId: v.optional(v.nullable(v.string({ allowEmpty: true })))
        })
      )
    ],
    async (_, sessionId, workdir, options) => {
      console.log('[IPC] claudeCode:startSession called:', sessionId, workdir)
      if (options?.prompt) {
        console.log('[IPC] claudeCode:startSession prompt:', options.prompt)
      }
      const projectId = options?.projectId ?? resolveProjectIdForSession(sessionId)
      await cliSessionService.startSession(
        sessionId,
        'claude-code',
        workdir,
        options?.prompt,
        undefined,
        options?.model,
        projectId
      )
      console.log('[IPC] claudeCode:startSession success')
    }
  )

  handle(IPC_CHANNELS.claudeCode.stopSession, [v.string()], (_, sessionId) => {
    cliSessionService.stopSession(sessionId)
  })

  handle(
    IPC_CHANNELS.claudeCode.sendInput,
    [v.string(), v.string({ allowEmpty: true })],
    (_, sessionId, input) => {
    console.log('[IPC] claudeCode:sendInput prompt:', input)
    cliSessionService.sendInput(sessionId, input)
  })

  handle(IPC_CHANNELS.claudeCode.getOutput, [v.string()], (_, sessionId) => {
    return cliSessionService.getSessionOutput(sessionId)
  })

  handle(IPC_CHANNELS.claudeCode.getSessions, [], () => {
    return cliSessionService.getAllSessions().filter((session) => session.toolId === 'claude-code')
  })

  handle(IPC_CHANNELS.claudeCode.getSession, [v.string()], (_, sessionId) => {
    const session = cliSessionService.getSession(sessionId)
    if (!session) return null
    return {
      id: session.id,
      status: session.status,
      workdir: session.workdir,
      startTime: session.startTime
    }
  })
}
