import React, { useState, useEffect, useCallback } from 'react'
import { CLIToolInfo, CLISession } from '../types/cli'
import CLIOutputViewer from '../components/cli/CLIOutputViewer'
import { notificationStore } from '@/stores/notificationStore'

const CLITools: React.FC = () => {
  const [tools, setTools] = useState<CLIToolInfo[]>([])
  const [sessions, setSessions] = useState<CLISession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)

  const detectAllTools = useCallback(async (): Promise<void> => {
    setDetecting(true)
    try {
      const detectedTools = await window.api.cliTools.detectAll()
      setTools(detectedTools)
    } catch (error) {
      console.error('Failed to detect tools:', error)
    } finally {
      setDetecting(false)
    }
  }, [])

  const loadTools = useCallback(async (): Promise<void> => {
    try {
      const allTools = await window.api.cliTools.getAll()
      setTools(allTools)
      // 延迟执行检测,确保工具列表先显示
      setTimeout(() => {
        detectAllTools()
      }, 100)
    } catch (error) {
      console.error('Failed to load tools:', error)
    }
  }, [detectAllTools])

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const handleStartSession = async (tool: CLIToolInfo): Promise<void> => {
    if (!tool.installed) {
      notificationStore.add({
        type: 'warning',
        title: '工具未安装',
        body: `${tool.displayName} 未安装，请先安装后再使用`
      })
      return
    }

    if (!tool.configValid) {
      notificationStore.add({
        type: 'warning',
        title: '配置无效',
        body: `${tool.displayName} 配置无效，请先配置`
      })
      return
    }

    const sessionId = `${tool.id}-${Date.now()}`
    const projectPath = '/path/to/project' // TODO: 从当前项目获取

    try {
      if (tool.id === 'claude-code') {
        await window.api.claudeCode.startSession(sessionId, projectPath)
      } else {
        await window.api.cli.startSession(sessionId, tool.command, [], projectPath)
      }

      const newSession: CLISession = {
        id: sessionId,
        toolId: tool.id,
        projectId: 'current-project',
        status: 'running',
        startTime: new Date(),
        output: []
      }

      setSessions((prevSessions) => [...prevSessions, newSession])
      setSelectedSession(sessionId)

      // 发送成功通知
      notificationStore.add({
        type: 'success',
        title: 'CLI 会话已启动',
        body: `${tool.displayName} 会话已成功启动`
      })
    } catch (error) {
      console.error('Failed to start session:', error)

      // 发送错误通知
      notificationStore.add({
        type: 'error',
        title: 'CLI 会话启动失败',
        body: error instanceof Error ? error.message : '启动会话时发生错误'
      })
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: '700', color: '#0D0D0D' }}>CLI 工具</h1>
          <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#7A7A7A' }}>
            支持 Claude Code、Codex、Gemini CLI、Cursor Agent
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={detectAllTools}
            disabled={detecting}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              color: '#0D0D0D',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E8E8',
              borderRadius: 4,
              cursor: detecting ? 'not-allowed' : 'pointer',
              opacity: detecting ? 0.6 : 1
            }}
          >
            {detecting ? '检测中...' : '刷新检测'}
          </button>
        </div>
      </div>

      {/* Tools Grid */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: '600', color: '#0D0D0D' }}>
          可用工具
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}
        >
          {tools.map((tool) => (
            <div
              key={tool.id}
              style={{
                padding: 20,
                border: '1px solid #E8E8E8',
                borderRadius: 8,
                backgroundColor: tool.installed ? '#FAFAFA' : '#F5F5F5',
                opacity: tool.installed ? 1 : 0.7
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: '600', color: '#0D0D0D', marginBottom: 4 }}>
                  {tool.displayName}
                </div>
                <div style={{ fontSize: 12, color: '#7A7A7A', marginBottom: 8 }}>
                  {tool.description}
                </div>
                <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>
                  {tool.command}
                </div>
              </div>

              {/* Status badges */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    borderRadius: 4,
                    backgroundColor: tool.installed ? '#E8F5E9' : '#FFEBEE',
                    color: tool.installed ? '#2E7D32' : '#C62828'
                  }}
                >
                  {tool.installed ? `已安装 ${tool.version || ''}` : '未安装'}
                </span>
                {tool.installed && (
                  <span
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      borderRadius: 4,
                      backgroundColor: tool.configValid ? '#E3F2FD' : '#FFF3E0',
                      color: tool.configValid ? '#1565C0' : '#E65100'
                    }}
                  >
                    {tool.configValid ? '配置正常' : '配置缺失'}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleStartSession(tool)}
                disabled={!tool.installed || !tool.configValid}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  fontSize: 14,
                  color: '#FFFFFF',
                  backgroundColor: '#E42313',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !tool.installed || !tool.configValid ? 'not-allowed' : 'pointer',
                  opacity: !tool.installed || !tool.configValid ? 0.5 : 1
                }}
              >
                启动会话
              </button>
              {(!tool.installed || !tool.configValid) && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#7A7A7A', textAlign: 'center' }}>
                  请在设置中配置此工具
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      {sessions.length > 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: '600', color: '#0D0D0D' }}>
            活动会话
          </h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  color: selectedSession === session.id ? '#FFFFFF' : '#0D0D0D',
                  backgroundColor: selectedSession === session.id ? '#E42313' : '#FFFFFF',
                  border: '1px solid #E8E8E8',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                {tools.find((t) => t.id === session.toolId)?.name} - {session.id.slice(-8)}
              </button>
            ))}
          </div>
          {selectedSession && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <CLIOutputViewer sessionId={selectedSession} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CLITools
