import { nanoid } from 'nanoid'
import { NormalizedEntry, NormalizedEntryType } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

type RecordLike = Record<string, unknown>

/**
 * OpenCode 日志标准化适配器
 */
export class OpencodeNormalizer implements LogNormalizerAdapter {
  toolId = 'opencode'

  parse(line: string): NormalizedEntry | NormalizedEntry[] | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
      const msg = JSON.parse(trimmed) as RecordLike
      return this.parseMessage(msg)
    } catch {
      return this.createEntry('system_message', trimmed, Date.now())
    }
  }

  private parseMessage(msg: RecordLike): NormalizedEntry | NormalizedEntry[] | null {
    const timestamp = this.resolveTimestamp(msg)
    const rawType = this.getString(msg.type) || this.getString(msg.event)
    const type = rawType?.toLowerCase()

    if (type === 'assistant' || type === 'assistant_message') {
      const content = this.extractContent(msg)
      return content ? this.createEntry('assistant_message', content, timestamp) : null
    }

    if (type === 'user' || type === 'user_message') {
      const content = this.extractContent(msg)
      return content ? this.createEntry('user_message', content, timestamp) : null
    }

    if (type === 'tool_use' || type === 'tool_call' || type === 'tool') {
      return this.createToolUse(msg, timestamp)
    }

    if (type === 'tool_result' || type === 'tool_output') {
      return this.createToolResult(msg, timestamp)
    }

    if (type === 'error') {
      const content = this.extractContent(msg) || rawType || 'Error'
      return this.createEntry('error', content, timestamp)
    }

    if (type === 'sdk_event') {
      const event = this.asRecord(msg.event)
      if (event) {
        const eventType = this.getString(event.type) || this.getString(event.name)
        const eventContent = this.extractContent(event) || eventType || 'Event'
        if (eventType?.toLowerCase().includes('error')) {
          return this.createEntry('error', eventContent, timestamp)
        }
        return this.createEntry('system_message', eventContent, timestamp)
      }
    }

    const content = this.extractContent(msg)
    return content ? this.createEntry('system_message', content, timestamp) : null
  }

  private createToolUse(msg: RecordLike, timestamp: number): NormalizedEntry {
    const toolName =
      this.getString(msg.tool) ||
      this.getString(msg.name) ||
      this.getString(msg.tool_name) ||
      'tool'
    const toolInput = this.asRecord(msg.input) || this.asRecord(msg.args) || undefined
    const toolUseId = this.getString(msg.tool_use_id) || this.getString(msg.call_id) || this.getString(msg.id)
    const entryType = this.resolveToolEntryType(toolName)
    const content = toolInput ? this.stringify(toolInput) : toolName
    return {
      id: nanoid(),
      type: entryType,
      timestamp,
      content,
      metadata: {
        toolName,
        toolInput,
        toolUseId,
        status: 'running'
      }
    }
  }

  private createToolResult(msg: RecordLike, timestamp: number): NormalizedEntry {
    const output = this.extractContent(msg) || this.stringify(msg.result)
    const toolUseId = this.getString(msg.tool_use_id) || this.getString(msg.call_id) || this.getString(msg.id)
    const status = this.getBoolean(msg.is_error) ? 'failed' : 'success'
    return {
      id: nanoid(),
      type: 'tool_result',
      timestamp,
      content: output,
      metadata: {
        toolUseId,
        status
      }
    }
  }

  private resolveToolEntryType(toolName: string): NormalizedEntryType {
    const lower = toolName.toLowerCase()
    if (lower.includes('bash') || lower.includes('shell') || lower.includes('command') || lower.includes('exec')) {
      return 'command_run'
    }
    if (lower.includes('read') || lower.includes('ls') || lower.includes('cat') || lower.includes('open')) {
      return 'file_read'
    }
    if (lower.includes('write') || lower.includes('edit') || lower.includes('patch') || lower.includes('apply')) {
      return 'file_edit'
    }
    return 'tool_use'
  }

  private extractContent(msg: RecordLike | undefined): string | null {
    if (!msg) return null
    const direct = this.getString(msg.content) || this.getString(msg.text) || this.getString(msg.message)
    if (direct) return direct
    const message = this.asRecord(msg.message)
    if (message) {
      const content = message.content
      if (Array.isArray(content)) {
        const text = content.map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as RecordLike
            return this.getString(record.text) || this.getString(record.content) || ''
          }
          return ''
        }).join('')
        return text.trim() ? text : null
      }
      const nested = this.getString(message.content) || this.getString(message.text)
      if (nested) return nested
    }
    return null
  }

  private resolveTimestamp(msg: RecordLike): number {
    const tsMs = this.getNumber(msg.timestamp_ms)
    if (tsMs !== undefined) return tsMs
    const ts = this.getNumber(msg.timestamp)
    if (ts !== undefined) return ts
    return Date.now()
  }

  private createEntry(type: NormalizedEntryType, content: string, timestamp: number): NormalizedEntry {
    return {
      id: nanoid(),
      type,
      timestamp,
      content
    }
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') return value
    if (value === undefined) return ''
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private getNumber(value: unknown): number | undefined {
    return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
  }

  private getBoolean(value: unknown): boolean {
    return value === true
  }

  private asRecord(value: unknown): RecordLike | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
  }
}
