import { useState, useEffect, useCallback, useImperativeHandle, useRef, forwardRef, useMemo } from 'react'
import { NormalizedLogView } from './NormalizedLogView'
import { useLogStream } from '@/hooks/useLogStream'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square } from 'lucide-react'
import type { LogMsg } from '@/hooks/useLogStream'
import type { NormalizedEntry, NormalizedEntryType } from './NormalizedLogView'

type RecordLike = Record<string, unknown>

function toSnakeCase(value: string): string {
  return value
    .replace(/ToolCall$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

function getBoolean(value: unknown): boolean {
  return value === true
}

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
}

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractMessageText(msg: RecordLike): string | null {
  const message = asRecord(msg.message)
  if (message) {
    const content = message.content
    if (Array.isArray(content)) {
      const parts = content
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as RecordLike
            return getString(record.text) || getString(record.content) || ''
          }
          return ''
        })
        .filter(Boolean)
      const text = parts.join('')
      return text.trim() ? text : null
    }
    const text = getString(message.content) || getString(message.text)
    if (text) return text
  }
  const content = getString(msg.content)
  if (content) return content
  return null
}

function resolveTimestamp(msg: RecordLike, fallback?: number): number {
  const tsMs = getNumber(msg.timestamp_ms)
  if (tsMs !== undefined) return tsMs
  const ts = getNumber(msg.timestamp)
  if (ts !== undefined) return ts
  return fallback ?? Date.now()
}

function makeId(base: string, suffix: string | number): string {
  return `${base}-${suffix}`
}

function stringifyContent(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyContent(item))
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join('') : undefined
  }
  if (typeof value === 'object') {
    const record = value as RecordLike
    const text = getString(record.text) || getString(record.content) || getString(record.message)
    if (text) return text
    const nested = record.error ?? record.warning
    const nestedText = getString(nested) || (isRecord(nested) ? getString(nested.message) : undefined)
    if (nestedText) return nestedText
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function createEntry(
  type: NormalizedEntryType,
  content: string,
  timestamp: number,
  id: string,
  metadata?: NormalizedEntry['metadata']
): NormalizedEntry {
  return {
    id,
    type,
    timestamp,
    content,
    metadata
  }
}

function resolveToolEntryType(toolName: string): NormalizedEntryType {
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

function formatToolInput(toolName: string, toolInput: RecordLike | null): string {
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
  return stringify(toolInput)
}

function extractExitCode(output: string): number | undefined {
  const match = output.match(/\[Process exited with code (\d+)\]/)
  return match ? Number.parseInt(match[1], 10) : undefined
}

function parseClaudeToolUse(
  toolName: string,
  toolInput: RecordLike | undefined,
  toolUseId: string | undefined,
  timestamp: number,
  idBase: string
): NormalizedEntry {
  let entryType: NormalizedEntryType = 'tool_use'
  if (toolName === 'Bash' || toolName === 'execute') {
    entryType = 'command_run'
  } else if (toolName === 'Edit' || toolName === 'Write') {
    entryType = 'file_edit'
  } else if (toolName === 'Read') {
    entryType = 'file_read'
  }

  let content = ''
  if (toolInput) {
    if (toolName === 'Bash' && toolInput.command) {
      content = `$ ${String(toolInput.command)}`
    } else if (
      (toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') &&
      toolInput.file_path
    ) {
      content = String(toolInput.file_path)
    } else {
      content = JSON.stringify(toolInput, null, 2)
    }
  }

  return {
    id: idBase,
    type: entryType,
    timestamp,
    content,
    metadata: {
      toolName,
      toolInput,
      toolUseId,
      status: 'pending'
    }
  }
}

function parseClaudeAssistantMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | NormalizedEntry[] | null {
  const entries: NormalizedEntry[] = []
  const message = asRecord(msg.message)
  const content = message?.content

  if (Array.isArray(content)) {
    content.forEach((item, index) => {
      if (!isRecord(item)) return
      const itemType = getString(item.type)
      if (itemType === 'text' && getString(item.text) && item.text !== '(no content)') {
        entries.push(
          createEntry(
            'assistant_message',
            String(item.text),
            timestamp,
            makeId(idBase, `text-${index}`)
          )
        )
      } else if (itemType === 'tool_use' && getString(item.name)) {
        const toolInput = asRecord(item.input) || undefined
        entries.push(
          parseClaudeToolUse(
            String(item.name),
            toolInput ?? undefined,
            getString(item.id),
            timestamp,
            makeId(idBase, `tool-${index}`)
          )
        )
      }
    })
  } else if (getString(msg.content)) {
    entries.push(
      createEntry('assistant_message', String(msg.content), timestamp, makeId(idBase, 'text'))
    )
  }

  if (entries.length === 0) return null
  return entries.length === 1 ? entries[0] : entries
}

function parseClaudeUserMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const toolUseResult = asRecord(msg.tool_use_result)
  if (toolUseResult) {
    const stdout = getString(toolUseResult.stdout) || ''
    const stderr = getString(toolUseResult.stderr) || ''
    const content = stderr ? `${stdout}\n${stderr}` : stdout
    if (content.trim()) {
      return createEntry('tool_result', content.trim(), timestamp, makeId(idBase, 'tool-result'))
    }
  }

  const message = asRecord(msg.message)
  const content = message?.content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!isRecord(item)) continue
      const itemType = getString(item.type)
      if (itemType === 'tool_result' && getString(item.content)) {
        return {
          id: makeId(idBase, 'tool-result'),
          type: 'tool_result',
          timestamp,
          content: String(item.content),
          metadata: {
            toolUseId: getString(item.tool_use_id),
            status: getBoolean(item.is_error) ? 'failed' : 'success'
          }
        }
      }
    }
  }

  return null
}

function parseClaudeSystemMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const subtype = getString(msg.subtype)
  let content = ''

  if (subtype === 'init') {
    const model = getString(msg.model) || 'unknown'
    content = `System initialized with model: ${model}`
  } else if (getString(msg.content)) {
    content = String(msg.content)
  } else if (subtype) {
    content = `System: ${subtype}`
  }

  if (!content) return null
  return createEntry('system_message', content, timestamp, makeId(idBase, 'system'))
}

function parseClaudeResultMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const durationMs = getNumber(msg.duration_ms)
  const totalCost = getNumber(msg.total_cost_usd)
  const status = getString(msg.subtype) === 'success' ? '✓' : '✗'
  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : ''
  const cost = totalCost ? `$${totalCost.toFixed(4)}` : ''
  const content = `${status} Completed ${duration ? `in ${duration}` : ''} ${cost ? `(${cost})` : ''}`.trim()
  return createEntry('system_message', content, timestamp, makeId(idBase, 'result'))
}

function parseClaudeCodeLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)

    switch (type) {
      case 'assistant':
        return parseClaudeAssistantMessage(msg, timestamp, idBase)
      case 'user':
        return parseClaudeUserMessage(msg, timestamp, idBase)
      case 'system':
        return parseClaudeSystemMessage(msg, timestamp, idBase)
      case 'result':
        return parseClaudeResultMessage(msg, timestamp, idBase)
      case 'tool_use': {
        const toolName = getString(msg.name) || 'unknown'
        const toolInput = asRecord(msg.input) || undefined
        return parseClaudeToolUse(
          toolName,
          toolInput ?? undefined,
          getString(msg.tool_use_id),
          timestamp,
          makeId(idBase, 'tool-use')
        )
      }
      case 'tool_result': {
        const output = getString(msg.output) || ''
        return {
          id: makeId(idBase, 'tool-result'),
          type: 'tool_result',
          timestamp,
          content: output,
          metadata: {
            toolUseId: getString(msg.tool_use_id),
            toolOutput: output,
            exitCode: extractExitCode(output),
            status: getBoolean(msg.is_error) ? 'failed' : 'success'
          }
        }
      }
      case 'control_response':
        return createEntry('system_message', 'Session initialized', timestamp, makeId(idBase, 'control'))
      default:
        return null
    }
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, makeId(idBase, 'raw'))
  }
}

function parseCursorToolCall(
  msg: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const subtype = getString(msg.subtype)?.toLowerCase()
  const toolCall = asRecord(msg.tool_call) || asRecord(msg.toolCall)
  let toolName = 'tool'
  let toolInput: RecordLike | null = null
  let toolOutput: string | null = null
  let toolUseId = getString(msg.call_id)
  let isError = getBoolean(msg.is_error)

  if (toolCall) {
    const entries = Object.entries(toolCall)
    if (entries.length > 0) {
      const [key, value] = entries[0]
      toolName = toSnakeCase(key) || key
      const toolData = asRecord(value)
      if (toolData) {
        toolInput = asRecord(toolData.args) || asRecord(toolData.input)
        if (!toolUseId) {
          const inputId = getString(toolInput?.toolCallId)
          toolUseId = inputId
        }
        const result = toolData.result ?? toolData.output
        if (result !== undefined) {
          toolOutput = stringify(result)
          if (!isError && asRecord(result)?.error) {
            isError = true
          }
        }
      }
    }
  }

  const entryType = resolveToolEntryType(toolName)

  if (subtype === 'completed') {
    const content = toolOutput ?? ''
    return createEntry('tool_result', content, timestamp, `${idBase}-tool-result`, {
      toolUseId,
      toolName,
      toolOutput: content,
      status: isError ? 'failed' : 'success'
    })
  }

  return createEntry(entryType, formatToolInput(toolName, toolInput), timestamp, `${idBase}-tool-use`, {
    toolName,
    toolInput: toolInput ?? undefined,
    toolUseId,
    status: subtype === 'started' ? 'running' : 'pending'
  })
}

function parseCursorAgentLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)?.toLowerCase()

    if (type === 'assistant') {
      const content = extractMessageText(msg)
      return content ? createEntry('assistant_message', content, timestamp, `${idBase}-assistant`) : null
    }

    if (type === 'user') {
      const content = extractMessageText(msg)
      return content ? createEntry('user_message', content, timestamp, `${idBase}-user`) : null
    }

    if (type === 'system') {
      const subtype = getString(msg.subtype)
      if (subtype === 'init') {
        const model = getString(msg.model) || 'unknown'
        return createEntry(
          'system_message',
          `System initialized with model: ${model}`,
          timestamp,
          `${idBase}-system`
        )
      }
      const content = getString(msg.content) || (subtype ? `System: ${subtype}` : '')
      return content ? createEntry('system_message', content, timestamp, `${idBase}-system`) : null
    }

    if (type === 'tool_call') {
      return parseCursorToolCall(msg, timestamp, idBase)
    }

    if (type === 'result') {
      const resultText = getString(msg.result)
      if (resultText) {
        return createEntry('assistant_message', resultText, timestamp, `${idBase}-result`, {
          isResult: true
        })
      }
      return createEntry('system_message', 'Completed', timestamp, `${idBase}-result`, {
        isResult: true
      })
    }

    if (type === 'error' || getBoolean(msg.is_error)) {
      const content = getString(msg.error) || getString(msg.message) || 'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    const fallback = extractMessageText(msg) || getString(msg.content) || getString(msg.message)
    if (fallback) {
      return createEntry('system_message', fallback, timestamp, `${idBase}-system`)
    }
    return null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, `${idBase}-raw`)
  }
}

function extractContent(msg: RecordLike | undefined): string | null {
  if (!msg) return null
  const direct = getString(msg.content) || getString(msg.text) || getString(msg.message)
  if (direct) return direct
  const message = asRecord(msg.message)
  if (message) {
    const content = message.content
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as RecordLike
            return getString(record.text) || getString(record.content) || ''
          }
          return ''
        })
        .join('')
      return text.trim() ? text : null
    }
    const nested = getString(message.content) || getString(message.text)
    if (nested) return nested
  }
  return null
}

function extractCodexContent(msg: RecordLike): string | undefined {
  const direct = pickCodexContent(msg)
  if (direct) return direct

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = pickCodexContent(params)
    if (fromParams) return fromParams
    const paramsEvent = asRecord(params.event)
    if (paramsEvent) {
      const fromEvent = pickCodexContent(paramsEvent)
      if (fromEvent) return fromEvent
    }
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = pickCodexContent(result)
    if (fromResult) return fromResult
  }

  return undefined
}

function pickCodexContent(record: RecordLike): string | undefined {
  const direct = stringifyContent(record.message ?? record.text ?? record.delta ?? record.content)
  if (direct) return direct
  const errorText = stringifyContent(record.error)
  if (errorText) return errorText
  const warningText = stringifyContent(record.warning)
  if (warningText) return warningText
  return undefined
}

