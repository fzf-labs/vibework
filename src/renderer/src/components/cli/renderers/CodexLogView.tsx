import { useMemo, useState } from 'react'
import type { LogMsg } from '@/hooks/useLogStream'
import type { NormalizedEntry, NormalizedEntryType } from '../logTypes'
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

function LogCard({ entry }: { entry: NormalizedEntry }): React.ReactNode {
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
        <LogCard key={entry.id} entry={entry} />
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

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
}

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function makeId(base: string, suffix: string | number): string {
  return `${base}-${suffix}`
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
    const nestedRecord = asRecord(nested)
    const nestedText = getString(nested) || (nestedRecord ? getString(nestedRecord.message) : undefined)
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

function parseCodexLogs(logs: LogMsg[]): NormalizedEntry[] {
  return parseLogsWithParser(logs, parseCodexLine)
}

export function CodexLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseCodexLogs(logs), [logs])
  return <CliToolLogList entries={entries} />
}
