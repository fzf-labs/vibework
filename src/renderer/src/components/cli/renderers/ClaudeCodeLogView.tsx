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

function parseClaudeCodeLogs(logs: LogMsg[]): NormalizedEntry[] {
  return parseLogsWithParser(logs, parseClaudeCodeLine)
}

export function ClaudeCodeLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseClaudeCodeLogs(logs), [logs])
  return <CliToolLogList entries={entries} />
}
