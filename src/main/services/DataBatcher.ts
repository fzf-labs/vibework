import { StringDecoder } from 'string_decoder'

export interface BatcherConfig {
  /** 刷新间隔，默认 16ms (60fps) */
  flushIntervalMs: number
  /** 最大批处理字节数，默认 200KB */
  maxBatchBytes: number
}

const DEFAULT_CONFIG: BatcherConfig = {
  flushIntervalMs: 16,
  maxBatchBytes: 200 * 1024
}

/**
 * 数据批处理器
 * 合并短时间内的多条消息，减少 IPC 调用频率
 */
export class DataBatcher {
  private buffer: string = ''
  private decoder: StringDecoder
  private timeout: NodeJS.Timeout | null = null
  private config: BatcherConfig
  private onFlush: (data: string) => void

  constructor(onFlush: (data: string) => void, config?: Partial<BatcherConfig>) {
    this.onFlush = onFlush
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.decoder = new StringDecoder('utf8')
  }

  /**
   * 写入数据到缓冲区
   */
  write(data: Buffer | string): void {
    // 使用 StringDecoder 处理 UTF-8 多字节字符
    const decoded = typeof data === 'string' ? data : this.decoder.write(data)
    this.buffer += decoded

    // 如果超过大小阈值，立即刷新
    if (this.buffer.length >= this.config.maxBatchBytes) {
      this.flush()
      return
    }

    // 设置定时刷新
    if (this.timeout === null) {
      this.timeout = setTimeout(() => this.flush(), this.config.flushIntervalMs)
    }
  }

  /**
   * 刷新缓冲区
   */
  flush(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    if (this.buffer.length > 0) {
      const data = this.buffer
      this.buffer = ''
      this.onFlush(data)
    }
  }

  /**
   * 销毁批处理器
   */
  destroy(): void {
    // 刷新剩余数据
    const remaining = this.decoder.end()
    if (remaining) {
      this.buffer += remaining
    }
    this.flush()

    if (this.timeout !== null) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }
}
