import React, { useState, useEffect } from 'react'
import { CLITool, CLISession } from '../types/cli'
import CLIOutputViewer from '../components/cli/CLIOutputViewer'

const CLITools: React.FC = () => {
  const [tools, setTools] = useState<CLITool[]>([])
  const [sessions, setSessions] = useState<CLISession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = () => {
    // 从本地存储加载工具配置
    const savedTools = localStorage.getItem('cliTools')
    if (savedTools) {
      setTools(JSON.parse(savedTools))
    } else {
      // 默认工具
      const defaultTools: CLITool[] = [
        {
          id: '1',
          name: 'Claude Code',
          command: 'claude',
          args: [],
          enabled: true,
          type: 'claude-code'
        }
      ]
      setTools(defaultTools)
      localStorage.setItem('cliTools', JSON.stringify(defaultTools))
    }
  }

  const handleStartSession = async (tool: CLITool) => {
    const sessionId = `${tool.id}-${Date.now()}`
    const projectPath = '/path/to/project' // TODO: 从当前项目获取

    try {
      await window.api.cli.startSession(sessionId, tool.command, tool.args || [], projectPath)

      const newSession: CLISession = {
        id: sessionId,
        toolId: tool.id,
        projectId: 'current-project',
        status: 'running',
        startTime: new Date(),
        output: []
      }

      setSessions([...sessions, newSession])
      setSelectedSession(sessionId)
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: '700', color: '#0D0D0D' }}>
          CLI 工具
        </h1>
        <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#7A7A7A' }}>
          运行 AI 编程助手工具 (在设置中配置工具)
        </p>
      </div>

      {/* Tools Grid */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: '600', color: '#0D0D0D' }}>
          可用工具
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tools.filter(t => t.enabled).map((tool) => (
            <div
              key={tool.id}
              style={{
                padding: 20,
                border: '1px solid #E8E8E8',
                borderRadius: 8,
                backgroundColor: '#FAFAFA'
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: '600', color: '#0D0D0D', marginBottom: 4 }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: 12, color: '#7A7A7A' }}>
                  {tool.command} {tool.args?.join(' ')}
                </div>
              </div>
              <button
                onClick={() => handleStartSession(tool)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  fontSize: 14,
                  color: '#E42313',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E42313',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                启动会话
              </button>
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
                {tools.find(t => t.id === session.toolId)?.name} - {session.id.slice(-8)}
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
