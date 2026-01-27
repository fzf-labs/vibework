import { useState, useEffect, useCallback } from 'react'
import { cliToolService } from '@/services'
import type { CLIToolInfo, CLISession } from '@/types'

export const useCLITools = () => {
  const [tools, setTools] = useState<CLIToolInfo[]>([])
  const [sessions, setSessions] = useState<CLISession[]>([])
  const [loading, setLoading] = useState(false)

  const detectTools = useCallback(async () => {
    setLoading(true)
    try {
      const detected = await cliToolService.detectAll()
      setTools(detected)
    } catch (err) {
      console.error('检测工具失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const data = await cliToolService.getSessions()
      setSessions(data)
    } catch (err) {
      console.error('加载会话失败:', err)
    }
  }, [])

  const startSession = useCallback(async (
    toolName: string,
    projectPath: string,
    args?: string[]
  ) => {
    try {
      const sessionId = await cliToolService.startSession(toolName, projectPath, args)
      await loadSessions()
      return sessionId
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '启动会话失败')
    }
  }, [loadSessions])

  const stopSession = useCallback(async (sessionId: string) => {
    try {
      await cliToolService.stopSession(sessionId)
      await loadSessions()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '停止会话失败')
    }
  }, [loadSessions])

  useEffect(() => {
    detectTools()
    loadSessions()
  }, [detectTools, loadSessions])

  return {
    tools,
    sessions,
    loading,
    detectTools,
    startSession,
    stopSession,
  }
}
