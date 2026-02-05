import { useState, useEffect, useCallback, useImperativeHandle, useRef, forwardRef, useMemo } from 'react'
import { NormalizedLogView } from './NormalizedLogView'
import { useLogStream } from '@/hooks/useLogStream'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square } from 'lucide-react'
import type { LogMsg } from '@/hooks/useLogStream'
import type { NormalizedEntry, NormalizedEntryType } from './NormalizedLogView'

type RecordLike = Record<string, unknown>

const MESSAGE_TYPES: NormalizedEntryType[] = ['assistant_message', 'user_message', 'system_message']

function isMessageType(type: NormalizedEntryType): boolean {
  return MESSAGE_TYPES.includes(type)
}

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
        return createEntry('assistant_message', resultText, timestamp, `${idBase}-result`)
      }
      return createEntry('system_message', 'Completed', timestamp, `${idBase}-result`)
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

function parseAgentRawLogs(rawLogs: LogMsg[], toolId: string): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  rawLogs.forEach((msg, msgIndex) => {
    if (msg.type === 'stderr') {
      const content = msg.content?.trim()
      if (!content) return
      const idBase = msg.id ?? `stderr-${msgIndex}`
      entries.push(createEntry('error', content, msg.timestamp ?? Date.now(), `${idBase}-stderr`))
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
      const parsed =
        toolId === 'cursor-agent'
          ? parseCursorAgentLine(trimmed, msg.timestamp, lineBase)
          : parseOpencodeLine(trimmed, msg.timestamp, lineBase)
      if (parsed) entries.push(parsed)
    })
  })

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
      .map((msg, index) => ({
        id: msg.id || `${msg.type}-${msg.timestamp ?? index}`,
        type: msg.type === 'stderr' ? 'error' : 'system_message',
        timestamp: msg.timestamp ?? Date.now(),
        content: msg.content ?? ''
      }))
  }, [rawLogs])

  const parsedEntries = useMemo(() => {
    if (rawLogs.length === 0) return []
    if (toolId !== 'cursor-agent' && toolId !== 'opencode') return []
    return parseAgentRawLogs(rawLogs, toolId)
  }, [rawLogs, toolId])

  const displayLogs = useMemo(() => {
    const mergeLogs = (primary: NormalizedEntry[], secondary: NormalizedEntry[]) => {
      if (primary.length === 0) return secondary
      if (secondary.length === 0) return primary
      const dedupeKeys = new Set(
        primary
          .filter((entry) => isMessageType(entry.type))
          .map((entry) => `${entry.type}:${entry.content?.trim() ?? ''}`)
      )
      const filtered = secondary.filter((entry) => {
        if (!isMessageType(entry.type)) return true
        const key = `${entry.type}:${entry.content?.trim() ?? ''}`
        return !dedupeKeys.has(key)
      })
      const merged = [...primary, ...filtered]
      return merged.sort((a, b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id))
    }

    if (parsedEntries.length > 0) {
      return mergeLogs(normalizedLogs, parsedEntries)
    }

    if (normalizedLogs.length > 0 && rawEntries.length > 0) {
      return mergeLogs(normalizedLogs, rawEntries)
    }

    if (normalizedLogs.length > 0) return normalizedLogs
    return rawEntries
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