function formatTypeLabel(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatCommand(command: unknown): string | undefined {
  if (Array.isArray(command)) {
    return command.map((part) => String(part)).join(' ')
  }
  if (typeof command === 'string') return command
  return undefined
}

function formatPatchApplyBegin(msg: RecordLike): string {
  const changes = asRecord(msg.changes)
  const fileCount = changes ? Object.keys(changes).length : 0
  const suffix = fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''
  return `Applying patch${suffix}`
}

function formatPatchApplyEnd(msg: RecordLike): string {
  const success = msg.success === true
  const detail = getString(msg.stdout) || getString(msg.stderr)
  if (detail) {
    return success ? `Patch applied: ${detail}` : `Patch failed: ${detail}`
  }
  return success ? 'Patch applied' : 'Patch failed'
}

function formatThreadStarted(msg: RecordLike): string {
  const threadId = getString(msg.thread_id) || getString(msg.threadId)
  return threadId ? `Thread started: ${threadId}` : 'Thread started'
}

function formatTurnCompleted(msg: RecordLike): string {
  const usage = asRecord(msg.usage)
  if (!usage) return 'Turn completed'
  const inputTokens = getNumber(usage.input_tokens)
  const cachedInputTokens = getNumber(usage.cached_input_tokens)
  const outputTokens = getNumber(usage.output_tokens)
  const parts = [
    inputTokens !== undefined ? `in ${inputTokens}` : null,
    cachedInputTokens !== undefined ? `cached ${cachedInputTokens}` : null,
    outputTokens !== undefined ? `out ${outputTokens}` : null
  ].filter(Boolean)
  if (parts.length === 0) return 'Turn completed'
  return `Turn completed (${parts.join(', ')})`
}

function createCodexCommandBegin(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const command = formatCommand(msg.command)
  const cwd = getString(msg.cwd)
  if (!command) return null
  return {
    id: idBase,
    type: 'command_run',
    timestamp,
    content: command,
    metadata: {
      toolName: 'execute',
      toolInput: { command, cwd },
      toolUseId: callId,
      status: 'running'
    }
  }
}

function createCodexCommandEnd(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const exitCode = getNumber(msg.exit_code)
  const output =
    getString(msg.aggregated_output) ||
    getString(msg.formatted_output) ||
    [getString(msg.stdout), getString(msg.stderr)].filter(Boolean).join('\n')
  if (!output && exitCode === undefined) return null
  return {
    id: idBase,
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

function createCodexCommandEntry(
  item: RecordLike,
  timestamp: number,
  flags: { isStarted: boolean; isCompleted: boolean },
  idBase: string
): NormalizedEntry | null {
  const command = getString(item.command) || getString(item.cmd) || getString(item.command_text)
  const toolUseId = getString(item.id) || getString(item.command_id)
  const status = getString(item.status)?.toLowerCase()
  const exitCode = getNumber(item.exit_code)
  const output = stringifyContent(item.aggregated_output) || stringifyContent(item.output) || ''

  if (!command && !output && exitCode === undefined) return null

  const isStarted = flags.isStarted || status === 'in_progress' || status === 'running'
  const isCompleted = flags.isCompleted || status === 'completed' || exitCode !== undefined

  if (isStarted) {
    return {
      id: idBase,
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
      id: idBase,
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

function createCodexToolUseFromItem(
  item: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const toolCall = asRecord(item.tool_call)
  const toolName = getString(item.tool_name) || getString(item.name) || getString(toolCall?.name)
  const toolInput = asRecord(item.input) || asRecord(toolCall?.input)
  const toolUseId =
    getString(item.tool_call_id) ||
    getString(item.id) ||
    getString(toolCall?.id)

  if (!toolName && !toolInput) return null

  return {
    id: idBase,
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

function extractCodexItem(msg: RecordLike): RecordLike | null {
  const direct = asRecord(msg.item)
  if (direct) return direct
  const params = asRecord(msg.params)
  if (params) {
    const nested = asRecord(params.item)
    if (nested) return nested
  }
  const result = asRecord(msg.result)
  if (result) {
    const nested = asRecord(result.item)
    if (nested) return nested
  }
  return null
}

function parseCodexItemEvent(
  msg: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string
): NormalizedEntry | null {
  const item = extractCodexItem(msg)
  if (!item) return null

  const rawItemType = getString(item.type) || getString(item.kind)
  const itemType = rawItemType ? rawItemType.toLowerCase() : undefined
  const isStarted = normalizedType?.endsWith('_started') ?? false
  const isCompleted = normalizedType?.endsWith('_completed') ?? false

  if (itemType && itemType.includes('reasoning')) {
    return null
  }

  if (itemType && (itemType.includes('command') || itemType.includes('exec'))) {
    return createCodexCommandEntry(item, timestamp, { isStarted, isCompleted }, idBase)
  }

  if (itemType && itemType.includes('tool')) {
    return createCodexToolUseFromItem(item, timestamp, idBase)
  }

  const text = stringifyContent(item.text ?? item.content ?? item.message ?? item.output ?? item.result)
  if (!text) return null

  if (itemType && (itemType.includes('agent') || itemType.includes('assistant'))) {
    return createEntry('assistant_message', text, timestamp, idBase)
  }

  if (itemType && itemType.includes('user')) {
    return createEntry('user_message', text, timestamp, idBase)
  }

  return createEntry('system_message', text, timestamp, idBase)
}

function parseCodexEventArrayFrom(
  record: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined
): NormalizedEntry[] | null {
  const candidates = [record.events, record.initial_messages, record.messages]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const entries: NormalizedEntry[] = []
    candidate.forEach((item, index) => {
      if (!isRecord(item)) return
      const parsed = parseCodexMessage(
        item,
        makeId(idBase, `evt-${index}`),
        fallbackTimestamp
      )
      if (parsed) {
        if (Array.isArray(parsed)) {
          entries.push(...parsed)
        } else {
          entries.push(parsed)
        }
      }
    })
    if (entries.length > 0) return entries
  }
  return null
}

function parseCodexMessage(
  msg: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined
): NormalizedEntry | NormalizedEntry[] | null {
  const nested = parseCodexEventArrayFrom(msg, idBase, fallbackTimestamp)
  if (nested) return nested

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = parseCodexEventArrayFrom(params, makeId(idBase, 'params'), fallbackTimestamp)
    if (fromParams) return fromParams
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = parseCodexEventArrayFrom(result, makeId(idBase, 'result'), fallbackTimestamp)
    if (fromResult) return fromResult
  }

  const timestamp = fallbackTimestamp ?? Date.now()
  const rawType = getString(msg.type) || getString(msg.event) || getString(msg.method)
  const normalizedType = rawType ? rawType.toLowerCase().replace(/\./g, '_') : undefined
  const content = extractCodexContent(msg)

  if (normalizedType) {
    if (normalizedType.includes('reasoning')) {
      return null
    }

    if (normalizedType === 'exec_command_begin') {
      return createCodexCommandBegin(msg, timestamp, makeId(idBase, 'exec-begin'))
    }

    if (normalizedType === 'exec_command_end') {
      return createCodexCommandEnd(msg, timestamp, makeId(idBase, 'exec-end'))
    }

    if (normalizedType === 'patch_apply_begin') {
      return createEntry('system_message', formatPatchApplyBegin(msg), timestamp, makeId(idBase, 'patch-begin'))
    }

    if (normalizedType === 'patch_apply_end') {
      return createEntry('system_message', formatPatchApplyEnd(msg), timestamp, makeId(idBase, 'patch-end'))
    }

    if (normalizedType.startsWith('item_')) {
      const itemEntry = parseCodexItemEvent(msg, timestamp, normalizedType, makeId(idBase, 'item'))
      if (itemEntry) return itemEntry
      return null
    }

    if (normalizedType === 'thread_started') {
      return createEntry('system_message', formatThreadStarted(msg), timestamp, makeId(idBase, 'thread'))
    }

    if (normalizedType === 'turn_started') {
      return createEntry('system_message', 'Turn started', timestamp, makeId(idBase, 'turn-start'))
    }

    if (normalizedType === 'turn_completed') {
      return createEntry('system_message', formatTurnCompleted(msg), timestamp, makeId(idBase, 'turn-end'))
    }

    if (
      normalizedType === 'agent_message' ||
      normalizedType === 'agent_message_delta' ||
      normalizedType === 'assistant_message' ||
      normalizedType === 'message' ||
      normalizedType === 'response'
    ) {
      if (!content) return null
      return createEntry('assistant_message', content, timestamp, makeId(idBase, 'assistant'))
    }

    if (normalizedType === 'user_message' || normalizedType === 'user') {
      if (!content) return null
      return createEntry('user_message', content, timestamp, makeId(idBase, 'user'))
    }

    if (normalizedType.includes('error')) {
      return createEntry('error', content || rawType || normalizedType, timestamp, makeId(idBase, 'error'))
    }

    if (normalizedType.includes('warning')) {
      return createEntry('system_message', content || rawType || normalizedType, timestamp, makeId(idBase, 'warning'))
    }

    if (normalizedType === 'task_started' || normalizedType === 'task_complete') {
      return createEntry(
        'system_message',
        formatTypeLabel(rawType ?? normalizedType),
        timestamp,
        makeId(idBase, 'task')
      )
    }
  }

  if (content) {
    return createEntry('system_message', content, timestamp, makeId(idBase, 'system'))
  }

  if (rawType) {
    return createEntry('system_message', rawType, timestamp, makeId(idBase, 'system'))
  }

  return null
}

function parseCodexLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as unknown
    if (!msg || typeof msg !== 'object') {
      return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
    }
    return parseCodexMessage(msg as RecordLike, idBase, fallbackTimestamp)
  } catch {
    return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
  }
}

function parseGeminiLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = fallbackTimestamp ?? Date.now()
    const role = getString(msg.role)
    const content = getString(msg.text) || getString(msg.content) || ''
    if (role === 'model' || role === 'assistant') {
      return createEntry('assistant_message', content, timestamp, makeId(idBase, 'assistant'))
    }
    if (role === 'user') {
      return createEntry('user_message', content, timestamp, makeId(idBase, 'user'))
    }
    return null
  } catch {
    return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
  }
}

function parseOpencodeLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const rawType = getString(msg.type) || getString(msg.event)
    const type = rawType?.toLowerCase()

    if (type === 'assistant' || type === 'assistant_message') {
      const content = extractContent(msg)
      return content ? createEntry('assistant_message', content, timestamp, `${idBase}-assistant`) : null
    }

    if (type === 'user' || type === 'user_message') {
      const content = extractContent(msg)
      return content ? createEntry('user_message', content, timestamp, `${idBase}-user`) : null
    }

    if (type === 'tool_use' || type === 'tool_call' || type === 'tool') {
      const toolName =
        getString(msg.tool) ||
        getString(msg.name) ||
        getString(msg.tool_name) ||
        'tool'
      const toolInput = asRecord(msg.input) || asRecord(msg.args)
      const toolUseId = getString(msg.tool_use_id) || getString(msg.call_id) || getString(msg.id)
      const entryType = resolveToolEntryType(toolName)
      return createEntry(entryType, toolInput ? stringify(toolInput) : toolName, timestamp, `${idBase}-tool-use`, {
        toolName: toSnakeCase(toolName),
        toolInput: toolInput ?? undefined,
        toolUseId,
        status: 'running'
      })
    }

    if (type === 'tool_result' || type === 'tool_output') {
      const output = extractContent(msg) || stringify(msg.result)
      const toolUseId = getString(msg.tool_use_id) || getString(msg.call_id) || getString(msg.id)
      return createEntry('tool_result', output, timestamp, `${idBase}-tool-result`, {
        toolUseId,
        status: getBoolean(msg.is_error) ? 'failed' : 'success'
      })
    }

    if (type === 'error') {
      const content = extractContent(msg) || rawType || 'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    if (type === 'sdk_event') {
      const event = asRecord(msg.event)
      if (event) {
        const eventType = getString(event.type) || getString(event.name)
        const eventContent = extractContent(event) || eventType || 'Event'
        if (eventType?.toLowerCase().includes('error')) {
          return createEntry('error', eventContent, timestamp, `${idBase}-error`)
        }
        return createEntry('system_message', eventContent, timestamp, `${idBase}-system`)
      }
    }

    const content = extractContent(msg)
    return content ? createEntry('system_message', content, timestamp, `${idBase}-system`) : null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, `${idBase}-raw`)
  }
}

