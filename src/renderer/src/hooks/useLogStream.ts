import { useState, useEffect, useCallback, useRef } from 'react'
import type { NormalizedEntry } from '@/components/cli/logTypes'

type ContentLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | ContentLike[]
  | Record<string, unknown>

function stringifyContentPart(part: ContentLike): string {
  if (part === null || part === undefined) return ''
  if (typeof part === 'string') return part
  if (typeof part === 'number' || typeof part === 'boolean') {
    return String(part)
  }
  if (Array.isArray(part)) {
    return part.map(stringifyContentPart).join('')
  }
  if (typeof part === 'object') {
    const record = part as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
    if (typeof record.value === 'string') return record.value
    if (Array.isArray(record.content)) {
      return record.content.map((item) => stringifyContentPart(item as ContentLike)).join('')
    }
    try {
      return JSON.stringify(part)
    } catch {
      return String(part)
    }
  }
  return String(part)
}

function normalizeLogEntry(entry: NormalizedEntry): NormalizedEntry {
  const normalizedContent = stringifyContentPart(entry.content as unknown as ContentLike)
  const metadata = entry.metadata ? { ...entry.metadata } : undefined
  if (metadata) {
    const keys: Array<keyof NonNullable<NormalizedEntry['metadata']>> = [
      'toolName',
      'filePath',
      'command',
    ]
    for (const key of keys) {
      const value = metadata[key]
      if (value !== undefined && typeof value !== 'string') {
        metadata[key] = stringifyContentPart(value as ContentLike)
      }
    }
  }
  if (normalizedContent === entry.content && metadata === entry.metadata) {
    return entry
  }
  return {
    ...entry,
    content: normalizedContent,
    metadata,
  }
}

function getLogPreview(msg: LogMsg): string | undefined {
  if (typeof msg.content === 'string') {
    return msg.content.replace(/\s+/g, ' ').slice(0, 160)
  }
  if (msg.entry?.content) {
    return String(msg.entry.content).replace(/\s+/g, ' ').slice(0, 160)
  }
  return undefined
}

function logMessageDebug(label: string, seq: number, msg: LogMsg, extra?: Record<string, unknown>) {
  console.log(`[useLogStream] ${label}`, {
    seq,
    type: msg.type,
    id: msg.id,
    sessionId: msg.session_id,
    taskId: msg.task_id,
    timestamp: msg.timestamp,
    createdAt: msg.created_at,
    preview: getLogPreview(msg),
    ...extra
  })
}

/**
 * 日志消息类型
 */
export interface LogMsg {
  type: 'stdout' | 'stderr' | 'normalized' | 'finished'
  id?: string
  task_id?: string
  session_id?: string
  created_at?: string
  schema_version?: string
  meta?: Record<string, unknown>
  content?: string
  timestamp?: number
  entry?: NormalizedEntry
  exit_code?: number
}

export interface UseLogStreamResult {
  logs: LogMsg[]
  isConnected: boolean
  error: string | null
  clearLogs: () => void
  resubscribe: (options?: { clear?: boolean; includeHistory?: boolean }) => Promise<void>
}

export interface UseLogStreamOptions {
  source?: 'session' | 'file'
  pollIntervalMs?: number
}

/**
 * 日志流订阅 Hook
 */
