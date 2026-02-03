export interface OutputBufferConfig {
  maxBytes: number
  maxEntries: number
}

export interface OutputSnapshot {
  output: string[]
  truncated: boolean
  byteLength: number
  entryCount: number
}

export class OutputBuffer {
  private entries: string[] = []
  private totalBytes = 0
  private truncated = false
  private config: OutputBufferConfig

  constructor(config: OutputBufferConfig) {
    this.config = config
  }

  push(entry: string): void {
    if (!entry) return
    const bytes = Buffer.byteLength(entry)
    this.entries.push(entry)
    this.totalBytes += bytes
    this.enforceLimits()
  }

  clear(): void {
    this.entries = []
    this.totalBytes = 0
    this.truncated = false
  }

  snapshot(): OutputSnapshot {
    return {
      output: [...this.entries],
      truncated: this.truncated,
      byteLength: this.totalBytes,
      entryCount: this.entries.length
    }
  }

  private enforceLimits(): void {
    const { maxBytes, maxEntries } = this.config
    while (
      (this.totalBytes > maxBytes || this.entries.length > maxEntries) &&
      this.entries.length > 0
    ) {
      const removed = this.entries.shift()
      if (removed) {
        this.totalBytes -= Buffer.byteLength(removed)
      }
      this.truncated = true
    }
  }
}
