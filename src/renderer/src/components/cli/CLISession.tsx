import { useState, useEffect, useCallback, useImperativeHandle, useRef, forwardRef } from 'react'
import { NormalizedLogView } from './NormalizedLogView'
import { useLogStream } from '@/hooks/useLogStream'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square } from 'lucide-react'

interface CLISessionProps {
  sessionId: string
  toolId: string
  workdir: string
  prompt?: string
  className?: string
  compact?: boolean
  allowStart?: boolean
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
  toolId,
  workdir,
  prompt,
  className,
  compact = false,
  allowStart = true,
  onStatusChange
}: CLISessionProps, ref) {
  const [status, setStatus] = useState<CLISessionStatus>('idle')

  const { normalizedLogs, clearLogs, resubscribe } = useLogStream(sessionId)
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
    const unsubClose = window.api.cliSession.onClose(handleClose)
    const unsubError = window.api.cliSession.onError(handleError)

    return () => {
      unsubClose()
      unsubError()
    }
  }, [handleClose, handleError])

  const startSession = useCallback(async (promptOverride?: string) => {
    try {
      const nextPrompt = promptOverride ?? prompt
      clearLogs()
      setStatus('running')
      await window.api.cliSession.startSession(sessionId, toolId, workdir, { prompt: nextPrompt })
      await resubscribe()
    } catch (error) {
      setStatus('error')
      console.error('[CLISession] Failed to start session:', error)
    }
  }, [clearLogs, prompt, resubscribe, sessionId, toolId, workdir])

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

  useEffect(() => {
    if (userScrolledUpRef.current) return
    const container = logContainerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    })
  }, [normalizedLogs.length])

  const showStartButton = allowStart && status !== 'running'
  const showStopButton = status === 'running'

  return (
    <div className={cn('flex flex-col', !compact && 'gap-3', className)}>
      {!compact && (showStartButton || showStopButton) && (
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
          'bg-muted/50 rounded-lg overflow-auto p-2 relative',
          compact ? 'flex-1 min-h-0' : 'h-80'
        )}
      >
        {compact && (showStartButton || showStopButton) && (
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
        <NormalizedLogView entries={normalizedLogs} />
        <div ref={logEndRef} />
      </div>
    </div>
  )
})
