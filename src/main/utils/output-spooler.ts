import { appendFile, rename, stat, unlink } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export interface OutputSpoolerConfig {
  enabled: boolean
  flushIntervalMs: number
  maxBatchBytes: number
  maxFileBytes: number
  maxFiles: number
}

export class OutputSpooler {
  private filePath: string
  private config: OutputSpoolerConfig
  private pending: string[] = []
  private pendingBytes = 0
  private flushTimer: NodeJS.Timeout | null = null
  private isFlushing = false

  constructor(filePath: string, config: OutputSpoolerConfig) {
    this.filePath = filePath
    this.config = config
    if (config.enabled) {
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
  }

  append(chunk: string): void {
    if (!this.config.enabled || !chunk) return
    this.pending.push(chunk)
    this.pendingBytes += Buffer.byteLength(chunk)

    if (this.pendingBytes >= this.config.maxBatchBytes) {
      void this.flush()
      return
    }

    this.scheduleFlush()
  }

  async dispose(): Promise<void> {
    await this.flush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      void this.flush()
    }, this.config.flushIntervalMs)
  }

  private async flush(): Promise<void> {
    if (!this.config.enabled || this.isFlushing) return
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.pending.length === 0) return
    const payload = this.pending.join('')
    const payloadBytes = this.pendingBytes
    this.pending = []
    this.pendingBytes = 0
    this.isFlushing = true

    try {
      await this.rotateIfNeeded(payloadBytes)
      await appendFile(this.filePath, payload)
    } catch (error) {
      console.error('[OutputSpooler] Failed to persist output:', error)
    } finally {
      this.isFlushing = false
      if (this.pending.length > 0) {
        this.scheduleFlush()
      }
    }
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    if (this.config.maxFileBytes <= 0 || this.config.maxFiles <= 0) return
    try {
      const stats = await stat(this.filePath)
      if (stats.size + incomingBytes <= this.config.maxFileBytes) return
    } catch {
      return
    }

    for (let index = this.config.maxFiles; index >= 1; index -= 1) {
      const source = `${this.filePath}.${index}`
      const target = `${this.filePath}.${index + 1}`
      if (!existsSync(source)) continue
      if (index === this.config.maxFiles) {
        await unlink(source)
      } else {
        await rename(source, target)
      }
    }

    if (existsSync(this.filePath)) {
      await rename(this.filePath, `${this.filePath}.1`)
    }
  }
}