type RawParser = (
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
) => NormalizedEntry | NormalizedEntry[] | null

function getParserForTool(toolId: string): RawParser | null {
  switch (toolId) {
    case 'cursor-agent':
      return parseCursorAgentLine
    case 'opencode':
      return parseOpencodeLine
    case 'claude-code':
      return parseClaudeCodeLine
    case 'codex':
      return parseCodexLine
    case 'gemini-cli':
      return parseGeminiLine
    default:
      return null
  }
}

function parseAgentRawLogs(rawLogs: LogMsg[], toolId: string): NormalizedEntry[] {
  const parser = getParserForTool(toolId)
  if (!parser) return []
  const entries: NormalizedEntry[] = []
  let sequence = 0

  rawLogs.forEach((msg, msgIndex) => {
    if (msg.type === 'stderr') {
      const content = msg.content?.trim()
      if (!content) return
      const idBase = msg.id ?? `stderr-${msgIndex}`
      entries.push(
        createEntry(
          'error',
          content,
          msg.timestamp ?? Date.now(),
          `${idBase}-stderr`,
          { sequence }
        )
      )
      sequence += 1
      return
    }

    if (msg.type !== 'stdout') return
    if (!msg.content) return

    const lines = msg.content.split('\n')
    const idBase = msg.id ?? `stdout-${msgIndex}`
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim()
      if (!trimmed) return
      const lineBase = `${idBase}-${lineIndex}`
      const parsed = parser(trimmed, msg.timestamp, lineBase)
      if (!parsed) return
      const parsedEntries = Array.isArray(parsed) ? parsed : [parsed]
      parsedEntries.forEach((entry) => {
        entries.push({
          ...entry,
          metadata: {
            ...(entry.metadata ?? {}),
            sequence
          }
        })
        sequence += 1
      })
    })
  })

  if (toolId === 'cursor-agent') {
    const hasNonResultAssistant = entries.some(
      (entry) => entry.type === 'assistant_message' && !entry.metadata?.isResult
    )
    if (hasNonResultAssistant) {
      return entries.filter((entry) => !entry.metadata?.isResult)
    }
  }

  return entries
}

