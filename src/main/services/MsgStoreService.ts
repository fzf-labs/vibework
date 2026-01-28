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

  constructor(config?: Partial<MsgStoreConfig>) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
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
}
