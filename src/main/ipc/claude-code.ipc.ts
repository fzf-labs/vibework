import type { IpcModuleContext } from './types'
import type { ClaudeCodeService } from '../services/ClaudeCodeService'

export const registerClaudeCodeIpc = ({
  handle,
  v,
  services,
  resolveProjectIdForSession
}: IpcModuleContext): void => {
  const { claudeCodeService, cliSessionService } = services

  handle('claudeCode:getConfig', [], () => claudeCodeService.getConfig())

  handle('claudeCode:saveConfig', [v.object()], (_, configValue) => {
    claudeCodeService.saveConfig(configValue as Parameters<ClaudeCodeService['saveConfig']>[0])
  })

  handle(
    'claudeCode:startSession',
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

  handle('claudeCode:stopSession', [v.string()], (_, sessionId) => {
    cliSessionService.stopSession(sessionId)
  })

  handle('claudeCode:sendInput', [v.string(), v.string({ allowEmpty: true })], (_, sessionId, input) => {
    console.log('[IPC] claudeCode:sendInput prompt:', input)
    cliSessionService.sendInput(sessionId, input)
  })

  handle('claudeCode:getOutput', [v.string()], (_, sessionId) => {
    return claudeCodeService.getSessionOutput(sessionId)
  })

  handle('claudeCode:getSessions', [], () => {
    return cliSessionService.getAllSessions().filter((session) => session.toolId === 'claude-code')
  })

  handle('claudeCode:getSession', [v.string()], (_, sessionId) => {
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
