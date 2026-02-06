import { useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText,
  FolderOpen,
  Search,
  Edit,
  Terminal,
  ListTodo,
  GitBranch,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  File,
  Folder
} from 'lucide-react'
import type { NormalizedEntry } from './logTypes'

interface ToolCallRendererProps {
  entry: NormalizedEntry
  result?: NormalizedEntry
  timestampLabel?: string
}

type ToolStatus = 'pending' | 'running' | 'success' | 'failed'

interface TodoItem {
  id?: string
  content: string
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

interface GrepMatch {
  path: string
  line?: number
  text?: string
}

const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  read_file: FileText,
  write_file: Edit,
  edit_file: Edit,
  ls: FolderOpen,
  glob: FolderOpen,
  grep: Search,
  execute: Terminal,
  write_todos: ListTodo,
  task: GitBranch,
  web_search: Search,
  web_fetch: FileText
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read File',
  write_file: 'Write File',
  edit_file: 'Edit File',
  ls: 'List Directory',
  glob: 'Find Files',
  grep: 'Search Content',
  execute: 'Execute Command',
  write_todos: 'Update Tasks',
  task: 'Subtask',
  web_search: 'Web Search',
  web_fetch: 'Fetch URL'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeToolName(raw: string): string {
  const lowered = raw.toLowerCase()
  if (lowered === 'bash' || lowered === 'execute' || lowered === 'command') return 'execute'
  if (lowered === 'read' || lowered === 'read_file') return 'read_file'
  if (lowered === 'write' || lowered === 'write_file') return 'write_file'
  if (lowered === 'edit' || lowered === 'edit_file') return 'edit_file'
  if (lowered === 'grep') return 'grep'
  if (lowered === 'glob') return 'glob'
  if (lowered === 'ls' || lowered === 'list') return 'ls'
  if (lowered === 'todowrite' || lowered === 'write_todos') return 'write_todos'
  if (lowered === 'task') return 'task'
  if (lowered === 'websearch' || lowered === 'web_search') return 'web_search'
  if (lowered === 'webfetch' || lowered === 'web_fetch') return 'web_fetch'
  return raw
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseMaybeJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function getDisplayArg(args: Record<string, unknown>): string | null {
  if (!args) return null
  if (args.path) return String(args.path)
  if (args.file_path) return String(args.file_path)
  if (args.command) return String(args.command).slice(0, 80)
  if (args.pattern) return String(args.pattern)
  if (args.query) return String(args.query)
  if (args.glob) return String(args.glob)
  if (args.url) return String(args.url)
  if (args.description) return String(args.description)
  if (args.name) return String(args.name)
  return null
}

function TodosDisplay({ todos }: { todos: TodoItem[] }) {
  const statusConfig: Record<string, { icon: typeof Circle; color: string }> = {
    pending: { icon: Circle, color: 'text-muted-foreground' },
    in_progress: { icon: Clock, color: 'text-amber-500' },
    completed: { icon: CheckCircle2, color: 'text-emerald-500' },
    cancelled: { icon: XCircle, color: 'text-muted-foreground' }
  }

  return (
    <div className="space-y-1">
      {todos.map((todo, i) => {
        const config = statusConfig[todo.status ?? 'pending'] || statusConfig.pending
        const Icon = config.icon
        const isDone = todo.status === 'completed' || todo.status === 'cancelled'
        return (
          <div
            key={todo.id || i}
            className={cn('flex items-start gap-2 text-xs', isDone && 'opacity-60')}
          >
            <Icon className={cn('size-3.5 mt-0.5 shrink-0', config.color)} />
            <span className={cn(isDone && 'line-through')}>{todo.content}</span>
          </div>
        )
      })}
    </div>
  )
}

function FileListDisplay({
  files,
  isGlob
}: {
  files: string[] | Array<{ path: string; is_dir?: boolean }>
  isGlob?: boolean
}) {
  const items = files.slice(0, 15)
  const hasMore = files.length > 15

  return (
    <div className="space-y-0.5">
      {items.map((file, i) => {
        const path = typeof file === 'string' ? file : file.path
        const isDir = typeof file === 'object' && Boolean(file.is_dir)
        return (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            {isDir ? (
              <Folder className="size-3 text-amber-500 shrink-0" />
            ) : (
              <File className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{isGlob ? path : getFileName(path)}</span>
          </div>
        )
      })}
      {hasMore && (
        <div className="text-xs text-muted-foreground mt-1">
          ... and {files.length - 15} more
        </div>
      )}
    </div>
  )
}

function GrepResultsDisplay({ matches }: { matches: GrepMatch[] }) {
  const grouped = matches.reduce(
    (acc, match) => {
      if (!acc[match.path]) acc[match.path] = []
      acc[match.path].push(match)
      return acc
    },
    {} as Record<string, GrepMatch[]>
  )

  const files = Object.keys(grouped).slice(0, 5)
  const hasMore = Object.keys(grouped).length > 5

  return (
    <div className="space-y-2">
      {files.map((path) => (
        <div key={path} className="text-xs">
          <div className="flex items-center gap-1.5 font-medium text-blue-600 mb-1">
            <FileText className="size-3" />
            {getFileName(path)}
          </div>
          <div className="space-y-0.5 pl-4 border-l border-border/50">
            {grouped[path].slice(0, 3).map((match, i) => (
              <div key={i} className="font-mono text-muted-foreground truncate">
                {match.line !== undefined && (
                  <span className="text-amber-500 mr-2">{match.line}:</span>
                )}
                {match.text?.trim()}
              </div>
            ))}
            {grouped[path].length > 3 && (
              <div className="text-muted-foreground">
                +{grouped[path].length - 3} more matches
              </div>
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="text-xs text-muted-foreground">
          ... matches in {Object.keys(grouped).length - 5} more files
        </div>
      )}
    </div>
  )
}

function FileContentPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  const preview = lines.slice(0, 10)
  const hasMore = lines.length > 10

  return (
    <div className="text-xs font-mono bg-muted/30 rounded-sm overflow-hidden w-full">
      <pre className="p-2 overflow-auto max-h-40 w-full">
        {preview.map((line, i) => (
          <div key={i} className="flex min-w-0">
            <span className="w-8 shrink-0 text-muted-foreground select-none pr-2 text-right">
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 truncate">{line || ' '}</span>
          </div>
        ))}
      </pre>
      {hasMore && (
        <div className="px-2 py-1 text-muted-foreground bg-muted/40 border-t border-border">
          ... {lines.length - 10} more lines
        </div>
      )}
    </div>
  )
}

function FileEditSummary({ args }: { args: Record<string, unknown> }) {
  const path = (args.path || args.file_path) as string | undefined
  const content = args.content as string | undefined
  const oldStr = args.old_str as string | undefined
  const newStr = args.new_str as string | undefined

  if (oldStr !== undefined && newStr !== undefined) {
    return (
      <div className="text-xs space-y-2">
        <div className="flex items-center gap-1.5 text-red-500">
          <span className="font-mono bg-red-500/10 px-1.5 py-0.5 rounded">
            - {oldStr.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-500">
          <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
            + {newStr.split('\n').length} lines
          </span>
        </div>
      </div>
    )
  }

  if (content) {
    const lines = content.split('\n').length
    return (
      <div className="text-xs text-muted-foreground">
        Writing {lines} lines{path ? ` to ${getFileName(path)}` : ''}
      </div>
    )
  }

  return null
}

function CommandDisplay({ command, output }: { command: string; output?: string }) {
  return (
    <div className="text-xs space-y-2 w-full overflow-hidden">
      <div className="font-mono bg-muted/30 rounded-sm p-2 flex items-center gap-2 min-w-0">
        <span className="text-blue-500 shrink-0">$</span>
        <span className="truncate">{command}</span>
      </div>
      {output && (
        <pre className="font-mono bg-muted/30 rounded-sm p-2 overflow-auto max-h-32 text-muted-foreground w-full whitespace-pre-wrap break-all">
          {output.slice(0, 500)}
          {output.length > 500 && '...'}
        </pre>
      )}
    </div>
  )
}

function TaskDisplay({ args, isExpanded }: { args: Record<string, unknown>; isExpanded?: boolean }) {
  const name = args.name as string | undefined
  const description = args.description as string | undefined

  return (
    <div className="text-xs space-y-1">
      {name && (
        <div className="flex items-center gap-2">
          <GitBranch className="size-3 text-blue-500" />
          <span className="font-medium truncate">{name}</span>
        </div>
      )}
      {description && (
        <p className={cn('text-muted-foreground pl-5', !isExpanded && 'line-clamp-2')}>
          {description}
        </p>
      )}
    </div>
  )
}

function deriveStatus(
  result: NormalizedEntry | undefined,
  output: string
): { status: ToolStatus; isError: boolean } {
  if (!result) return { status: 'running', isError: false }
  const status = (result.metadata?.status as ToolStatus | undefined) ?? 'success'
  const exitCode = result.metadata?.exitCode
  const isError =
    status === 'failed' ||
    (typeof exitCode === 'number' && exitCode !== 0) ||
    output.toLowerCase().includes('error')
  return { status, isError }
}

export function ToolCallRenderer({ entry, result, timestampLabel }: ToolCallRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const rawToolName = entry.metadata?.toolName || 'tool'
  const toolName = normalizeToolName(rawToolName)
  const Icon = TOOL_ICONS[toolName] || Terminal
  const label = TOOL_LABELS[toolName] || rawToolName

  const rawInput = entry.metadata?.toolInput
  const args = useMemo(() => {
    return isPlainObject(rawInput) ? (rawInput as Record<string, unknown>) : {}
  }, [rawInput])

  const displayArg =
    getDisplayArg(args) ||
    (typeof rawInput === 'string' ? rawInput : null) ||
    (entry.content ? String(entry.content) : null)

  const outputText = useMemo(() => {
    if (!result) return ''
    if (result.metadata?.toolOutput) return safeStringify(result.metadata.toolOutput)
    return safeStringify(result.content)
  }, [result])

  const { isError } = deriveStatus(result, outputText)

  const parsedOutput = useMemo(() => {
    if (!outputText) return undefined
    return parseMaybeJson(outputText)
  }, [outputText])

  const renderFormattedContent = (): ReactNode => {
    switch (toolName) {
      case 'write_todos': {
        const todos = args.todos as TodoItem[] | undefined
        if (Array.isArray(todos) && todos.length > 0) {
          return <TodosDisplay todos={todos} />
        }
        return null
      }
      case 'task': {
        return <TaskDisplay args={args} isExpanded={isExpanded} />
      }
      case 'edit_file':
      case 'write_file': {
        return <FileEditSummary args={args} />
      }
      case 'execute': {
        const command =
          (args.command as string | undefined) ||
          (entry.metadata?.command as string | undefined) ||
          displayArg ||
          ''
        if (!command) return null
        return <CommandDisplay command={command} output={isExpanded ? outputText : undefined} />
      }
      default:
        return null
    }
  }

  const renderFormattedResult = (): ReactNode => {
    if (!result) return null

    if (isError && outputText) {
      return (
        <div className="text-xs text-red-500 flex items-start gap-1.5">
          <XCircle className="size-3 mt-0.5 shrink-0" />
          <span className="break-words">{outputText}</span>
        </div>
      )
    }

    switch (toolName) {
      case 'read_file': {
        const content = outputText
        if (!content) return null
        const lines = content.split('\n').length
        return (
          <div className="space-y-2">
            <div className="text-xs text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="size-3" />
              <span>Read {lines} lines</span>
            </div>
            <FileContentPreview content={content} />
          </div>
        )
      }
      case 'ls':
      case 'glob': {
        let files: Array<{ path: string; is_dir?: boolean }> | string[] = []
        if (Array.isArray(parsedOutput)) {
          files = parsedOutput as Array<{ path: string; is_dir?: boolean }>
        } else if (outputText) {
          files = outputText.split('\n').filter(Boolean)
        }
        if (files.length === 0) return null
        return (
          <div className="space-y-2">
            <div className="text-xs text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="size-3" />
              <span>
                Found {files.length} item{files.length !== 1 ? 's' : ''}
              </span>
            </div>
            <FileListDisplay files={files} isGlob={toolName === 'glob'} />
          </div>
        )
      }
      case 'grep': {
        if (Array.isArray(parsedOutput)) {
          const matches = parsedOutput as GrepMatch[]
          const fileCount = new Set(matches.map((m) => m.path)).size
          return (
            <div className="space-y-2">
              <div className="text-xs text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3" />
                <span>
                  {matches.length} match{matches.length !== 1 ? 'es' : ''} in {fileCount} file
                  {fileCount !== 1 ? 's' : ''}
                </span>
              </div>
              <GrepResultsDisplay matches={matches} />
            </div>
          )
        }
        if (outputText.trim()) {
          return (
            <pre className="text-xs font-mono bg-muted/30 rounded-sm p-2 overflow-auto max-h-32 text-muted-foreground whitespace-pre-wrap break-all">
              {outputText.slice(0, 500)}
              {outputText.length > 500 && '...'}
            </pre>
          )
        }
        return null
      }
      case 'execute': {
        if (isExpanded) {
          return (
            <div className="text-xs text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="size-3" />
              <span>Command completed</span>
            </div>
          )
        }
        if (outputText.trim()) {
          return (
            <div className="space-y-2">
              <div className="text-xs text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3" />
                <span>Command completed</span>
              </div>
              <pre className="text-xs font-mono bg-muted/30 rounded-sm p-2 overflow-auto max-h-32 text-muted-foreground whitespace-pre-wrap break-all">
                {outputText.slice(0, 500)}
                {outputText.length > 500 && '...'}
              </pre>
            </div>
          )
        }
        return (
          <div className="text-xs text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="size-3" />
            <span>Command completed (no output)</span>
          </div>
        )
      }
      case 'write_todos':
        return null
      case 'write_file':
      case 'edit_file': {
        if (outputText.trim()) {
          return (
            <div className="text-xs text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="size-3" />
              <span>{outputText}</span>
            </div>
          )
        }
        return (
          <div className="text-xs text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="size-3" />
            <span>File saved</span>
          </div>
        )
      }
      case 'task': {
        if (outputText.trim()) {
          return (
            <div className="space-y-2">
              <div className="text-xs text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3" />
                <span>Task completed</span>
              </div>
              <div className="text-xs text-muted-foreground pl-5 line-clamp-3">
                {outputText.slice(0, 500)}
                {outputText.length > 500 && '...'}
              </div>
            </div>
          )
        }
        return (
          <div className="text-xs text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="size-3" />
            <span>Task completed</span>
          </div>
        )
      }
      default: {
        if (outputText.trim()) {
          return (
            <div className="text-xs text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="size-3" />
              <span className="truncate">
                {outputText.slice(0, 100)}
                {outputText.length > 100 ? '...' : ''}
              </span>
            </div>
          )
        }
        return (
          <div className="text-xs text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="size-3" />
            <span>Completed</span>
          </div>
        )
      }
    }
  }

  const formattedContent = renderFormattedContent()
  const formattedResult = renderFormattedResult()

  return (
    <div className="rounded-md border border-border/60 bg-background">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}

        <Icon className="size-4 shrink-0 text-blue-600" />

        <span className="text-xs font-medium shrink-0">{label}</span>

        {displayArg && (
          <span className="flex-1 truncate text-left text-xs text-muted-foreground font-mono">
            {displayArg}
          </span>
        )}

        {timestampLabel && (
          <span className="text-[10px] text-muted-foreground/70 ml-auto shrink-0">
            {timestampLabel}
          </span>
        )}

        {!result && (
          <span className="ml-2 shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-amber-600">
            RUNNING
          </span>
        )}

        {result && (
          <span
            className={cn(
              'ml-2 shrink-0 rounded border px-1.5 py-0.5 text-[10px]',
              isError
                ? 'border-red-500/30 text-red-500'
                : 'border-emerald-500/30 text-emerald-600'
            )}
          >
            {isError ? 'ERROR' : 'OK'}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 overflow-hidden">
          {formattedContent}
          {formattedResult}

          <div className="overflow-hidden w-full">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Raw Arguments
            </div>
            <pre className="text-xs font-mono bg-muted/30 p-2 rounded-sm overflow-auto max-h-48 w-full whitespace-pre-wrap break-all">
              {safeStringify(args)}
            </pre>
          </div>

          {result && (
            <div className="overflow-hidden w-full">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Raw Result
              </div>
              <pre
                className={cn(
                  'text-xs font-mono p-2 rounded-sm overflow-auto max-h-48 w-full whitespace-pre-wrap break-all',
                  isError ? 'bg-red-500/10 text-red-500' : 'bg-muted/30'
                )}
              >
                {outputText || '(No output)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
