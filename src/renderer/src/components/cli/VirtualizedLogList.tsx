import { useRef, useCallback, useMemo } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { AnsiHtml } from 'fancy-ansi/react'
import { cn } from '@/lib/utils'

export interface LogEntry {
  type: 'stdout' | 'stderr'
  content: string
  timestamp?: Date
}

interface VirtualizedLogListProps {
  logs: LogEntry[]
  className?: string
  autoScroll?: boolean
  searchQuery?: string
}

/**
 * 单条日志渲染组件
 */
function LogItem({
  entry,
  searchQuery
}: {
  entry: LogEntry
  searchQuery?: string
}) {
  const content = useMemo(() => {
    if (searchQuery && entry.content.includes(searchQuery)) {
      // 高亮搜索词
      return entry.content.replace(
        new RegExp(`(${searchQuery})`, 'gi'),
        '<mark class="bg-yellow-500/50">$1</mark>'
      )
    }
    return entry.content
  }, [entry.content, searchQuery])

  return (
    <div
      className={cn(
        'px-4 py-0.5 font-mono text-sm whitespace-pre-wrap break-all',
        entry.type === 'stderr' && 'text-red-400'
      )}
    >
      <AnsiHtml text={content} />
    </div>
  )
}

/**
 * 虚拟化日志列表组件
 * 使用 react-virtuoso 实现高性能渲染
 */
export function VirtualizedLogList({
  logs,
  className,
  autoScroll = true,
  searchQuery
}: VirtualizedLogListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const isAtBottomRef = useRef(true)

  // 处理滚动状态
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom
  }, [])

  // 渲染单条日志
  const itemContent = useCallback(
    (index: number) => {
      const entry = logs[index]
      return <LogItem entry={entry} searchQuery={searchQuery} />
    },
    [logs, searchQuery]
  )

  // 跟随输出配置
  const followOutput = useCallback(
    (isAtBottom: boolean) => {
      if (!autoScroll) return false
      return isAtBottom ? 'smooth' : false
    },
    [autoScroll]
  )

  if (logs.length === 0) {
    return (
      <div
        className={cn(
          'bg-zinc-900 text-zinc-500 font-mono text-sm p-4 rounded-lg italic',
          className
        )}
      >
        Waiting for output...
      </div>
    )
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      className={cn('bg-zinc-900 text-zinc-100 rounded-lg', className)}
      data={logs}
      totalCount={logs.length}
      itemContent={itemContent}
      followOutput={followOutput}
      atBottomStateChange={handleAtBottomStateChange}
      overscan={200}
      increaseViewportBy={{ top: 200, bottom: 200 }}
    />
  )
}
