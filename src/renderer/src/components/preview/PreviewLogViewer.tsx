import { useState, useEffect, useRef, useCallback } from 'react'

interface PreviewLogViewerProps {
  instanceId: string
  autoScroll?: boolean
}

export function PreviewLogViewer({
  instanceId,
  autoScroll = true
}: PreviewLogViewerProps): JSX.Element {
  const [logs, setLogs] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('')
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoScroll)
  const logEndRef = useRef<HTMLDivElement>(null)

  const loadLogs = useCallback(async (): Promise<void> => {
    try {
      const output = await window.api.preview.getOutput(instanceId, 100)
      setLogs(output)
    } catch (error) {
      console.error('加载日志失败:', error)
    }
  }, [instanceId])

  const scrollToBottom = useCallback((): void => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadLogs()
    }, 0)
    const interval = setInterval(() => {
      void loadLogs()
    }, 1000)
    return () => {
      clearTimeout(initialLoad)
      clearInterval(interval)
    }
  }, [loadLogs])

  useEffect(() => {
    if (autoScrollEnabled) {
      scrollToBottom()
    }
  }, [autoScrollEnabled, logs, scrollToBottom])

  const getLogLevel = (line: string): string => {
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes('error') || lowerLine.includes('err')) return 'error'
    if (lowerLine.includes('warn') || lowerLine.includes('warning')) return 'warn'
    if (lowerLine.includes('info')) return 'info'
    if (lowerLine.includes('debug')) return 'debug'
    return 'default'
  }

  const getLogClassName = (level: string): string => {
    const base = 'font-mono text-sm px-4 py-1 border-b'
    switch (level) {
      case 'error':
        return `${base} bg-red-50 text-red-800`
      case 'warn':
        return `${base} bg-yellow-50 text-yellow-800`
      case 'info':
        return `${base} bg-blue-50 text-blue-800`
      case 'debug':
        return `${base} bg-gray-50 text-gray-600`
      default:
        return `${base} text-gray-800`
    }
  }

  const filteredLogs = filter
    ? logs.filter((log) => log.toLowerCase().includes(filter.toLowerCase()))
    : logs

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-2 border-b bg-gray-50">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤日志..."
          className="flex-1 px-3 py-1 text-sm border rounded"
        />
        <button
          onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
          className={`px-3 py-1 text-sm rounded ${
            autoScrollEnabled ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          {autoScrollEnabled ? '自动滚动' : '固定'}
        </button>
        <button onClick={scrollToBottom} className="px-3 py-1 text-sm bg-gray-200 rounded">
          滚动到底部
        </button>
        <button onClick={() => setLogs([])} className="px-3 py-1 text-sm bg-gray-200 rounded">
          清空
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {filter ? '没有匹配的日志' : '暂无日志'}
          </div>
        ) : (
          <div>
            {filteredLogs.map((log, index) => {
              const level = getLogLevel(log)
              return (
                <div key={index} className={getLogClassName(level)}>
                  {log}
                </div>
              )
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
