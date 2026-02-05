import { nanoid } from 'nanoid'
import { NormalizedEntry } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

type RecordLike = Record<string, unknown>

/**
 * Codex 日志标准化适配器
 */
export class CodexNormalizer implements LogNormalizerAdapter {
  toolId = 'codex'

  parse(line: string): NormalizedEntry | NormalizedEntry[] | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
      const msg = JSON.parse(trimmed) as unknown
      if (!msg || typeof msg !== 'object') {
        return this.createSystemMessage(trimmed)
      }
      return this.parseMessage(msg as RecordLike)
    } catch {
      return this.createSystemMessage(trimmed)
    }
  }

  private parseMessage(msg: RecordLike): NormalizedEntry | NormalizedEntry[] | null {
    const nested = this.parseEventArray(msg)
    if (nested) return nested

    const timestamp = Date.now()
    const rawType = this.getString(msg.type) || this.getString(msg.event) || this.getString(msg.method)
    const normalizedType = rawType ? rawType.toLowerCase().replace(/\./g, '_') : undefined
    const content = this.extractContent(msg)

    if (normalizedType) {
      if (normalizedType.includes('reasoning')) {
        // Avoid surfacing chain-of-thought style events.
        return null
      }

      if (normalizedType === 'exec_command_begin') {
        return this.createExecCommandBegin(msg, timestamp)
      }

      if (normalizedType === 'exec_command_end') {
        return this.createExecCommandEnd(msg, timestamp)
      }

      if (normalizedType === 'patch_apply_begin') {
        return this.createSystemMessage(this.formatPatchApplyBegin(msg), timestamp)
      }

      if (normalizedType === 'patch_apply_end') {
        return this.createSystemMessage(this.formatPatchApplyEnd(msg), timestamp)
      }

      if (normalizedType.startsWith('item_')) {
        const itemEntry = this.parseItemEvent(msg, timestamp, normalizedType)
        if (itemEntry) return itemEntry
        return null
      }

      if (normalizedType === 'thread_started') {
        return this.createSystemMessage(this.formatThreadStarted(msg), timestamp)
      }

      if (normalizedType === 'turn_started') {
        return this.createSystemMessage('Turn started', timestamp)
      }

      if (normalizedType === 'turn_completed') {
        return this.createSystemMessage(this.formatTurnCompleted(msg), timestamp)
      }

      if (
        normalizedType === 'agent_message' ||
        normalizedType === 'agent_message_delta' ||
        normalizedType === 'assistant_message' ||
        normalizedType === 'message' ||
        normalizedType === 'response'
      ) {
        if (!content) return null
        return this.createEntry('assistant_message', content, timestamp)
      }

      if (normalizedType === 'user_message' || normalizedType === 'user') {
        if (!content) return null
        return this.createEntry('user_message', content, timestamp)
      }

      if (normalizedType.includes('error')) {
        return this.createEntry('error', content || rawType || normalizedType, timestamp)
      }

      if (normalizedType.includes('warning')) {
        return this.createEntry('system_message', content || rawType || normalizedType, timestamp)
      }

      if (
        normalizedType === 'task_started' ||
        normalizedType === 'task_complete'
      ) {
        return this.createEntry(
          'system_message',
          this.formatTypeLabel(rawType ?? normalizedType),
          timestamp
        )
      }
    }

    if (content) {
      return this.createEntry('system_message', content, timestamp)
    }

    if (rawType) {
      return this.createEntry('system_message', rawType, timestamp)
    }

    return null
  }

  private parseItemEvent(
    msg: RecordLike,
    timestamp: number,
    normalizedType?: string
  ): NormalizedEntry | NormalizedEntry[] | null {
    const item = this.extractItem(msg)
    if (!item) return null

    const rawItemType = this.getString(item.type) || this.getString(item.kind)
    const itemType = rawItemType ? rawItemType.toLowerCase() : undefined
    const isStarted = normalizedType?.endsWith('_started') ?? false
    const isCompleted = normalizedType?.endsWith('_completed') ?? false

    if (itemType && itemType.includes('reasoning')) {
      return null
    }

    if (itemType && (itemType.includes('command') || itemType.includes('exec'))) {
      const commandEntry = this.createCommandExecutionEntry(item, timestamp, { isStarted, isCompleted })
      if (commandEntry) return commandEntry
    }

    if (itemType && itemType.includes('tool')) {
      const toolEntry = this.createToolUseFromItem(item, timestamp)
      if (toolEntry) return toolEntry
    }

    const text = this.stringifyContent(
      item.text ?? item.content ?? item.message ?? item.output ?? item.result
    )
    if (!text) return null

    if (itemType && (itemType.includes('agent') || itemType.includes('assistant'))) {
      return this.createEntry('assistant_message', text, timestamp)
    }

    if (itemType && itemType.includes('user')) {
      return this.createEntry('user_message', text, timestamp)
    }

    return this.createEntry('system_message', text, timestamp)
  }

  private createCommandExecutionEntry(
    item: RecordLike,
    timestamp: number,
    flags: { isStarted: boolean; isCompleted: boolean }
  ): NormalizedEntry | null {
    const command =
      this.getString(item.command) ||
      this.getString(item.cmd) ||
      this.getString(item.command_text)
    const toolUseId = this.getString(item.id) || this.getString(item.command_id)
    const status = this.getString(item.status)?.toLowerCase()
    const exitCode = this.getNumber(item.exit_code)
    const output = this.stringifyContent(item.aggregated_output) || this.stringifyContent(item.output) || ''

    if (!command && !output && exitCode === undefined) return null

    const isStarted = flags.isStarted || status === 'in_progress' || status === 'running'
    const isCompleted = flags.isCompleted || status === 'completed' || exitCode !== undefined

    if (isStarted) {
      return {
        id: nanoid(),
        type: 'command_run',
        timestamp,
        content: command || 'Command',
        metadata: {
          toolName: 'execute',
          toolInput: command ? { command } : undefined,
          toolUseId,
          status: 'running'
        }
      }
    }

    if (isCompleted) {
      return {
        id: nanoid(),
        type: 'tool_result',
        timestamp,
        content: output,
        metadata: {
          toolUseId,
          status: exitCode === 0 ? 'success' : 'failed',
          exitCode
        }
      }
    }

    return null
  }

  private extractItem(msg: RecordLike): RecordLike | null {
    const direct = this.asRecord(msg.item)
    if (direct) return direct
    const params = this.asRecord(msg.params)
    if (params) {
      const nested = this.asRecord(params.item)
      if (nested) return nested
    }
    return null
  }

  private createToolUseFromItem(item: RecordLike, timestamp: number): NormalizedEntry | null {
    const toolCall = this.asRecord(item.tool_call)
    const toolName =
      this.getString(item.tool_name) ||
      this.getString(item.name) ||
      this.getString(toolCall?.name)
    const toolInput = this.asRecord(item.input) || this.asRecord(toolCall?.input)
    const toolUseId =
      this.getString(item.tool_call_id) ||
      this.getString(item.id) ||
      this.getString(toolCall?.id)

    if (!toolName && !toolInput) return null

    return {
      id: nanoid(),
      type: 'tool_use',
      timestamp,
      content: toolInput ? JSON.stringify(toolInput) : toolName || 'tool',
      metadata: {
        toolName: toolName || 'tool',
        toolInput: toolInput ?? undefined,
        toolUseId
      }
    }
  }

  private formatThreadStarted(msg: RecordLike): string {
    const threadId = this.getString(msg.thread_id) || this.getString(msg.threadId)
    if (threadId) return `Thread started: ${threadId}`
    return 'Thread started'
  }

  private formatTurnCompleted(msg: RecordLike): string {
    const usage = this.asRecord(msg.usage)
    if (!usage) return 'Turn completed'
    const inputTokens = this.getNumber(usage.input_tokens)
    const cachedInputTokens = this.getNumber(usage.cached_input_tokens)
    const outputTokens = this.getNumber(usage.output_tokens)
    const parts = [
      inputTokens !== undefined ? `in ${inputTokens}` : null,
      cachedInputTokens !== undefined ? `cached ${cachedInputTokens}` : null,
      outputTokens !== undefined ? `out ${outputTokens}` : null
    ].filter(Boolean)
    if (parts.length === 0) return 'Turn completed'
    return `Turn completed (${parts.join(', ')})`
  }

  private parseEventArray(msg: RecordLike): NormalizedEntry[] | null {
    const entries = this.parseEventArrayFrom(msg)
    if (entries) return entries

    const params = this.asRecord(msg.params)
    if (params) {
      const fromParams = this.parseEventArrayFrom(params)
      if (fromParams) return fromParams
    }

    const result = this.asRecord(msg.result)
    if (result) {
      const fromResult = this.parseEventArrayFrom(result)
      if (fromResult) return fromResult
    }

    return null
  }

  private parseEventArrayFrom(record: RecordLike): NormalizedEntry[] | null {
    const candidates = [
      record.events,
      record.initial_messages,
      record.messages
    ]

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue
      const entries: NormalizedEntry[] = []
      for (const item of candidate) {
        if (!this.isRecord(item)) continue
        const parsed = this.parseMessage(item)
        if (!parsed) continue
        if (Array.isArray(parsed)) {
          entries.push(...parsed)
        } else {
          entries.push(parsed)
        }
      }
      if (entries.length > 0) return entries
    }

    return null
  }

  private createExecCommandBegin(msg: RecordLike, timestamp: number): NormalizedEntry | null {
    const callId = this.getString(msg.call_id)
    const command = this.formatCommand(msg.command)
    const cwd = this.getString(msg.cwd)
    if (!command) return null

    return {
      id: nanoid(),
      type: 'command_run',
      timestamp,
      content: command,
      metadata: {
        toolName: 'execute',
        toolInput: {
          command,
          cwd
        },
        toolUseId: callId,
        status: 'running'
      }
    }
  }

  private createExecCommandEnd(msg: RecordLike, timestamp: number): NormalizedEntry | null {
    const callId = this.getString(msg.call_id)
    const exitCode = this.getNumber(msg.exit_code)
    const output = this.extractExecCommandOutput(msg)
    if (!output && exitCode === undefined) return null

    return {
      id: nanoid(),
      type: 'tool_result',
      timestamp,
      content: output || '',
      metadata: {
        toolUseId: callId,
        status: exitCode === 0 ? 'success' : 'failed',
        exitCode
      }
    }
  }

  private extractExecCommandOutput(msg: RecordLike): string {
    const aggregated = this.getString(msg.aggregated_output)
    if (aggregated) return aggregated
    const formatted = this.getString(msg.formatted_output)
    if (formatted) return formatted
    const stdout = this.getString(msg.stdout)
    const stderr = this.getString(msg.stderr)
    return [stdout, stderr].filter(Boolean).join('\n')
  }

  private extractContent(msg: RecordLike): string | undefined {
    const direct = this.pickContent(msg)
    if (direct) return direct

    const params = this.asRecord(msg.params)
    if (params) {
      const fromParams = this.pickContent(params)
      if (fromParams) return fromParams
      const paramsEvent = this.asRecord(params.event)
      if (paramsEvent) {
        const fromEvent = this.pickContent(paramsEvent)
        if (fromEvent) return fromEvent
      }
    }

    const result = this.asRecord(msg.result)
    if (result) {
      const fromResult = this.pickContent(result)
      if (fromResult) return fromResult
    }

    return undefined
  }

  private pickContent(record: RecordLike): string | undefined {
    const direct = this.stringifyContent(record.message ?? record.text ?? record.delta ?? record.content)
    if (direct) return direct

    const error = record.error
    const errorText = this.stringifyContent(error)
    if (errorText) return errorText

    const warning = record.warning
    const warningText = this.stringifyContent(warning)
    if (warningText) return warningText

    return undefined
  }

  private formatCommand(command: unknown): string | undefined {
    if (Array.isArray(command)) {
      return command.map((part) => String(part)).join(' ')
    }
    if (typeof command === 'string') return command
    return undefined
  }

  private formatPatchApplyBegin(msg: RecordLike): string {
    const changes = this.asRecord(msg.changes)
    const fileCount = changes ? Object.keys(changes).length : 0
    const suffix = fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''
    return `Applying patch${suffix}`
  }

  private formatPatchApplyEnd(msg: RecordLike): string {
    const success = msg.success === true
    const detail = this.getString(msg.stdout) || this.getString(msg.stderr)
    if (detail) {
      return success ? `Patch applied: ${detail}` : `Patch failed: ${detail}`
    }
    return success ? 'Patch applied' : 'Patch failed'
  }

  private formatTypeLabel(type: string): string {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase())
  }

  private createEntry(type: NormalizedEntry['type'], content: string, timestamp: number): NormalizedEntry {
    return {
      id: nanoid(),
      type,
      timestamp,
      content
    }
  }

  private createSystemMessage(content: string, timestamp = Date.now()): NormalizedEntry {
    return this.createEntry('system_message', content, timestamp)
  }

  private stringifyContent(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
      const parts = value
        .map((item) => this.stringifyContent(item))
        .filter((part): part is string => Boolean(part))
      return parts.length > 0 ? parts.join('') : undefined
    }
    if (typeof value === 'object') {
      const record = value as RecordLike
      const text = this.getString(record.text) || this.getString(record.content) || this.getString(record.message)
      if (text) return text
      const nested = record.error ?? record.warning
      const nestedText = this.getString(nested) || (this.isRecord(nested) ? this.getString(nested.message) : undefined)
      if (nestedText) return nestedText
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private getNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  private isRecord(value: unknown): value is RecordLike {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  private asRecord(value: unknown): RecordLike | null {
    return this.isRecord(value) ? value : null
  }
}
