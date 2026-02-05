import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Terminal,
  FileEdit,
  FileText,
  AlertCircle,
  Wrench,
  CheckCircle,
  User,
  Bot,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { ToolCallRenderer } from './ToolCallRenderer'

export type NormalizedEntryType =
  | 'assistant_message'
  | 'user_message'
  | 'system_message'
  | 'tool_use'
  | 'tool_result'
  | 'command_run'
  | 'file_edit'
  | 'file_read'
  | 'error'

export interface NormalizedEntry {
  id: string
  type: NormalizedEntryType
  timestamp: number
  content: string
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
    toolUseId?: string
    status?: 'pending' | 'running' | 'success' | 'failed'
    filePath?: string
    command?: string
    exitCode?: number
    success?: boolean
    [key: string]: unknown
  }
}

interface NormalizedLogViewProps {
  entries: NormalizedEntry[]
  className?: string
}

const TYPE_CONFIG: Record<
  NormalizedEntryType,
  { icon: React.ElementType; label: string; color: string }
> = {
  assistant_message: { icon: Bot, label: 'Assistant', color: 'text-blue-600' },
  user_message: { icon: User, label: 'User', color: 'text-emerald-600' },
  system_message: { icon: MessageSquare, label: 'System', color: 'text-slate-500' },
  tool_use: { icon: Wrench, label: 'Tool', color: 'text-violet-600' },
  tool_result: { icon: CheckCircle, label: 'Result', color: 'text-teal-600' },
  command_run: { icon: Terminal, label: 'Command', color: 'text-amber-600' },
  file_edit: { icon: FileEdit, label: 'Edit', color: 'text-orange-600' },
  file_read: { icon: FileText, label: 'Read', color: 'text-slate-600' },
  error: { icon: AlertCircle, label: 'Error', color: 'text-red-600' }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function LogEntry({ entry }: { entry: NormalizedEntry }) {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.system_message
  const Icon = config.icon
  const [expanded, setExpanded] = useState(false)

  const subtitle = useMemo(() => {
    if (entry.metadata?.toolName) return entry.metadata.toolName
    if (entry.metadata?.filePath) return entry.metadata.filePath
    if (entry.metadata?.command) return entry.metadata.command
    return null
  }, [entry.metadata])

  const content = entry.content ?? ''
  const lines = useMemo(() => content.split('\n'), [content])
  const preview = lines[0] ?? ''
  const isLong = content.length > 160 || lines.length > 1
  const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0
  const isPanelType =
    entry.type === 'system_message' || entry.type === 'error' || entry.type === 'tool_result'
  const hasDetails = isLong || hasMeta

  const statusBadge = useMemo(() => {
    const status = entry.metadata?.status
    const exitCode = entry.metadata?.exitCode
    if (status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0)) return 'ERROR'
    if (status === 'success' || exitCode === 0) return 'OK'
    return null
  }, [entry.metadata])

  if (isPanelType) {
    return (
      <div className="rounded-md border border-border/60 bg-background">
        <button
          onClick={() => hasDetails && setExpanded((prev) => !prev)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 transition-colors',
            hasDetails ? 'hover:bg-accent/40' : 'cursor-default'
          )}
          type="button"
        >
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <Icon className={cn('size-4 shrink-0', config.color)} />

          <span className="text-xs font-medium shrink-0">{config.label}</span>

          {subtitle && (
            <span className="text-xs text-muted-foreground truncate font-mono">{subtitle}</span>
          )}

          <span className="flex-1 truncate text-left text-xs text-muted-foreground">
            {preview}
          </span>

          {statusBadge && (
            <span
              className={cn(
                'ml-1 rounded border px-1.5 py-0.5 text-[10px]',
                statusBadge === 'ERROR'
                  ? 'border-red-500/30 text-red-500'
                  : 'border-emerald-500/30 text-emerald-600'
              )}
            >
              {statusBadge}
            </span>
          )}

          <span className="text-[10px] text-muted-foreground/70 ml-auto shrink-0">
            {formatTime(entry.timestamp)}
          </span>
        </button>

        {expanded && (
          <div className="border-t border-border px-3 py-2 space-y-2">
            <div className="text-sm text-foreground whitespace-pre-wrap break-words">
              {content}
            </div>
            {entry.metadata?.exitCode !== undefined && (
              <div
                className={cn(
                  'text-xs font-medium',
                  entry.metadata.exitCode === 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                Exit code: {entry.metadata.exitCode}
              </div>
            )}
            {hasMeta && (
              <pre className="text-xs font-mono bg-muted/30 rounded-sm p-2 overflow-auto max-h-40 text-muted-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-3 py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
      <div className={cn('flex-shrink-0 mt-0.5', config.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground truncate font-mono">{subtitle}</span>
          )}
          <span className="text-xs text-muted-foreground/70 ml-auto">{formatTime(entry.timestamp)}</span>
        </div>
        <div className="text-sm text-foreground whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    </div>
  )
}

function MessageEntry({ entry }: { entry: NormalizedEntry }) {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.system_message
  const Icon = config.icon
  const isUser = entry.type === 'user_message'
  const isSystem = entry.type === 'system_message'
  const [expanded, setExpanded] = useState(false)

  const content = entry.content ?? ''
  const lines = useMemo(() => content.split('\n'), [content])
  const previewLines = 8
  const isLong = content.length > 800 || lines.length > previewLines
  const visibleContent = expanded ? content : lines.slice(0, previewLines).join('\n')
  const remainingLines = Math.max(lines.length - previewLines, 0)

  const bubbleClass = cn(
    'rounded-md border px-3 py-2',
    entry.type === 'assistant_message' && 'bg-blue-500/5 border-blue-500/20',
    entry.type === 'user_message' && 'bg-emerald-500/5 border-emerald-500/20',
    entry.type === 'system_message' && 'bg-slate-500/5 border-slate-500/20'
  )
  const contentClass = cn(
    'text-sm text-foreground whitespace-pre-wrap break-words',
    isSystem && 'text-muted-foreground italic'
  )

  return (
    <div className={cn('flex gap-3 py-2 px-3', isUser && 'justify-end')}>
      <div className={cn('flex-shrink-0 mt-0.5', config.color, isUser && 'order-2')}>
        <Icon className="w-4 h-4" />
      </div>
      <div className={cn('min-w-0 max-w-[80%]', isUser && 'order-1')}>
        <div className={bubbleClass}>
          <div className={cn('flex items-center gap-2 mb-1', isUser && 'justify-end')}>
            <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
            <span className="text-xs text-muted-foreground/70 ml-auto">
              {formatTime(entry.timestamp)}
            </span>
          </div>
          <div className={contentClass}>{visibleContent}</div>
          {isLong && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              {expanded
                ? 'Show less'
                : remainingLines > 0
                  ? `Show more (${remainingLines} lines)`
                  : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function isMessageEntry(entry: NormalizedEntry): boolean {
  return (
    entry.type === 'assistant_message' ||
    entry.type === 'user_message' ||
    entry.type === 'system_message'
  )
}

function isToolCallEntry(entry: NormalizedEntry): boolean {
  return (
    entry.type === 'tool_use' ||
    entry.type === 'command_run' ||
    entry.type === 'file_edit' ||
    entry.type === 'file_read'
  )
}

function ToolCallLogEntry({
  entry,
  result
}: {
  entry: NormalizedEntry
  result?: NormalizedEntry
}) {
  return (
    <div className="py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
      <ToolCallRenderer
        entry={entry}
        result={result}
        timestampLabel={formatTime(entry.timestamp)}
      />
    </div>
  )
}

export function NormalizedLogView({ entries, className }: NormalizedLogViewProps) {
  const toolResultById = useMemo(() => {
    const map = new Map<string, NormalizedEntry>()
    for (const entry of entries) {
      if (entry.type === 'tool_result' && entry.metadata?.toolUseId) {
        map.set(entry.metadata.toolUseId, entry)
      }
    }
    return map
  }, [entries])

  const toolResultIdsToHide = useMemo(() => {
    const hidden = new Set<string>()
    for (const entry of entries) {
      if (!isToolCallEntry(entry)) continue
      const toolUseId = entry.metadata?.toolUseId
      if (!toolUseId) continue
      const result = toolResultById.get(toolUseId)
      if (result) hidden.add(result.id)
    }
    return hidden
  }, [entries, toolResultById])

  if (entries.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-1', className)}>
      {entries.map((entry) => {
        if (isMessageEntry(entry)) {
          return <MessageEntry key={entry.id} entry={entry} />
        }

        if (isToolCallEntry(entry)) {
          const toolUseId = entry.metadata?.toolUseId
          const result = toolUseId ? toolResultById.get(toolUseId) : undefined
          return <ToolCallLogEntry key={entry.id} entry={entry} result={result} />
        }

        if (entry.type === 'tool_result' && toolResultIdsToHide.has(entry.id)) {
          return null
        }

        return <LogEntry key={entry.id} entry={entry} />
      })}
    </div>
  )
}
