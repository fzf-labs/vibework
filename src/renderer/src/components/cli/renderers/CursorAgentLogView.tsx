import { useMemo, useState } from 'react'
import type { LogMsg } from '@/hooks/useLogStream'
import type { NormalizedEntry, NormalizedEntryType } from '../NormalizedLogView'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Terminal,
  User,
  Wrench
} from 'lucide-react'

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

function previewText(text: string, maxLines = 3, maxChars = 220): { text: string; truncated: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { text: '', truncated: false }

  const lines = trimmed.split('\n')
  const limitedLines = lines.slice(0, maxLines)
  let preview = limitedLines.join('\n')
  let truncated = lines.length > maxLines

  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars - 1)}...`
    truncated = true
  } else if (truncated) {
    preview = `${preview}...`
  }

  return { text: preview, truncated }
}

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function summarizeParsedJson(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Returned empty list'
    return `Returned ${value.length} item${value.length === 1 ? '' : 's'}`
  }

  const record = asRecord(value)
  if (record) {
    const error = getString(record.error)
    if (error) return `Error: ${error}`
    const message =
      getString(record.message) ||
      getString(record.text) ||
      getString(record.summary) ||
      getString(record.content) ||
      getString(record.output)
    if (message) return message
    const keys = Object.keys(record)
    return keys.length > 0 ? `${keys.length} fields in result` : 'Returned empty object'
  }

  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function pickToolInputValue(input: RecordLike | null): string | undefined {
  if (!input) return undefined

  const byKey =
    getString(input.command) ||
    getString(input.path) ||
    getString(input.filePath) ||
    getString(input.file_path) ||
    getString(input.pattern) ||
    getString(input.query) ||
    getString(input.glob) ||
    getString(input.url)
  if (byKey) return byKey

  const firstString = Object.values(input).find((value) => typeof value === 'string' && value.trim())
  return typeof firstString === 'string' ? firstString : undefined
}

function buildSummary(entry: NormalizedEntry): {
  summary: string
  fullContent: string
  hasHiddenContent: boolean
} {
  const content = entry.content ?? ''
  const trimmed = content.trim()
  const preview = previewText(trimmed)

  const toolInput = asRecord(entry.metadata?.toolInput)
  const toolName = getString(entry.metadata?.toolName)
  const command = getString(toolInput?.command) || getString(entry.metadata?.command)
  const path =
    getString(toolInput?.path) ||
    getString(toolInput?.filePath) ||
    getString(toolInput?.file_path) ||
    getString(entry.metadata?.filePath)
  const inputValue = pickToolInputValue(toolInput)

  let summary = preview.text
  let hasHiddenContent = preview.truncated

  if (entry.type === 'command_run' && command) {
    summary = `$ ${command}`
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  } else if ((entry.type === 'file_read' || entry.type === 'file_edit') && path) {
    summary = path
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  } else if (entry.type === 'tool_use') {
    if (toolName && inputValue) {
      summary = `${toolName}: ${inputValue}`
      hasHiddenContent = hasHiddenContent || Boolean(trimmed)
    } else if (toolName) {
      summary = toolName
      hasHiddenContent = hasHiddenContent || Boolean(trimmed)
    }
  } else if (entry.type === 'tool_result') {
    const parsed = tryParseJson(trimmed)
    const parsedSummary = summarizeParsedJson(parsed)
    const failed = entry.metadata?.status === 'failed'
    if (parsedSummary) {
      summary = failed ? `Failed: ${parsedSummary}` : parsedSummary
    } else if (!trimmed) {
      summary = failed ? 'Tool failed (no output)' : 'Tool completed'
    }
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  }

  if (!summary) {
    summary = entry.type === 'tool_result' ? 'Tool completed' : entryTitle(entry)
  }

  return {
    summary,
    fullContent: trimmed,
    hasHiddenContent
  }
}

function buildFacts(entry: NormalizedEntry): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = []
  const pushFact = (label: string, value: unknown) => {
    if (facts.length >= 6) return
    if (typeof value === 'string' && value.trim()) {
      facts.push({ label, value: value.trim() })
      return
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      facts.push({ label, value: String(value) })
    }
  }

  const toolInput = asRecord(entry.metadata?.toolInput)
  pushFact('Tool', entry.metadata?.toolName)
  pushFact('Status', entry.metadata?.status)
  pushFact('Exit', entry.metadata?.exitCode)
  pushFact('Path', toolInput?.path ?? toolInput?.filePath ?? toolInput?.file_path)
  pushFact('Pattern', toolInput?.pattern)
  pushFact('CWD', toolInput?.cwd)
  pushFact('Call ID', entry.metadata?.toolUseId)

  if (entry.type === 'tool_result') {
    const parsed = tryParseJson(entry.content)
    if (Array.isArray(parsed)) {
      pushFact('Items', parsed.length)
    }
  }

  return facts
}

function statusBadge(entry: NormalizedEntry): { label: string; tone: 'ok' | 'warn' | 'error' } | null {
  const status = getString(entry.metadata?.status)
  const exitCode = getNumber(entry.metadata?.exitCode)

  if (status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0)) {
    return { label: 'ERROR', tone: 'error' }
  }
  if (status === 'success' || exitCode === 0) {
    return { label: 'OK', tone: 'ok' }
  }
  if (status === 'running') {
    return { label: 'RUNNING', tone: 'warn' }
  }
  if (status === 'pending') {
    return { label: 'PENDING', tone: 'warn' }
  }
  return null
}

function stripToolInput(metadata: NormalizedEntry['metadata']): RecordLike | null {
  if (!metadata) return null
  const next: RecordLike = {}
  Object.entries(metadata).forEach(([key, value]) => {
    if (key === 'toolInput' || value === undefined) return
    next[key] = value
  })
  return Object.keys(next).length > 0 ? next : null
}

function CursorLogCard({ entry }: { entry: NormalizedEntry }): React.ReactNode {
  const [expanded, setExpanded] = useState(false)
  const { summary, fullContent, hasHiddenContent } = useMemo(() => buildSummary(entry), [entry])
  const facts = useMemo(() => buildFacts(entry), [entry])
  const rawToolInput = useMemo(() => asRecord(entry.metadata?.toolInput), [entry.metadata])
  const rawMetadata = useMemo(() => stripToolInput(entry.metadata), [entry.metadata])
  const badge = useMemo(() => statusBadge(entry), [entry])

  const hasToolInput = Boolean(rawToolInput && Object.keys(rawToolInput).length > 0)
  const hasMetadata = Boolean(rawMetadata && Object.keys(rawMetadata).length > 0)
  const hasDetails = hasHiddenContent || hasToolInput || hasMetadata || facts.length > 0

  return (
    <div className={cn('rounded-md border', logRowTone(entry.type))}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((prev) => !prev)}
        className={cn(
          'w-full px-3 py-2 text-left',
          hasDetails ? 'cursor-pointer hover:bg-accent/30 transition-colors' : 'cursor-default'
        )}
      >
        <div className="mb-1 flex items-center gap-2">
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="size-3.5" />
          )}
          {renderLogIcon(entry.type)}
          <span className="text-xs font-medium text-foreground">{entryTitle(entry)}</span>
          {badge && (
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 text-[10px]',
                badge.tone === 'ok' && 'border-emerald-500/30 text-emerald-600',
                badge.tone === 'warn' && 'border-amber-500/30 text-amber-600',
                badge.tone === 'error' && 'border-red-500/30 text-red-500'
              )}
            >
              {badge.label}
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
        </div>
        <div className="pl-6 whitespace-pre-wrap break-words text-sm text-foreground">{summary}</div>
      </button>

      {expanded && hasDetails && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2">
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {facts.map((fact) => (
                <span
                  key={`${fact.label}-${fact.value}`}
                  className="rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {fact.label}: {fact.value}
                </span>
              ))}
            </div>
          )}

          {hasHiddenContent && fullContent && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Details</div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-foreground">
                {fullContent}
              </pre>
            </div>
          )}

          {hasToolInput && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Raw arguments</div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-muted-foreground">
                {stringify(rawToolInput)}
              </pre>
            </div>
          )}

          {hasMetadata && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Metadata</div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-muted-foreground">
                {stringify(rawMetadata)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CliToolLogList({ entries }: { entries: NormalizedEntry[] }): React.ReactNode {
  if (entries.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No logs yet.</div>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <CursorLogCard key={entry.id} entry={entry} />
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
  if (entries.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No logs yet.</div>
  }
  return <CliToolLogList entries={entries} />
}
