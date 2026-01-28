import { useEffect, useRef, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { VirtualizedLogList, LogEntry } from './VirtualizedLogList'

interface TerminalLine {
  type: 'stdout' | 'stderr'
  content: string
  timestamp: Date
}

interface TerminalOutputProps {
  lines: TerminalLine[]
  className?: string
  autoScroll?: boolean
  /** 使用虚拟化渲染（推荐用于大量日志） */
  virtualized?: boolean
}

// ANSI 颜色代码映射
const ANSI_COLORS: Record<number, string> = {
  30: 'text-zinc-900',
  31: 'text-red-500',
  32: 'text-green-500',
  33: 'text-yellow-500',
  34: 'text-blue-500',
  35: 'text-purple-500',
  36: 'text-cyan-500',
  37: 'text-zinc-100',
  90: 'text-zinc-500',
  91: 'text-red-400',
  92: 'text-green-400',
  93: 'text-yellow-400',
  94: 'text-blue-400',
  95: 'text-purple-400',
  96: 'text-cyan-400',
  97: 'text-white'
}

const ANSI_BG_COLORS: Record<number, string> = {
  40: 'bg-zinc-900',
  41: 'bg-red-500',
  42: 'bg-green-500',
  43: 'bg-yellow-500',
  44: 'bg-blue-500',
  45: 'bg-purple-500',
  46: 'bg-cyan-500',
  47: 'bg-zinc-100'
}

interface AnsiSegment {
  text: string
  classes: string[]
}

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  let lastIndex = 0
  let currentClasses: string[] = []
  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        classes: [...currentClasses]
      })
    }

    const codes = match[1].split(';').map(Number)
    for (const code of codes) {
      if (code === 0) {
        currentClasses = []
      } else if (code === 1) {
        currentClasses.push('font-bold')
      } else if (code === 3) {
        currentClasses.push('italic')
      } else if (code === 4) {
        currentClasses.push('underline')
      } else if (ANSI_COLORS[code]) {
        currentClasses = currentClasses.filter((c) => !c.startsWith('text-'))
        currentClasses.push(ANSI_COLORS[code])
      } else if (ANSI_BG_COLORS[code]) {
        currentClasses = currentClasses.filter((c) => !c.startsWith('bg-'))
        currentClasses.push(ANSI_BG_COLORS[code])
      }
    }

    lastIndex = ansiRegex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      classes: [...currentClasses]
    })
  }

  return segments.length > 0 ? segments : [{ text, classes: [] }]
}

function AnsiText({ content }: { content: string }) {
  const segments = useMemo(() => parseAnsi(content), [content])

  return (
    <>
      {segments.map((segment, i) => (
        <span key={i} className={cn(segment.classes)}>
          {segment.text}
        </span>
      ))}
    </>
  )
}

export function TerminalOutput({
  lines,
  className,
  autoScroll = true,
  virtualized = false
}: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 转换为 LogEntry 格式
  const logEntries: LogEntry[] = useMemo(
    () =>
      lines.map((line) => ({
        type: line.type,
        content: line.content,
        timestamp: line.timestamp
      })),
    [lines]
  )

  useEffect(() => {
    if (autoScroll && containerRef.current && !virtualized) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, autoScroll, virtualized])

  // 使用虚拟化渲染
  if (virtualized) {
    return (
      <VirtualizedLogList
        logs={logEntries}
        className={cn('h-full', className)}
        autoScroll={autoScroll}
      />
    )
  }

  // 传统渲染方式
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
            <AnsiText content={line.content} />
          </div>
        ))
      )}
    </div>
  )
}
