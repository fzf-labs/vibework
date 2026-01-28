import { EventEmitter } from 'events'
import { appendFileSync, existsSync, readFileSync } from 'fs'
import { LogMsg, MsgStoreConfig, StoredMsg } from '../types/log'
import { getAppPaths } from './AppPaths'

const DEFAULT_CONFIG: MsgStoreConfig = {
  maxBytes: 50 * 1024 * 1024, // 50MB
  maxMessages: 10000
}

export class MsgStoreService extends EventEmitter {
  private history: StoredMsg[] = []
  private totalBytes = 0
  private config: MsgStoreConfig
  private sessionId: string | null = null
  private logFilePath: string | null = null

  constructor(config?: Partial<MsgStoreConfig>, sessionId?: string) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (sessionId) {
      this.sessionId = sessionId
      this.logFilePath = getAppPaths().getSessionLogFile(sessionId)
    }
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
  push(msg: LogMsg): void {
    const bytes = this.getMessageBytes(msg)

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
    this.history.push({ msg, bytes })
    this.totalBytes += bytes

    // 持久化到文件
    if (this.logFilePath) {
      try {
        appendFileSync(this.logFilePath, JSON.stringify(msg) + '\n')
      } catch (error) {
        console.error('[MsgStore] Failed to persist log:', error)
      }
    }

    // 广播给所有监听者
    this.emit('message', msg)
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
   * 从文件加载历史日志（静态方法）
   */
  static loadFromFile(sessionId: string): LogMsg[] {
    const logFilePath = getAppPaths().getSessionLogFile(sessionId)
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
