import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/providers/language-provider'
import { cn } from '@/lib/utils'
import { TerminalView } from './TerminalView'

interface TerminalInstance {
  id: string
  paneId: string
  name: string
  createdAt: number
}

interface TerminalPanelProps {
  taskId: string | null
  workingDir: string | null
  isActive: boolean
  openRequestId: number
}

function generatePaneId(taskId: string, terminalId: string) {
  return `${taskId}:term:${terminalId}`
}

function getNextTerminalName(terminals: TerminalInstance[]): string {
  const existingNumbers = terminals
    .map((terminal) => {
      const match = terminal.name.match(/^Terminal (\d+)$/)
      return match ? Number(match[1]) : 0
    })
    .filter((num) => num > 0)

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
  return `Terminal ${maxNumber + 1}`
}

export function TerminalPanel({ taskId, workingDir, isActive, openRequestId }: TerminalPanelProps) {
  const { t } = useLanguage()
  const [terminals, setTerminals] = useState<TerminalInstance[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const terminalsRef = useRef(terminals)
  const taskIdRef = useRef(taskId)
  const autoCreateInFlightRef = useRef(false)
  const lastOpenRequestIdRef = useRef(0)
  const pendingOpenRequestIdRef = useRef<number | null>(null)

  useEffect(() => {
    terminalsRef.current = terminals
    if (terminals.length > 0) {
      autoCreateInFlightRef.current = false
    }
  }, [terminals])

  const createTerminal = useCallback(() => {
    if (!taskId || !workingDir) return

    const id = nanoid(6)
    const paneId = generatePaneId(taskId, id)
    const createdAt = Date.now()

    setTerminals((prev) => {
      const name = getNextTerminalName(prev)
      const terminal: TerminalInstance = {
        id,
        paneId,
        name,
        createdAt
      }
      return [...prev, terminal]
    })
    setActiveTerminalId(id)
  }, [taskId, workingDir])

  const closeTerminal = useCallback((terminalId: string) => {
    setTerminals((prev) => {
      const next = prev.filter((terminal) => terminal.id !== terminalId)
      const removed = prev.find((terminal) => terminal.id === terminalId)
      if (removed) {
        void window.api.terminal.kill(removed.paneId)
      }
      return next
    })

    setActiveTerminalId((prevActive) => {
      if (prevActive !== terminalId) return prevActive
      const remaining = terminalsRef.current.filter((terminal) => terminal.id !== terminalId)
      return remaining[remaining.length - 1]?.id ?? null
    })
  }, [])

  useEffect(() => {
    if (openRequestId === lastOpenRequestIdRef.current) return
    lastOpenRequestIdRef.current = openRequestId
    pendingOpenRequestIdRef.current = openRequestId
  }, [openRequestId])

  useEffect(() => {
    const pendingRequestId = pendingOpenRequestIdRef.current
    if (!pendingRequestId) return
    if (!isActive) return

    if (terminalsRef.current.length > 0) {
      pendingOpenRequestIdRef.current = null
      return
    }
    if (!taskId || !workingDir) return
    if (autoCreateInFlightRef.current) return

    autoCreateInFlightRef.current = true
    pendingOpenRequestIdRef.current = null
    createTerminal()
  }, [createTerminal, isActive, taskId, terminals.length, workingDir])

  useEffect(() => {
    const prevTaskId = taskIdRef.current
    if (prevTaskId && prevTaskId !== taskId) {
      void window.api.terminal.killByWorkspaceId(prevTaskId)
      setTerminals([])
      setActiveTerminalId(null)
    }
    taskIdRef.current = taskId
    autoCreateInFlightRef.current = false
    pendingOpenRequestIdRef.current = null
  }, [taskId])

  useEffect(() => {
    return () => {
      terminalsRef.current.forEach((terminal) => {
        void window.api.terminal.kill(terminal.paneId)
      })
    }
  }, [])

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeTerminalId) ?? null,
    [activeTerminalId, terminals]
  )

  const hasWorkingDir = Boolean(workingDir)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b py-2 pr-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-0 overflow-x-auto">
            {terminals.map((terminal) => {
              const isTerminalActive = terminal.id === activeTerminalId
              return (
                <div
                  key={terminal.id}
                  className={cn(
                    'group flex items-center overflow-hidden rounded-md border',
                    isTerminalActive
                      ? 'border-border bg-foreground text-background'
                      : 'border-border/50 bg-muted/20 text-foreground'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTerminalId(terminal.id)}
                    className={cn(
                      'flex h-7 items-center gap-2 px-2 text-xs',
                      isTerminalActive ? 'text-background' : 'text-foreground'
                    )}
                  >
                    <span className="max-w-[140px] truncate">{terminal.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      closeTerminal(terminal.id)
                    }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center transition-opacity',
                      isTerminalActive
                        ? 'text-background/70 hover:text-background opacity-100'
                        : 'text-foreground/70 hover:text-foreground opacity-0 group-hover:opacity-100'
                    )}
                    aria-label="Close terminal"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={createTerminal}
            disabled={!hasWorkingDir || !taskId}
            className="h-7 w-7"
            aria-label="New terminal"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {!workingDir && (
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            <span className="truncate">{t.preview.workspaceEmpty}</span>
          </div>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden bg-[#0b0b0d]">
        {activeTerminal ? (
          terminals.map((terminal) => (
            <TerminalView
              key={terminal.paneId}
              paneId={terminal.paneId}
              cwd={workingDir || ''}
              workspaceId={taskId}
              isActive={terminal.id === activeTerminalId}
            />
          ))
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            {hasWorkingDir ? t.preview.terminalCreateHint : t.preview.workspaceEmpty}
          </div>
        )}
      </div>
    </div>
  )
}
