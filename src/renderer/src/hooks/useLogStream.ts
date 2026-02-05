import { useState, useEffect, useCallback, useRef } from 'react'
import type { NormalizedEntry } from '@/components/cli/NormalizedLogView'

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
  rawLogs: LogMsg[]
  normalizedLogs: NormalizedEntry[]
  isConnected: boolean
  error: string | null
  clearLogs: () => void
  resubscribe: (options?: { clear?: boolean; includeHistory?: boolean }) => Promise<void>
}

/**
 * 日志流订阅 Hook
 */
export function useLogStream(
  sessionId: string | null,
  taskId?: string | null
): UseLogStreamResult {
  const [rawLogs, setRawLogs] = useState<LogMsg[]>([])
  const [normalizedLogs, setNormalizedLogs] = useState<NormalizedEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId)
  const taskIdRef = useRef<string | null>(taskId ?? null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  // 保持 sessionId ref 同步
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    taskIdRef.current = taskId ?? null
  }, [taskId])

  const clearLogs = useCallback(() => {
    setRawLogs([])
    setNormalizedLogs([])
    seenIdsRef.current = new Set()
  }, [])

  const processMessages = useCallback((messages: LogMsg[]) => {
    const raw: LogMsg[] = []
    const normalized: NormalizedEntry[] = []

    for (const msg of messages) {
      if (msg.id) {
        if (seenIdsRef.current.has(msg.id)) {
          continue
        }
        seenIdsRef.current.add(msg.id)
      }
      if (msg.type === 'stdout' || msg.type === 'stderr') {
        raw.push(msg)
      } else if (msg.type === 'normalized' && msg.entry) {
        normalized.push(normalizeLogEntry(msg.entry))
      }
    }

    setRawLogs((prev) => [...prev, ...raw])
    setNormalizedLogs((prev) => [...prev, ...normalized])
  }, [])

  const subscribe = useCallback(async (options?: { includeHistory?: boolean }) => {
    const currentSessionId = sessionIdRef.current
    const currentTaskId = taskIdRef.current
    if (!currentSessionId && !currentTaskId) {
      console.log('[useLogStream] No sessionId or taskId, skipping subscribe')
      return
    }

    try {
      // 获取历史日志
      const includeHistory = options?.includeHistory ?? true
      if (includeHistory && currentTaskId) {
        console.log('[useLogStream] Getting history for:', { taskId: currentTaskId, sessionId: currentSessionId })
        const history = await window.api.logStream.getHistory(currentTaskId, currentSessionId ?? null)
        console.log('[useLogStream] History received:', history?.length || 0, 'messages')
        if (Array.isArray(history) && history.length > 0) {
          processMessages(history as LogMsg[])
        }
      }

      if (!currentSessionId) {
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
  }, [processMessages])

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

    if (sessionId) {
      // 监听实时消息
      const removeListener = window.api.logStream.onMessage((sid, msg) => {
        if (sid === sessionId) {
          processMessages([msg as LogMsg])
        }
      })
      unsubscribeRef.current = removeListener
    }

    // 初始订阅（包含历史）
    subscribe()

    return () => {
      if (sessionId) {
        // 取消订阅
        window.api.logStream.unsubscribe(sessionId)
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
      setIsConnected(false)
    }
  }, [sessionId, taskId, processMessages, subscribe])

  return {
    rawLogs,
    normalizedLogs,
    isConnected,
    error,
    clearLogs,
    resubscribe
  }
}
