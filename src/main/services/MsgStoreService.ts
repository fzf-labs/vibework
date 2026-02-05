import { EventEmitter } from 'events'
import { appendFile, rename, stat, unlink } from 'fs/promises'
import { existsSync, readFileSync, mkdirSync, readdirSync } from 'fs'
import { LogMsg, LogMsgInput, MsgStoreConfig, StoredMsg } from '../types/log'
import { getAppPaths } from '../app/AppPaths'
import { newUlid } from '../utils/ids'
import { config } from '../config'

const DEFAULT_CONFIG: MsgStoreConfig = {
  maxBytes: 50 * 1024 * 1024, // 50MB
  maxMessages: 10000
}

export class MsgStoreService extends EventEmitter {
  private history: StoredMsg[] = []
  private totalBytes = 0
  private config: MsgStoreConfig
  private _taskId: string | null = null
  private _sessionId: string | null = null
  private logFilePath: string | null = null
  private pendingWrites: string[] = []
  private pendingBytes = 0
  private flushTimer: NodeJS.Timeout | null = null
  private isFlushing = false
  private logFlushIntervalMs = config.log.batchFlushIntervalMs
  private logMaxBatchBytes = config.log.maxBatchBytes
  private logMaxFileBytes = config.log.rotation.maxFileBytes
  private logMaxFiles = config.log.rotation.maxFiles

