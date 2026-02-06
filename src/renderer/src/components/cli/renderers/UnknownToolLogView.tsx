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

function parseUnknownToolLogs(logs: LogMsg[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  logs.forEach((msg, msgIndex) => {
    if (msg.type === 'normalized' && msg.entry) {
      entries.push(normalizeEntryFromLog(msg.entry, msg, msgIndex))
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
      entries.push(createEntry('error', trimmed, timestamp, `${idBase}-stderr`))
      return
    }

    if (msg.type === 'stdout') {
      entries.push(createEntry('system_message', trimmed, timestamp, `${idBase}-stdout`))
    }
  })

  return entries
}

export function UnknownToolLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseUnknownToolLogs(logs), [logs])
  return <CliToolLogList entries={entries} />
}
