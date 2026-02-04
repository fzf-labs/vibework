import { useCallback, useEffect, useRef } from 'react'
import type { Terminal as XTerm } from 'xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { createTerminalInstance } from './helpers'
import { cn } from '@/lib/utils'
import 'xterm/css/xterm.css'

interface TerminalViewProps {
  paneId: string
  cwd: string
  workspaceId?: string | null
  isActive: boolean
}

export function TerminalView({ paneId, cwd, workspaceId, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const exitedRef = useRef(false)

  const startSession = useCallback(async () => {
    if (!xtermRef.current) return
    const cols = xtermRef.current.cols || 80
    const rows = xtermRef.current.rows || 24
    try {
      await window.api.terminal.startSession(paneId, cwd, cols, rows, workspaceId ?? undefined)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      xtermRef.current.writeln(`\\r\\n[Failed to start terminal: ${message}]`)
    }
  }, [cwd, paneId, workspaceId])

  const handleResize = useCallback(() => {
    if (!xtermRef.current || !fitAddonRef.current) return
    try {
      fitAddonRef.current.fit()
      window.api.terminal.resize(paneId, xtermRef.current.cols, xtermRef.current.rows)
    } catch {
      // ignore resize errors
    }
  }, [paneId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const { xterm, fitAddon, cleanup } = createTerminalInstance(container, {
      onUrlClick: (url) => window.api.shell.openUrl(url)
    })

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon
    exitedRef.current = false

    void startSession()

    const unsubscribeData = window.api.terminal.onData((data) => {
      if (data.paneId !== paneId) return
      xterm.write(data.data)
    })

    const unsubscribeExit = window.api.terminal.onExit((data) => {
      if (data.paneId !== paneId) return
      exitedRef.current = true
      xterm.writeln(`\r\n[Process exited with code ${data.exitCode}]`)
      xterm.writeln('[Press any key to restart]')
    })

    const unsubscribeError = window.api.terminal.onError((data) => {
      if (data.paneId !== paneId) return
      xterm.writeln(`\r\n[Terminal error: ${data.error}]`)
    })

    const handleInput = (value: string) => {
      if (exitedRef.current) {
        exitedRef.current = false
        xterm.clear()
        void startSession()
        return
      }
      window.api.terminal.write(paneId, value)
    }

    const inputDisposable = xterm.onData(handleInput)

    const keyDisposable = xterm.onKey((event) => {
      const { domEvent } = event
      if ((domEvent.metaKey || domEvent.ctrlKey) && domEvent.key.toLowerCase() === 'k') {
        domEvent.preventDefault()
        xterm.clear()
      }
    })

    const resizeObserver = new ResizeObserver(() => handleResize())
    resizeObserver.observe(container)

    return () => {
      inputDisposable.dispose()
      keyDisposable.dispose()
      resizeObserver.disconnect()
      unsubscribeData()
      unsubscribeExit()
      unsubscribeError()
      cleanup()
      window.api.terminal.detach(paneId)
      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [handleResize, paneId, startSession])

  useEffect(() => {
    if (!isActive) return
    handleResize()
  }, [handleResize, isActive])

  return (
    <div
      className={cn(
        'absolute inset-0 h-full w-full overflow-hidden transition-opacity',
        isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