  constructor(
    config?: Partial<MsgStoreConfig>,
    taskId?: string,
    sessionId?: string,
    projectId?: string | null
  ) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (taskId) {
      this._taskId = taskId
    }
    if (sessionId) {
      this._sessionId = sessionId
    }
    const logKey = taskId || sessionId
    if (logKey) {
      const appPaths = getAppPaths()
      const projectDir = appPaths.getProjectSessionsDir(projectId)
      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true })
      }
      this.logFilePath = appPaths.getTaskMessagesFile(logKey, projectId)
      this.loadExistingHistory()
    }
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string | null {
    return this._sessionId
  }

  /**
   * 计算消息的近似字节大小
   */
  private getMessageBytes(msg: LogMsg): number {
    return JSON.stringify(msg).length * 2 // UTF-16 估算
  }

  private addToHistory(msg: LogMsg): void {
    const bytes = this.getMessageBytes(msg)
    while (
      (this.totalBytes + bytes > this.config.maxBytes ||
        this.history.length >= this.config.maxMessages) &&
      this.history.length > 0
    ) {
      const removed = this.history.shift()
      if (removed) {
        this.totalBytes -= removed.bytes
      }
    }
    this.history.push({ msg, bytes })
    this.totalBytes += bytes
  }

  private loadExistingHistory(): void {
    if (!this.logFilePath || !existsSync(this.logFilePath)) return
    try {
      const content = readFileSync(this.logFilePath, 'utf-8')
      if (!content) return
      const lines = content.split('\n').filter((line) => line.length > 0)
      for (const line of lines) {
        const msg = this.parsePersistedLine(line, this._taskId ?? undefined, this._sessionId ?? undefined)
        if (msg) this.addToHistory(msg)
      }
    } catch (error) {
      console.error('[MsgStore] Failed to load existing log history:', error)
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      void this.flushPending()
    }, this.logFlushIntervalMs)
  }

  private enqueuePersist(line: string): void {
    if (!this.logFilePath) return
    this.pendingWrites.push(line)
    this.pendingBytes += Buffer.byteLength(line)

    if (this.pendingBytes >= this.logMaxBatchBytes) {
      void this.flushPending()
      return
    }

    this.scheduleFlush()
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    if (!this.logFilePath) return
    if (this.logMaxFileBytes <= 0 || this.logMaxFiles <= 0) return

    try {
      const stats = await stat(this.logFilePath)
      if (stats.size + incomingBytes <= this.logMaxFileBytes) return
    } catch {
      return
    }

    for (let index = this.logMaxFiles; index >= 1; index -= 1) {
      const source = `${this.logFilePath}.${index}`
      const target = `${this.logFilePath}.${index + 1}`
      if (!existsSync(source)) continue
      if (index === this.logMaxFiles) {
        await unlink(source)
      } else {
        await rename(source, target)
      }
    }

    if (existsSync(this.logFilePath)) {
      await rename(this.logFilePath, `${this.logFilePath}.1`)
    }
  }

  private async flushPending(): Promise<void> {
    if (this.isFlushing || !this.logFilePath) return
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.pendingWrites.length === 0) return

    const payload = this.pendingWrites.join('')
    const payloadBytes = this.pendingBytes
    this.pendingWrites = []
    this.pendingBytes = 0
    this.isFlushing = true

    try {
      await this.rotateIfNeeded(payloadBytes)
      await appendFile(this.logFilePath, payload)
    } catch (error) {
      console.error('[MsgStore] Failed to persist log:', error)
    } finally {
      this.isFlushing = false
      if (this.pendingWrites.length > 0) {
        this.scheduleFlush()
      }
    }
  }

  /**
   * 推送消息到存储和广播
   */
  push(msg: LogMsgInput): void {
    const normalized = this.normalizeMessage(msg)
    this.addToHistory(normalized)

    // 持久化到文件
    this.persistNormalized(normalized)

    // 广播给所有监听者
    this.emit('message', normalized)
  }

  private normalizeMessage(msg: LogMsgInput): LogMsg {
    const legacyExitCode = (msg as { exitCode?: number }).exitCode
    const normalizedInput = legacyExitCode !== undefined && (msg as any).exit_code === undefined
      ? ({ ...msg, exit_code: legacyExitCode } as LogMsgInput)
      : msg

    const sessionId = normalizedInput.session_id ?? this._sessionId ?? 'unknown'
    const taskId =
      normalizedInput.task_id ??
      this._taskId ??
      normalizedInput.session_id ??
      this._sessionId ??
      'unknown'
    const createdAt = normalizedInput.created_at
      ? normalizedInput.created_at
      : normalizedInput.timestamp
        ? new Date(normalizedInput.timestamp).toISOString()
        : new Date().toISOString()

    const base = {
      id: normalizedInput.id ?? newUlid(),
      task_id: taskId,
      session_id: sessionId,
      created_at: createdAt,
      schema_version: normalizedInput.schema_version ?? 'v1',
      meta: normalizedInput.meta
    }

    return {
      ...normalizedInput,
      ...base
    } as LogMsg
  }

  private persistNormalized(msg: LogMsg): void {
    if (!this.logFilePath) return
    if (msg.type === 'stdout' || msg.type === 'stderr') {
      const content = typeof msg.content === 'string' ? msg.content : ''
      if (!content) return
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.length === 0) continue
        this.enqueuePersist(line + '\n')
      }
      return
    }

    const payload = { __vw_log: true, ...msg }
    this.enqueuePersist(JSON.stringify(payload) + '\n')
  }

  private parsePersistedLine(
    line: string,
    taskId?: string,
    sessionId?: string
  ): LogMsg | null {
    if (!line) return null
    const trimmed = line.trim()
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        if (parsed.__vw_log === true) {
          const { __vw_log, ...rest } = parsed as Record<string, unknown>
          return rest as LogMsg
        }
        const type = parsed.type
        const hasSchema = typeof parsed.schema_version === 'string' || typeof parsed.task_id === 'string'
        if (typeof type === 'string' && hasSchema) {
          return parsed as LogMsg
        }
      }
    } catch {
      // treat as raw stdout
    }

    const now = Date.now()
    return {
      id: newUlid(),
      type: 'stdout',
      content: line,
      timestamp: now,
      task_id: taskId ?? 'unknown',
      session_id: sessionId ?? 'unknown',
      created_at: new Date(now).toISOString(),
      schema_version: 'v1'
    }
  }

  /**
   * 获取所有历史消息
   */
  getHistory(): LogMsg[] {
    return this.history.map((stored) => stored.msg)
  }

  /**
   * 订阅消息流
   */
  subscribe(callback: (msg: LogMsg) => void): () => void {
    this.on('message', callback)
    return () => this.off('message', callback)
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.history = []
    this.totalBytes = 0
  }

  /**
   * 获取当前存储状态
   */
  getStats(): { messageCount: number; totalBytes: number } {
    return {
      messageCount: this.history.length,
      totalBytes: this.totalBytes
    }
  }

  /**
   * 获取历史记录 + 实时流的组合
   * 先返回所有历史消息，然后订阅新消息
   */
  historyPlusStream(callback: (msg: LogMsg) => void): () => void {
    // 先发送历史记录
    const history = this.getHistory()
    for (const msg of history) {
      callback(msg)
    }

    // 然后订阅实时流
    return this.subscribe(callback)
  }

  /**
   * 获取 stdout 行流
   * 按行分割 stdout 内容，确保 JSON 解析的准确性
   */
  stdoutLinesStream(callback: (line: string) => void): () => void {
    const handleMessage = (msg: LogMsg): void => {
      if (msg.type !== 'stdout') return
      if (typeof msg.content === 'string' && msg.content.trim()) {
        callback(msg.content)
      }
    }

    return this.subscribe(handleMessage)
  }

  /**
   * 从文件加载历史日志（静态方法）
   */
  static loadFromFile(taskId: string, projectId?: string | null): LogMsg[] {
    const appPaths = getAppPaths()
    const candidatePaths: string[] = []

    if (projectId !== undefined) {
      candidatePaths.push(appPaths.getTaskMessagesFile(taskId, projectId))
    }

    if (!projectId) {
      try {
        const sessionsDir = appPaths.getSessionsDir()
        const entries = readdirSync(sessionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          candidatePaths.push(
            appPaths.getTaskMessagesFile(taskId, entry.name)
          )
        }
      } catch {
        // ignore directory scan errors
      }
    }

    const logFilePath = candidatePaths.find((path) => existsSync(path))
    if (!logFilePath) {
      return []
    }

    try {
      const content = readFileSync(logFilePath, 'utf-8')
      if (!content) return []
      const lines = content.split('\n').filter((line) => line.length > 0)
      return lines
        .map((line) => {
          if (!line) return null
          const trimmed = line.trim()
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>
            if (parsed && typeof parsed === 'object') {
              if (parsed.__vw_log === true) {
                const { __vw_log, ...rest } = parsed as Record<string, unknown>
                return rest as LogMsg
              }
              const type = parsed.type
              const hasSchema = typeof parsed.schema_version === 'string' || typeof parsed.task_id === 'string'
              if (typeof type === 'string' && hasSchema) {
                return parsed as LogMsg
              }
            }
          } catch {
            // treat as raw stdout
          }
          const now = Date.now()
          return {
            id: newUlid(),
            type: 'stdout',
            content: line,
            timestamp: now,
            task_id: taskId,
            session_id: 'unknown',
            created_at: new Date(now).toISOString(),
            schema_version: 'v1'
          } as LogMsg
        })
        .filter((msg): msg is LogMsg => Boolean(msg))
    } catch (error) {
      console.error('[MsgStore] Failed to load log file:', error)
      return []
    }
  }
}
