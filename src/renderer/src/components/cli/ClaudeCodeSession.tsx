import { useState, useEffect, useCallback, useMemo } from 'react'
import { TerminalOutput } from './TerminalOutput'
import { NormalizedLogView } from './NormalizedLogView'
import { useLogStream } from '@/hooks/useLogStream'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square, Terminal, List } from 'lucide-react'

interface TerminalLine {
  type: 'stdout' | 'stderr'
  content: string
  timestamp: Date
}

type ViewMode = 'raw' | 'structured'

interface ClaudeCodeSessionProps {
  sessionId: string
  workdir: string
  prompt?: string
  className?: string
  onClose?: () => void
  defaultViewMode?: ViewMode
}

export function ClaudeCodeSession({
  sessionId,
  workdir,
  prompt,
  className,
  onClose,
  defaultViewMode = 'raw'
}: ClaudeCodeSessionProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped' | 'error'>('idle')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode)

  // 使用新的日志流 hook - 始终传入 sessionId 以加载历史日志
  const { rawLogs, normalizedLogs, isConnected, clearLogs, resubscribe } = useLogStream(sessionId)

  // 将 rawLogs 转换为 TerminalLine 格式
  const terminalLines = useMemo<TerminalLine[]>(() => {
    // 优先使用 logStream 的数据
    if (rawLogs.length > 0) {
      return rawLogs.map((log) => ({
        type: log.type === 'stderr' ? 'stderr' : 'stdout',
        content: log.content || '',
        timestamp: new Date(log.timestamp)
      }))
    }
    // 回退到本地 lines 状态
    return lines
  }, [rawLogs, lines])

  const handleOutput = useCallback(
    (data: { sessionId: string; type: string; content: string }) => {
      if (data.sessionId === sessionId) {
        setLines((prev) => [
          ...prev,
          {
            type: data.type as 'stdout' | 'stderr',
            content: data.content,
            timestamp: new Date()
          }
        ])
      }
    },
    [sessionId]
  )

  const handleClose = useCallback(
    (data: { sessionId: string; code: number }) => {
      if (data.sessionId === sessionId) {
        setStatus(data.code === 0 ? 'stopped' : 'error')
      }
    },
    [sessionId]
  )

  const handleError = useCallback(
    (data: { sessionId: string; error: string }) => {
      if (data.sessionId === sessionId) {
        setStatus('error')
        setLines((prev) => [
          ...prev,
          {
            type: 'stderr',
            content: `Error: ${data.error}`,
            timestamp: new Date()
          }
        ])
      }
    },
    [sessionId]
  )

  useEffect(() => {
    const unsubOutput = window.api.claudeCode.onOutput(handleOutput)
    const unsubClose = window.api.claudeCode.onClose(handleClose)
    const unsubError = window.api.claudeCode.onError(handleError)

    return () => {
      unsubOutput()
      unsubClose()
      unsubError()
    }
  }, [handleOutput, handleClose, handleError])

  const startSession = async () => {
    try {
      console.log('[ClaudeCodeSession] Starting session:', sessionId, 'workdir:', workdir, 'prompt:', prompt)
      setLines([])
      clearLogs()
      setStatus('running')
      const result = await window.api.claudeCode.startSession(sessionId, workdir, { prompt })
      console.log('[ClaudeCodeSession] startSession result:', result)
      // session 启动后重新订阅日志流
      console.log('[ClaudeCodeSession] Resubscribing to log stream...')
      await resubscribe()
      console.log('[ClaudeCodeSession] Resubscribe complete')
    } catch (error) {
      setStatus('error')
      console.error('[ClaudeCodeSession] Failed to start session:', error)
    }
  }

  const stopSession = async () => {
    try {
      await window.api.claudeCode.stopSession(sessionId)
      setStatus('stopped')
    } catch (error) {
      console.error('Failed to stop session:', error)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
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
          {/* 视图切换按钮 */}
          <div className="flex items-center rounded-md border border-zinc-700 p-0.5">
            <button
              onClick={() => setViewMode('raw')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                viewMode === 'raw'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
              title="Raw output"
            >
              <Terminal className="w-3 h-3" />
              Raw
            </button>
            <button
              onClick={() => setViewMode('structured')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                viewMode === 'structured'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
              title="Structured view"
            >
              <List className="w-3 h-3" />
              Structured
            </button>
          </div>
          {status !== 'running' ? (
            <Button size="sm" variant="outline" onClick={startSession}>
              <Play className="w-4 h-4" />
              Start
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stopSession}>
              <Square className="w-4 h-4" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'raw' ? (
        <TerminalOutput lines={terminalLines} className="h-80" virtualized />
      ) : (
        <div className="bg-zinc-900 rounded-lg h-80 overflow-auto p-2">
          <NormalizedLogView entries={normalizedLogs} />
        </div>
      )}
    </div>
  )
}
