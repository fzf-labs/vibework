import { useState, useEffect, useCallback } from 'react'
import { NormalizedLogView } from './NormalizedLogView'
import { useLogStream } from '@/hooks/useLogStream'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square } from 'lucide-react'

interface ClaudeCodeSessionProps {
  sessionId: string
  workdir: string
  prompt?: string
  className?: string
  compact?: boolean  // 精简模式：隐藏状态栏和控制按钮
}

export function ClaudeCodeSession({
  sessionId,
  workdir,
  prompt,
  className,
  compact = false
}: ClaudeCodeSessionProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped' | 'error'>('idle')

  // 使用日志流 hook
  const { normalizedLogs, clearLogs, resubscribe } = useLogStream(sessionId)

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
        console.error('[ClaudeCodeSession] Error:', data.error)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    const unsubClose = window.api.claudeCode.onClose(handleClose)
    const unsubError = window.api.claudeCode.onError(handleError)

    return () => {
      unsubClose()
      unsubError()
    }
  }, [handleClose, handleError])

  const startSession = async () => {
    try {
      console.log('[ClaudeCodeSession] Starting session:', sessionId, 'workdir:', workdir, 'prompt:', prompt)
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
    <div className={cn('flex flex-col', !compact && 'gap-3', className)}>
      {/* 状态栏和控制按钮 - compact 模式下隐藏 */}
      {!compact && (
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
      )}

      {/* 日志区域 - compact 模式下使用 flex-1 填满容器 */}
      <div className={cn(
        'bg-muted/50 rounded-lg overflow-auto p-2 relative',
        compact ? 'flex-1 min-h-0' : 'h-80'
      )}>
        {/* compact 模式下的浮动控制按钮 */}
        {compact && (
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
            {status !== 'running' ? (
              <Button size="sm" variant="ghost" onClick={startSession} className="h-7 px-2">
                <Play className="w-3.5 h-3.5 mr-1" />
                Start
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={stopSession} className="h-7 px-2">
                <Square className="w-3.5 h-3.5 mr-1" />
                Stop
              </Button>
            )}
          </div>
        )}
        <NormalizedLogView entries={normalizedLogs} />
      </div>
    </div>
  )
}
