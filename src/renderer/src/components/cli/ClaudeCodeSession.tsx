import { useState, useEffect, useCallback } from 'react'
import { TerminalOutput } from './TerminalOutput'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square, Send } from 'lucide-react'

interface TerminalLine {
  type: 'stdout' | 'stderr'
  content: string
  timestamp: Date
}

interface ClaudeCodeSessionProps {
  sessionId: string
  workdir: string
  className?: string
  onClose?: () => void
}

export function ClaudeCodeSession({
  sessionId,
  workdir,
  className,
  onClose
}: ClaudeCodeSessionProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped' | 'error'>('idle')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')

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
      setLines([])
      setStatus('running')
      await window.api.claudeCode.startSession(sessionId, workdir)
    } catch (error) {
      setStatus('error')
      console.error('Failed to start session:', error)
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

  const sendInput = async () => {
    if (!input.trim()) return
    try {
      await window.api.claudeCode.sendInput(sessionId, input)
      setLines((prev) => [
        ...prev,
        { type: 'stdout', content: `> ${input}`, timestamp: new Date() }
      ])
      setInput('')
    } catch (error) {
      console.error('Failed to send input:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendInput()
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

      <TerminalOutput lines={lines} className="h-80" />

      {status === 'running' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm bg-zinc-800 text-zinc-100 rounded-md border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button size="sm" onClick={sendInput} disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