interface CLISessionProps {
  sessionId: string
  taskId?: string | null
  toolId: string
  configId?: string | null
  workdir: string
  prompt?: string
  className?: string
  compact?: boolean
  allowStart?: boolean
  allowStop?: boolean
  onStatusChange?: (status: CLISessionStatus) => void
}

type CLISessionStatus = 'idle' | 'running' | 'stopped' | 'error'

export interface CLISessionHandle {
  start: (promptOverride?: string) => Promise<void>
  stop: () => Promise<void>
  sendInput: (input: string) => Promise<void>
}

export const CLISession = forwardRef<CLISessionHandle, CLISessionProps>(function CLISession({
  sessionId,
  taskId,
  toolId,
  configId,
  workdir,
  prompt,
  className,
  compact = false,
  allowStart = true,
  allowStop = true,
  onStatusChange
}: CLISessionProps, ref) {
  const [status, setStatus] = useState<CLISessionStatus>('idle')

  const { normalizedLogs, rawLogs, resubscribe } = useLogStream(sessionId, taskId, {
    source: 'session'
  })
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)
  const lastScrollTopRef = useRef(0)

  const handleClose = useCallback(
    (data: { sessionId: string; code: number; forcedStatus?: CLISessionStatus }) => {
      if (data.sessionId === sessionId) {
        if (data.forcedStatus) {
          setStatus(data.forcedStatus)
        } else {
          setStatus(data.code === 0 ? 'stopped' : 'error')
        }
      }
    },
    [sessionId]
  )

  const handleStatus = useCallback(
    (data: { sessionId: string; status: CLISessionStatus }) => {
      if (data.sessionId === sessionId) {
        setStatus(data.status)
      }
    },
    [sessionId]
  )

  const handleError = useCallback(
    (data: { sessionId: string; error: string }) => {
      if (data.sessionId === sessionId) {
        setStatus('error')
        console.error('[CLISession] Error:', data.error)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    let active = true
    const loadExistingStatus = async () => {
      if (!sessionId || !window.api?.cliSession?.getSession) return
      try {
        const existing = await window.api.cliSession.getSession(sessionId)
        if (!active) return
        if (existing?.status) {
          setStatus(existing.status as CLISessionStatus)
        }
      } catch (error) {
        console.error('[CLISession] Failed to get session status:', error)
      }
    }

    loadExistingStatus()
    return () => {
      active = false
    }
  }, [sessionId])

  useEffect(() => {
    const unsubStatus = window.api.cliSession.onStatus(handleStatus)
    const unsubClose = window.api.cliSession.onClose(handleClose)
    const unsubError = window.api.cliSession.onError(handleError)

    return () => {
      unsubStatus()
      unsubClose()
      unsubError()
    }
  }, [handleClose, handleError, handleStatus])

  const startSession = useCallback(async (promptOverride?: string) => {
    try {
      const nextPrompt = promptOverride ?? prompt
      setStatus('running')
      await window.api.cliSession.startSession(sessionId, toolId, workdir, {
        prompt: nextPrompt,
        taskId: taskId ?? undefined,
        configId: configId ?? undefined
      })
      await resubscribe({ clear: false })
    } catch (error) {
      setStatus('error')
      console.error('[CLISession] Failed to start session:', error)
    }
  }, [prompt, resubscribe, sessionId, taskId, configId, toolId, workdir])

  const stopSession = useCallback(async () => {
    try {
      await window.api.cliSession.stopSession(sessionId)
      setStatus('stopped')
    } catch (error) {
      console.error('Failed to stop CLI session:', error)
    }
  }, [sessionId])

  const sendInput = useCallback(async (input: string) => {
    if (!input.trim()) return
    try {
      setStatus('running')
      await window.api.cliSession.sendInput(sessionId, input)
    } catch (error) {
      console.error('Failed to send CLI input:', error)
    }
  }, [sessionId])

  useImperativeHandle(ref, () => ({
    start: startSession,
    stop: stopSession,
    sendInput
  }), [sendInput, startSession, stopSession])

  useEffect(() => {
    onStatusChange?.(status)
  }, [onStatusChange, status])

  const checkScrollPosition = useCallback(() => {
    const container = logContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (scrollTop < lastScrollTopRef.current && distanceFromBottom > 120) {
      userScrolledUpRef.current = true
    }

    if (distanceFromBottom < 60) {
      userScrolledUpRef.current = false
    }

    lastScrollTopRef.current = scrollTop
  }, [])

  useEffect(() => {
    if (status === 'running') {
      userScrolledUpRef.current = false
    }
  }, [status])

  const rawEntries = useMemo(() => {
    if (rawLogs.length === 0) return []
    return rawLogs
      .filter((msg) => msg.type === 'stdout' || msg.type === 'stderr')
      .map((msg, index) =>
        createEntry(
          msg.type === 'stderr' ? 'error' : 'system_message',
          msg.content ?? '',
          msg.timestamp ?? Date.now(),
          msg.id || `${msg.type}-${msg.timestamp ?? index}`
        )
      )
  }, [rawLogs])

  const parsedEntries = useMemo(() => {
    if (rawLogs.length === 0) return []
    return parseAgentRawLogs(rawLogs, toolId)
  }, [rawLogs, toolId])

  const displayLogs = useMemo(() => {
    const base = parsedEntries.length > 0 ? parsedEntries : rawEntries.length > 0 ? rawEntries : normalizedLogs
    if (base.length === 0) return base
    const hasSequence = base.some((entry) => typeof entry.metadata?.sequence === 'number')
    if (!hasSequence) return base
    return [...base].sort((a, b) => {
      const aSeq = typeof a.metadata?.sequence === 'number' ? a.metadata.sequence : 0
      const bSeq = typeof b.metadata?.sequence === 'number' ? b.metadata.sequence : 0
      return aSeq - bSeq
    })
  }, [normalizedLogs, parsedEntries, rawEntries])

  const rawText = useMemo(() => {
    if (rawLogs.length === 0) return ''
    return rawLogs
      .filter((msg) => msg.type === 'stdout' || msg.type === 'stderr')
      .map((msg) => msg.content ?? '')
      .join('')
  }, [rawLogs])

  const showRawText = displayLogs.length === 0 && rawText.trim().length > 0

  useEffect(() => {
    if (userScrolledUpRef.current) return
    const container = logContainerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    })
  }, [displayLogs.length])

  const showStartButton = allowStart && status !== 'running'
  const showStopButton = allowStop && status === 'running'
  const showControls = showStartButton || showStopButton
  const showHeader = compact ? status !== 'idle' || showControls : showControls
  const hasLogs = displayLogs.length > 0

  return (
    <div className={cn('flex flex-col', !compact && 'gap-3', className)}>
      {!compact && showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                status === 'running' && 'bg-green-500 animate-pulse',
                status === 'stopped' && 'bg-zinc-500',
                status === 'error' && 'bg-red-500',
                status === 'idle' && 'bg-zinc-400'
              )}
            />
            <span className="text-sm text-muted-foreground">
              {status === 'running' && 'Running'}
              {status === 'stopped' && 'Stopped'}
              {status === 'error' && 'Error'}
              {status === 'idle' && 'Ready'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showStartButton ? (
              <Button size="sm" variant="outline" onClick={() => startSession()}>
                <Play className="w-4 h-4" />
                Start
              </Button>
            ) : showStopButton ? (
              <Button size="sm" variant="outline" onClick={stopSession}>
                <Square className="w-4 h-4" />
                Stop
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div
        ref={logContainerRef}
        onScroll={checkScrollPosition}
        className={cn(
          'rounded-lg overflow-auto relative',
          compact ? 'flex-1 min-h-0' : 'h-80',
          hasLogs ? 'bg-muted/50 p-2' : 'bg-transparent p-0'
        )}
      >
        {compact && showHeader && (
          <div className="sticky top-0 z-10 flex items-center justify-between mb-2 pb-2 border-b border-border/50 bg-muted/50">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  status === 'running' && 'bg-emerald-500 animate-pulse',
                  status === 'stopped' && 'bg-slate-400',
                  status === 'error' && 'bg-red-500',
                  status === 'idle' && 'bg-slate-300'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {status === 'running' && 'Running'}
                {status === 'stopped' && 'Stopped'}
                {status === 'error' && 'Error'}
                {status === 'idle' && 'Ready'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {showStartButton ? (
                <Button size="sm" variant="ghost" onClick={() => startSession()} className="h-7 px-2">
                  <Play className="w-4 h-4" />
                  Start
                </Button>
              ) : showStopButton ? (
                <Button size="sm" variant="ghost" onClick={stopSession} className="h-7 px-2">
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              ) : null}
            </div>
          </div>
        )}
          {showRawText ? (
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words px-3 py-2">
              {rawText}
            </pre>
          ) : (
            <NormalizedLogView entries={displayLogs} />
          )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
})
