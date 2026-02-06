import { useMemo } from 'react'
import type { LogMsg } from '@/hooks/useLogStream'
import type { NormalizedEntry, NormalizedEntryType } from '../NormalizedLogView'
import { cn } from '@/lib/utils'
import { AlertCircle, Bot, MessageSquare, Terminal, User, Wrench } from 'lucide-react'

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function renderLogIcon(type: NormalizedEntryType): React.ReactNode {
  if (type === 'assistant_message') return <Bot className="size-4 text-blue-600" />
  if (type === 'user_message') return <User className="size-4 text-emerald-600" />
  if (type === 'tool_use' || type === 'command_run' || type === 'file_edit' || type === 'file_read') {
    return <Wrench className="size-4 text-violet-600" />
  }
  if (type === 'error') return <AlertCircle className="size-4 text-red-600" />
  if (type === 'tool_result') return <Terminal className="size-4 text-amber-600" />
  return <MessageSquare className="size-4 text-slate-500" />
}

function logRowTone(type: NormalizedEntryType): string {
  if (type === 'assistant_message') return 'border-blue-500/20 bg-blue-500/5'
  if (type === 'user_message') return 'border-emerald-500/20 bg-emerald-500/5'
  if (type === 'error') return 'border-red-500/20 bg-red-500/5'
  if (type === 'tool_use' || type === 'command_run' || type === 'file_edit' || type === 'file_read') {
    return 'border-violet-500/20 bg-violet-500/5'
  }
  return 'border-border/70 bg-background'
}

function entryTitle(entry: NormalizedEntry): string {
  if (entry.type === 'assistant_message') return 'Assistant'
  if (entry.type === 'user_message') return 'User'
  if (entry.type === 'error') return 'Error'
  if (entry.type === 'tool_result') return 'Tool result'
  if (entry.type === 'command_run') return 'Command'
  if (entry.type === 'file_edit') return 'File edit'
  if (entry.type === 'file_read') return 'File read'
  if (entry.type === 'tool_use') return entry.metadata?.toolName || 'Tool call'
  return 'System'
}

function CliToolLogList({ entries }: { entries: NormalizedEntry[] }): React.ReactNode {
  if (entries.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No logs yet.</div>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className={cn('rounded-md border px-3 py-2', logRowTone(entry.type))}>
          <div className="mb-1 flex items-center gap-2">
            {renderLogIcon(entry.type)}
            <span className="text-xs font-medium text-foreground">{entryTitle(entry)}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
          </div>
          <div className="whitespace-pre-wrap break-words text-sm text-foreground">{entry.content}</div>
        </div>
      ))}
    </div>
  )
}

type RecordLike = Record<string, unknown>

type RawParser = (
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
) => NormalizedEntry | NormalizedEntry[] | null

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

function normalizeEntryFromLog(entry: NormalizedEntry, msg: LogMsg, index: number): NormalizedEntry {
  const id = entry.id || msg.id || `normalized-${index}`
  const timestamp =
    typeof entry.timestamp === 'number'
      ? entry.timestamp
      : msg.timestamp ?? Date.now()
  if (id === entry.id && timestamp === entry.timestamp) return entry
  return {
    ...entry,
    id,
    timestamp
  }
}

function parseLogsWithParser(logs: LogMsg[], parser: RawParser | null): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  logs.forEach((msg, msgIndex) => {
    if (msg.type === 'normalized' && msg.entry) {
      const entry = normalizeEntryFromLog(msg.entry, msg, msgIndex)
      entries.push(entry)
      return
    }

    if (msg.type === 'finished') {
      const exitCode = msg.exit_code
      const content =
        typeof exitCode === 'number'
          ? `Process exited with code ${exitCode}`
          : 'Process finished'
      entries.push(
        createEntry(
          'system_message',
          content,
          msg.timestamp ?? Date.now(),
          msg.id ?? `finished-${msgIndex}`,
          { exitCode }
        )
      )
      return
    }

    const content = msg.content
    if (!content) return
    const trimmed = content.trim()
    if (!trimmed) return
    const timestamp = msg.timestamp ?? Date.now()
    const idBase = msg.id ?? `${msg.type}-${msgIndex}`

    if (msg.type === 'stderr') {
      entries.push(
        createEntry('error', trimmed, timestamp, `${idBase}-stderr`)
      )
      return
    }

    if (msg.type !== 'stdout') return

    const parsed = parser ? parser(trimmed, msg.timestamp, idBase) : null
    if (parsed) {
      const parsedEntries = Array.isArray(parsed) ? parsed : [parsed]
      parsedEntries.forEach((entry) => {
        entries.push(entry)
      })
      return
    }

    entries.push(
      createEntry('system_message', trimmed, timestamp, `${idBase}-stdout`)
    )
  })

  return entries
}

function parseCursorAgentLogs(logs: LogMsg[]): NormalizedEntry[] {
  const entries = parseLogsWithParser(logs, parseCursorAgentLine)
  const hasNonResultAssistant = entries.some(
    (entry) => entry.type === 'assistant_message' && !entry.metadata?.isResult
  )
  if (!hasNonResultAssistant) return entries
  return entries.filter((entry) => !entry.metadata?.isResult)
}

export function CursorAgentLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseCursorAgentLogs(logs), [logs])
  return <CliToolLogList entries={entries} />
}
