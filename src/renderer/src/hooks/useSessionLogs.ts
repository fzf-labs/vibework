import { useEffect, useState } from 'react'
import { readSessionLogs, type SessionLogEntry } from '@/lib/session-logs'

export function useSessionLogs(taskId: string | null, pollMs = 1000): SessionLogEntry[] {
  const [logs, setLogs] = useState<SessionLogEntry[]>([])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      if (!taskId) {
        if (active) setLogs([])
        return
      }
      try {
        const entries = await readSessionLogs(taskId)
        if (active) setLogs(entries)
      } catch {
        if (active) setLogs([])
      }
    }

    load()
    timer = setInterval(load, pollMs)

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [pollMs, taskId])

  return logs
}
