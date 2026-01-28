import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TerminalLine {
  type: 'stdout' | 'stderr'
  content: string
  timestamp: Date
}

interface TerminalOutputProps {
  lines: TerminalLine[]
  className?: string
  autoScroll?: boolean
}

export function TerminalOutput({
  lines,
  className,
  autoScroll = true
}: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-zinc-900 text-zinc-100 font-mono text-sm p-4 rounded-lg overflow-auto',
        className
      )}
    >
      {lines.length === 0 ? (
        <div className="text-zinc-500 italic">Waiting for output...</div>
      ) : (
        lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'whitespace-pre-wrap break-all',
              line.type === 'stderr' && 'text-red-400'
            )}
          >
            {line.content}
          </div>
        ))
      )}
    </div>
  )
}
