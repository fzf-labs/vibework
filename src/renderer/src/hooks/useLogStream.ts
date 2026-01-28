import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 日志消息类型
 */
export interface LogMsg {
  type: 'stdout' | 'stderr' | 'normalized' | 'finished'
  content?: string
  timestamp: number
  entry?: NormalizedEntry
  exitCode?: number
}

export interface NormalizedEntry {
  id: string
  type: string
  timestamp: number
  content: string
  metadata?: Record<string, unknown>
}

export interface UseLogStreamResult {
  rawLogs: LogMsg[]
  normalizedLogs: NormalizedEntry[]
  isConnected: boolean
  error: string | null
  clearLogs: () => void
}

/**
 * 日志流订阅 Hook
 */
export function useLogStream(sessionId: string | null): UseLogStreamResult {
  const [rawLogs, setRawLogs] = useState<LogMsg[]>([])
  const [normalizedLogs, setNormalizedLogs] = useState<NormalizedEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const clearLogs = useCallback(() => {
    setRawLogs([])
    setNormalizedLogs([])
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false)
      return
    }

    const subscribe = async () => {
      try {
        // 获取历史日志
        const history = await window.api.logStream.getHistory(sessionId)
        if (Array.isArray(history)) {
          processMessages(history)
        }

        // 订阅实时日志
        const result = await window.api.logStream.subscribe(sessionId)
        if (result.success) {
          setIsConnected(true)
          setError(null)
        } else {
          setError(result.error || 'Failed to subscribe')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    const processMessages = (messages: LogMsg[]) => {
      const raw: LogMsg[] = []
      const normalized: NormalizedEntry[] = []

      for (const msg of messages) {
        if (msg.type === 'stdout' || msg.type === 'stderr') {
          raw.push(msg)
        } else if (msg.type === 'normalized' && msg.entry) {
          normalized.push(msg.entry)
        }
      }

      setRawLogs((prev) => [...prev, ...raw])
      setNormalizedLogs((prev) => [...prev, ...normalized])
    }

    // 监听实时消息
    const removeListener = window.api.logStream.onMessage((sid, msg) => {
      if (sid === sessionId) {
        processMessages([msg as LogMsg])
      }
    })
    unsubscribeRef.current = removeListener

    // 清空并订阅
    clearLogs()
    subscribe()

    return () => {
      // 取消订阅
      window.api.logStream.unsubscribe(sessionId)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      setIsConnected(false)
    }
  }, [sessionId, clearLogs])

  return {
    rawLogs,
    normalizedLogs,
    isConnected,
    error,
    clearLogs
  }
}