export function useLogStream(
  sessionId: string | null,
  taskId?: string | null,
  options?: UseLogStreamOptions
): UseLogStreamResult {
  const source = options?.source ?? 'session'
  const pollIntervalMs = options?.pollIntervalMs ?? 1000
  const [logs, setLogs] = useState<LogMsg[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId)
  const taskIdRef = useRef<string | null>(taskId ?? null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const messageSeqRef = useRef(0)
  const historyLoadedRef = useRef(false)
  const pendingMessagesRef = useRef<LogMsg[]>([])

  // 保持 sessionId ref 同步
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    taskIdRef.current = taskId ?? null
  }, [taskId])

  const clearLogs = useCallback(() => {
    setLogs([])
    seenIdsRef.current = new Set()
    messageSeqRef.current = 0
    historyLoadedRef.current = false
    pendingMessagesRef.current = []
  }, [])

  const processMessages = useCallback((messages: LogMsg[]) => {
    const nextLogs: LogMsg[] = []
    const currentSessionId = sessionIdRef.current

    for (const msg of messages) {
      const seq = ++messageSeqRef.current
      logMessageDebug('processMessages', seq, msg)
      if (source !== 'file' && currentSessionId && msg.session_id && msg.session_id !== currentSessionId) {
        continue
      }
      if (msg.id) {
        if (seenIdsRef.current.has(msg.id)) {
          continue
        }
        seenIdsRef.current.add(msg.id)
      }
      if (msg.type === 'normalized' && msg.entry) {
        nextLogs.push({ ...msg, entry: normalizeLogEntry(msg.entry) })
      } else {
        nextLogs.push(msg)
      }
    }

    if (nextLogs.length > 0) {
      setLogs((prev) => [...prev, ...nextLogs])
    }
  }, [source])

  const setLogsFromHistory = useCallback((messages: LogMsg[]) => {
    const nextLogs: LogMsg[] = []
    for (const msg of messages) {
      const seq = ++messageSeqRef.current
      logMessageDebug('history', seq, msg)
      if (msg.type === 'normalized' && msg.entry) {
        nextLogs.push({ ...msg, entry: normalizeLogEntry(msg.entry) })
      } else {
        nextLogs.push(msg)
      }
    }

    setLogs(nextLogs)
    seenIdsRef.current = new Set(messages.map((msg) => msg.id).filter(Boolean) as string[])
  }, [])

  const subscribe = useCallback(async (options?: { includeHistory?: boolean }) => {
    const currentSessionId = sessionIdRef.current
    const currentTaskId = taskIdRef.current
    if (!currentSessionId && !currentTaskId) {
      console.log('[useLogStream] No sessionId or taskId, skipping subscribe')
      return
    }

    try {
      historyLoadedRef.current = false
      pendingMessagesRef.current = []
      // 获取历史日志
      const includeHistory = options?.includeHistory ?? true
      if (includeHistory && currentTaskId) {
        const historySessionId = source === 'file' ? null : currentSessionId ?? null
        console.log('[useLogStream] Getting history for:', { taskId: currentTaskId, sessionId: historySessionId })
        const history = await window.api.logStream.getHistory(currentTaskId, historySessionId)
        console.log('[useLogStream] History received:', history?.length || 0, 'messages')
        if (Array.isArray(history) && history.length > 0) {
          console.log('[useLogStream] History sample:', history[history.length - 1])
          setLogsFromHistory(history as LogMsg[])
        }
      }

      historyLoadedRef.current = true
      if (pendingMessagesRef.current.length > 0) {
        processMessages(pendingMessagesRef.current)
        pendingMessagesRef.current = []
      }

      if (source === 'file' || !currentSessionId) {
        setIsConnected(false)
        return
      }

      // 订阅实时日志
      console.log('[useLogStream] Subscribing to:', currentSessionId)
      const result = await window.api.logStream.subscribe(currentSessionId)
      console.log('[useLogStream] Subscribe result:', result)
      if (result.success) {
        setIsConnected(true)
        setError(null)
      } else {
        setError(result.error || 'Failed to subscribe')
      }
    } catch (err) {
      console.error('[useLogStream] Subscribe error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [processMessages, setLogsFromHistory, source])

  const resubscribe = useCallback(
    async (options?: { clear?: boolean; includeHistory?: boolean }) => {
      const currentSessionId = sessionIdRef.current
      const currentTaskId = taskIdRef.current
      if (!currentSessionId && !currentTaskId) return
      const clear = options?.clear ?? true
      if (clear) {
        clearLogs()
      }
      if (currentSessionId) {
        try {
          await window.api.logStream.unsubscribe(currentSessionId)
        } catch {
          // ignore unsubscribe errors
        }
      }
      await subscribe({ includeHistory: options?.includeHistory })
    },
    [clearLogs, subscribe]
  )

  useEffect(() => {
    if (!sessionId && !taskId) {
      setIsConnected(false)
      return
    }

      if (source === 'session' && sessionId) {
      // 监听实时消息
      const removeListener = window.api.logStream.onMessage((sid, msg) => {
        if (sid === sessionId) {
          const seq = ++messageSeqRef.current
          logMessageDebug('onMessage', seq, msg as LogMsg, { buffered: !historyLoadedRef.current })
          if (!historyLoadedRef.current) {
            pendingMessagesRef.current.push(msg as LogMsg)
            return
          }
          processMessages([msg as LogMsg])
        }
      })
      unsubscribeRef.current = removeListener
    }

    // 初始订阅（包含历史）
    subscribe()

      if (source === 'file' && taskId) {
        const poll = async () => {
          try {
            const history = await window.api.logStream.getHistory(taskId, null)
            if (Array.isArray(history) && history.length > 0) {
              console.log('[useLogStream] File poll sample:', history[history.length - 1])
              setLogsFromHistory(history as LogMsg[])
            }
          } catch (err) {
            console.error('[useLogStream] File poll error:', err)
          }
        }
      pollTimerRef.current = window.setInterval(poll, pollIntervalMs)
    }

    return () => {
      if (sessionId) {
        // 取消订阅
        window.api.logStream.unsubscribe(sessionId)
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      setIsConnected(false)
    }
  }, [processMessages, pollIntervalMs, sessionId, setLogsFromHistory, source, subscribe, taskId])

  return {
    logs,
    isConnected,
    error,
    clearLogs,
    resubscribe
  }
}
