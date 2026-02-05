import { nanoid } from 'nanoid'
import { NormalizedEntry, NormalizedEntryType } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

type RecordLike = Record<string, unknown>

/**
 * Cursor Agent 日志标准化适配器
 */
export class CursorAgentNormalizer implements LogNormalizerAdapter {
  toolId = 'cursor-agent'

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
    const type = this.getString(msg.type)?.toLowerCase()

    if (type === 'assistant') {
      const content = this.extractMessageText(msg)
      return content ? this.createEntry('assistant_message', content, timestamp) : null
    }

    if (type === 'user') {
      const content = this.extractMessageText(msg)
      return content ? this.createEntry('user_message', content, timestamp) : null
    }

    if (type === 'system') {
      return this.parseSystemMessage(msg, timestamp)
    }

    if (type === 'tool_call') {
      return this.parseToolCall(msg, timestamp)
    }

    if (type === 'result') {
      const resultText = this.getString(msg.result)
      if (resultText) {
        return this.createEntry('assistant_message', resultText, timestamp)
      }
      return this.createEntry('system_message', 'Completed', timestamp)
    }

    if (type === 'error' || this.getBoolean(msg.is_error)) {
      const content = this.getString(msg.error) || this.getString(msg.message) || 'Error'
      return this.createEntry('error', content, timestamp)
    }

    const fallback = this.extractMessageText(msg) || this.getString(msg.content) || this.getString(msg.message)
    if (fallback) {
      return this.createEntry('system_message', fallback, timestamp)
    }

    return null
  }

  private parseSystemMessage(msg: RecordLike, timestamp: number): NormalizedEntry | null {
    const subtype = this.getString(msg.subtype)
    if (subtype === 'init') {
      const model = this.getString(msg.model) || 'unknown'
      return this.createEntry('system_message', `System initialized with model: ${model}`, timestamp)
    }
    const content = this.getString(msg.content) || (subtype ? `System: ${subtype}` : '')
    return content ? this.createEntry('system_message', content, timestamp) : null
  }

  private parseToolCall(msg: RecordLike, timestamp: number): NormalizedEntry | null {
    const subtype = this.getString(msg.subtype)?.toLowerCase()
    const { toolName, toolInput, toolOutput, toolUseId, isError } = this.extractToolCallDetails(msg)

    const entryType = this.resolveToolEntryType(toolName)

    if (subtype === 'completed') {
      const content = toolOutput ?? ''
      return {
        id: nanoid(),
        type: 'tool_result',
        timestamp,
        content,
        metadata: {
          toolUseId,
          toolName,
          toolOutput: content,
          status: isError ? 'failed' : 'success'
        }
      }
    }

    return {
      id: nanoid(),
      type: entryType,
      timestamp,
      content: this.formatToolInput(toolName, toolInput),
      metadata: {
        toolName,
        toolInput: toolInput ?? undefined,
        toolUseId,
        status: subtype === 'started' ? 'running' : 'pending'
      }
    }
  }

  private extractToolCallDetails(msg: RecordLike): {
    toolName: string
    toolInput: RecordLike | null
    toolOutput: string | null
    toolUseId?: string
    isError: boolean
  } {
    const toolCall = this.asRecord(msg.tool_call) || this.asRecord(msg.toolCall)
    let toolName = 'tool'
    let toolInput: RecordLike | null = null
    let toolOutput: string | null = null
    let toolUseId = this.getString(msg.call_id)
    let isError = this.getBoolean(msg.is_error)

    if (toolCall) {
      const entries = Object.entries(toolCall)
      if (entries.length > 0) {
        const [key, value] = entries[0]
        toolName = key.replace(/ToolCall$/i, '') || key
        const toolData = this.asRecord(value)
        if (toolData) {
          toolInput = this.asRecord(toolData.args) || this.asRecord(toolData.input)
          if (!toolUseId) {
            const inputId = this.getString(toolInput?.toolCallId)
            toolUseId = inputId
          }
          const result = toolData.result ?? toolData.output
          if (result !== undefined) {
            toolOutput = this.stringify(result)
            if (!isError && this.asRecord(result)?.error) {
              isError = true
            }
          }
        }
      }
    }

    return { toolName, toolInput, toolOutput, toolUseId, isError }
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

  private formatToolInput(toolName: string, toolInput: RecordLike | null): string {
    if (!toolInput) return toolName
    const lower = toolName.toLowerCase()
    if ((lower.includes('read') || lower.includes('ls')) && toolInput.path) {
      return String(toolInput.path)
    }
    if ((lower.includes('write') || lower.includes('edit')) && toolInput.filePath) {
      return String(toolInput.filePath)
    }
    if (lower.includes('command') && toolInput.command) {
      return `$ ${String(toolInput.command)}`
    }
    return this.stringify(toolInput)
  }

  private extractMessageText(msg: RecordLike): string | null {
    const message = this.asRecord(msg.message)
    if (message) {
      const content = message.content
      if (Array.isArray(content)) {
        const parts = content.map((item) => this.extractContentItemText(item as RecordLike)).filter(Boolean)
        const text = parts.join('')
        return text.trim() ? text : null
      }
      const text = this.getString(message.content) || this.getString(message.text)
      if (text) return text
    }
    const content = this.getString(msg.content)
    if (content) return content
    return null
  }

  private extractContentItemText(item: RecordLike): string | null {
    const type = this.getString(item.type)
    if (type === 'text' && typeof item.text === 'string') return item.text
    const content = this.getString(item.content) || this.getString(item.text)
    return content || null
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
