import { EventEmitter } from 'events'
import { CliAdapter, CliSessionHandle, CliSessionStatus, CliStartOptions } from './types'
import { ClaudeCodeAdapter } from './adapters/ClaudeCodeAdapter'
import { CursorAgentAdapter } from './adapters/CursorAgentAdapter'
import { GeminiCliAdapter } from './adapters/GeminiCliAdapter'
import { CodexCliAdapter } from './adapters/CodexCliAdapter'
import { OpencodeAdapter } from './adapters/OpencodeAdapter'
import { MsgStoreService } from '../MsgStoreService'
import { CLIToolConfigService } from '../CLIToolConfigService'
import { DatabaseService } from '../DatabaseService'
import { LogMsg } from '../../types/log'

interface SessionRecord {
  handle: CliSessionHandle
  toolId: string
  workdir: string
  startTime: Date
}

export class CliSessionService extends EventEmitter {
  private sessions: Map<string, SessionRecord> = new Map()
  private pendingMsgStores: Map<string, MsgStoreService> = new Map()
  private adapters: Map<string, CliAdapter> = new Map()
  private configService: CLIToolConfigService
  private databaseService: DatabaseService

  constructor(configService: CLIToolConfigService, databaseService: DatabaseService) {
    super()
    this.configService = configService
    this.databaseService = databaseService

    this.registerAdapter(new ClaudeCodeAdapter(configService))
    this.registerAdapter(new CursorAgentAdapter())
    this.registerAdapter(new GeminiCliAdapter())
    this.registerAdapter(new CodexCliAdapter())
    this.registerAdapter(new OpencodeAdapter())
  }

  registerAdapter(adapter: CliAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  async startSession(
    sessionId: string,
    toolId: string,
    workdir: string,
    prompt?: string,
    env?: NodeJS.ProcessEnv,
    model?: string,
    projectId?: string | null,
    taskId?: string,
    configId?: string | null
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    const adapter = this.adapters.get(toolId)
    if (!adapter) {
      throw new Error(`Unsupported CLI tool: ${toolId}`)
    }

    const baseConfig = this.configService.getConfig(toolId)
    const normalizedBase: Record<string, unknown> = { ...baseConfig }
    if (typeof baseConfig.defaultModel === 'string' && !('model' in normalizedBase)) {
      normalizedBase.model = baseConfig.defaultModel
    }
    if (typeof baseConfig.apiKey === 'string' && !('apiKey' in normalizedBase)) {
      normalizedBase.apiKey = baseConfig.apiKey
    }

    let resolvedConfigId = configId ?? null
    if (!resolvedConfigId && taskId) {
      const task = this.databaseService.getTask(taskId)
      resolvedConfigId = task?.agent_tool_config_id ?? null
    }

    let profileConfig: Record<string, unknown> = {}
    if (resolvedConfigId) {
      const record = this.databaseService.getAgentToolConfig(resolvedConfigId)
      if (record?.config_json) {
        try {
          const parsed = JSON.parse(record.config_json)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            profileConfig = parsed as Record<string, unknown>
          }
        } catch (error) {
          console.error('[CliSessionService] Failed to parse agent tool config:', error)
        }
      }
    }

    const toolConfig = {
      ...normalizedBase,
      ...profileConfig
    }

    const envFromConfig = (toolConfig.env && typeof toolConfig.env === 'object' && !Array.isArray(toolConfig.env))
      ? (toolConfig.env as Record<string, string>)
      : undefined
    const mergedEnv = {
      ...process.env,
      ...(envFromConfig ?? {}),
      ...(env ?? {})
    }

    const executablePath =
      typeof toolConfig.executablePath === 'string' ? toolConfig.executablePath : undefined

    const pendingMsgStore = this.pendingMsgStores.get(sessionId)
    const msgStore =
      pendingMsgStore ?? new MsgStoreService(undefined, taskId, sessionId, projectId)
    const handle = await adapter.startSession({
      sessionId,
      toolId,
      workdir,
      taskId,
      projectId,
      prompt,
      env: mergedEnv,
      executablePath,
      toolConfig,
      model,
      msgStore
    } as CliStartOptions)

    this.sessions.set(sessionId, {
      handle,
      toolId,
      workdir,
      startTime: new Date()
    })
    if (pendingMsgStore) {
      this.pendingMsgStores.delete(sessionId)
    }

    handle.on('status', (data: { sessionId: string; status: CliSessionStatus; forced?: boolean }) => {
      this.emit('status', data)
    })

    handle.on('output', (data: { sessionId: string; type: 'stdout' | 'stderr'; content: string }) => {
      this.emit('output', data)
    })

    handle.on(
      'close',
      (data: { sessionId: string; code: number | null; forcedStatus?: CliSessionStatus }) => {
        this.emit('close', data)
        this.sessions.delete(sessionId)
      }
    )

    handle.on('error', (data: { sessionId: string; error: string }) => {
      this.emit('error', data)
    })
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    session.handle.stop()
  }

  sendInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (!session.handle.sendInput) {
      throw new Error(`Session ${sessionId} does not support input`) 
    }
    session.handle.sendInput(input)
  }

  getSession(sessionId: string): { id: string; status: CliSessionStatus; workdir: string; toolId: string; startTime: Date } | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      id: sessionId,
      status: session.handle.status,
      workdir: session.workdir,
      toolId: session.toolId,
      startTime: session.startTime
    }
  }

  getAllSessions(): Array<{ id: string; status: CliSessionStatus; workdir: string; toolId: string; startTime: Date }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      status: session.handle.status,
      workdir: session.workdir,
      toolId: session.toolId,
      startTime: session.startTime
    }))
  }

  getSessionMsgStore(sessionId: string): MsgStoreService | undefined {
    return this.sessions.get(sessionId)?.handle.msgStore ?? this.pendingMsgStores.get(sessionId)
  }

  subscribeToSession(sessionId: string, callback: (msg: LogMsg) => void): (() => void) | undefined {
    const msgStore = this.getSessionMsgStore(sessionId)
    if (!msgStore) return undefined
    return msgStore.subscribe(callback)
  }

  getSessionLogHistory(sessionId?: string | null, taskId?: string | null): LogMsg[] {
    const msgStore = sessionId ? this.getSessionMsgStore(sessionId) : undefined
    if (msgStore) {
      return msgStore.getHistory()
    }
    if (taskId) {
      return MsgStoreService.loadFromFile(taskId)
    }
    if (sessionId) {
      return MsgStoreService.loadFromFile(sessionId)
    }
    return []
  }

  getToolConfig(toolId: string): Record<string, unknown> {
    return this.configService.getConfig(toolId)
  }

  saveToolConfig(toolId: string, updates: Record<string, unknown>): void {
    const current = this.configService.getConfig(toolId)
    this.configService.saveConfig(toolId, { ...current, ...updates })
  }

  getSessionOutput(sessionId: string, taskId?: string | null): string[] {
    const history = this.getSessionLogHistory(sessionId, taskId)
    return history
      .filter(msg => msg.type === 'stdout')
      .map(msg => (msg as { content: string }).content)
  }

  dispose(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        session.handle.stop()
      } catch (error) {
        console.error('[CliSessionService] Failed to stop session:', sessionId, error)
      }
      this.sessions.delete(sessionId)
    }
    this.pendingMsgStores.clear()
  }
}
