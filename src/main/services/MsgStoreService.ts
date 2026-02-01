import { EventEmitter } from 'events'
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { LogMsg, LogMsgInput, MsgStoreConfig, StoredMsg } from '../types/log'
import { getAppPaths } from './AppPaths'
import { newUlid } from '../utils/ids'

const DEFAULT_CONFIG: MsgStoreConfig = {
  maxBytes: 50 * 1024 * 1024, // 50MB
  maxMessages: 10000
}

export class MsgStoreService extends EventEmitter {
  private history: StoredMsg[] = []
  private totalBytes = 0
  private config: MsgStoreConfig
  private _sessionId: string | null = null
  private logFilePath: string | null = null

  constructor(config?: Partial<MsgStoreConfig>, sessionId?: string) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (sessionId) {
      this._sessionId = sessionId
      const appPaths = getAppPaths()
      const sessionDir = appPaths.getSessionDataDir(sessionId)
      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true })
      }
      this.logFilePath = appPaths.getSessionMessagesFile(sessionId)
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

  /**
   * 推送消息到存储和广播
   */
  push(msg: LogMsgInput): void {
    const normalized = this.normalizeMessage(msg)
    const bytes = this.getMessageBytes(normalized)

    // 自动淘汰旧数据以保持在限制内
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

    // 存储新消息
    this.history.push({ msg: normalized, bytes })
    this.totalBytes += bytes

    // 持久化到文件
    if (this.logFilePath) {
      try {
        appendFileSync(this.logFilePath, JSON.stringify(normalized) + '\n')
      } catch (error) {
        console.error('[MsgStore] Failed to persist log:', error)
      }
    }

    // 广播给所有监听者
    this.emit('message', normalized)
  }

  private normalizeMessage(msg: LogMsgInput): LogMsg {
    const legacyExitCode = (msg as { exitCode?: number }).exitCode
    const normalizedInput = legacyExitCode !== undefined && (msg as any).exit_code === undefined
      ? ({ ...msg, exit_code: legacyExitCode } as LogMsgInput)
      : msg

    const sessionId = normalizedInput.session_id ?? this._sessionId ?? 'unknown'
    const taskId = normalizedInput.task_id ?? sessionId
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
    let lineBuffer = ''

    const handleMessage = (msg: LogMsg): void => {
      if (msg.type !== 'stdout') return

      lineBuffer += msg.content

      // 按换行符分割
      const lines = lineBuffer.split('\n')

      // 最后一个元素可能是不完整的行，保留在缓冲区
      lineBuffer = lines.pop() || ''

      // 推送完整的行
      for (const line of lines) {
        if (line.trim()) {
          callback(line)
        }
      }
    }

    return this.subscribe(handleMessage)
  }

  /**
   * 从文件加载历史日志（静态方法）
   */
  static loadFromFile(sessionId: string): LogMsg[] {
    const logFilePath = getAppPaths().getSessionMessagesFile(sessionId)
    if (!existsSync(logFilePath)) {
      return []
    }

    try {
      const content = readFileSync(logFilePath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      return lines.map((line) => JSON.parse(line) as LogMsg)
    } catch (error) {
      console.error('[MsgStore] Failed to load log file:', error)
      return []
    }
  }
}
