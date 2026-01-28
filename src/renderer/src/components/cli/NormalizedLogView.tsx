import { useMemo } from 'react'
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
  Bot
} from 'lucide-react'

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

  const subtitle = useMemo(() => {
    if (entry.metadata?.toolName) return entry.metadata.toolName
    if (entry.metadata?.filePath) return entry.metadata.filePath
    if (entry.metadata?.command) return entry.metadata.command
    return null
  }, [entry.metadata])

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
          {entry.content}
        </div>
        {entry.metadata?.exitCode !== undefined && (
          <div
            className={cn(
              'text-xs mt-1 font-medium',
              entry.metadata.exitCode === 0 ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            Exit code: {entry.metadata.exitCode}
          </div>
        )}
      </div>
    </div>
  )
}

export function NormalizedLogView({ entries, className }: NormalizedLogViewProps) {
  if (entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground italic py-8', className)}>
        No structured logs available
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {entries.map((entry) => (
        <LogEntry key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
