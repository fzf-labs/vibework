import { EventEmitter } from 'events'
import { CliAdapter, CliSessionHandle, CliSessionStatus, CliStartOptions } from './types'
import { ClaudeCodeAdapter } from './adapters/ClaudeCodeAdapter'
import { CursorAgentAdapter } from './adapters/CursorAgentAdapter'
import { GeminiCliAdapter } from './adapters/GeminiCliAdapter'
import { CodexCliAdapter } from './adapters/CodexCliAdapter'
import { OpencodeAdapter } from './adapters/OpencodeAdapter'
import { LogNormalizerService } from '../LogNormalizerService'
import { ClaudeCodeNormalizer } from '../normalizers/ClaudeCodeNormalizer'
import { CodexNormalizer } from '../normalizers/CodexNormalizer'
import { GeminiNormalizer } from '../normalizers/GeminiNormalizer'
import { MsgStoreService } from '../MsgStoreService'
import { CLIToolConfigService } from '../CLIToolConfigService'
import { ClaudeCodeService } from '../ClaudeCodeService'
import { LogMsg } from '../../types/log'

interface SessionRecord {
  handle: CliSessionHandle
  toolId: string
  workdir: string
  startTime: Date
}

export class CliSessionService extends EventEmitter {
  private sessions: Map<string, SessionRecord> = new Map()
  private adapters: Map<string, CliAdapter> = new Map()
  private normalizer: LogNormalizerService
  private configService: CLIToolConfigService

  constructor(claudeCodeService: ClaudeCodeService, configService: CLIToolConfigService) {
    super()
    this.configService = configService

    this.normalizer = new LogNormalizerService()
    this.normalizer.registerAdapter(new ClaudeCodeNormalizer())
    this.normalizer.registerAdapter(new CodexNormalizer())
    this.normalizer.registerAdapter(new GeminiNormalizer())

    this.registerAdapter(new ClaudeCodeAdapter(claudeCodeService))
    this.registerAdapter(new CursorAgentAdapter(this.normalizer))
    this.registerAdapter(new GeminiCliAdapter(this.normalizer))
    this.registerAdapter(new CodexCliAdapter(this.normalizer))
    this.registerAdapter(new OpencodeAdapter(this.normalizer))
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
    model?: string
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    const adapter = this.adapters.get(toolId)
    if (!adapter) {
      throw new Error(`Unsupported CLI tool: ${toolId}`)
    }

    const toolConfig = this.configService.getConfig(toolId)
    const executablePath = typeof toolConfig.executablePath === 'string' ? toolConfig.executablePath : undefined

    const handle = await adapter.startSession({
      sessionId,
      toolId,
      workdir,
      prompt,
      env,
      executablePath,
      toolConfig,
      model
    } as CliStartOptions)

    this.sessions.set(sessionId, {
      handle,
      toolId,
      workdir,
      startTime: new Date()
    })

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
    return this.sessions.get(sessionId)?.handle.msgStore
  }

  subscribeToSession(sessionId: string, callback: (msg: LogMsg) => void): (() => void) | undefined {
    const msgStore = this.getSessionMsgStore(sessionId)
    if (!msgStore) return undefined
    return msgStore.subscribe(callback)
  }

  getSessionLogHistory(sessionId: string): LogMsg[] {
    const msgStore = this.getSessionMsgStore(sessionId)
    if (msgStore) {
      return msgStore.getHistory()
    }
    return MsgStoreService.loadFromFile(sessionId)
  }
}
