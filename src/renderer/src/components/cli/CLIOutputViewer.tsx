import React, { useState, useEffect, useRef } from 'react'
import { CLISession } from '../../types/cli'

interface CLIOutputViewerProps {
  sessionId: string
  onClose?: () => void
}

const CLIOutputViewer: React.FC<CLIOutputViewerProps> = ({ sessionId, onClose }) => {
  const [output, setOutput] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(true)
  const outputEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 初始加载输出
    loadOutput()

    // 定时刷新输出
    const interval = setInterval(() => {
      if (isRunning) {
        loadOutput()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionId, isRunning])

  useEffect(() => {
    // 自动滚动到底部
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  const loadOutput = async () => {
    try {
      const result = await window.api.cli.getOutput(sessionId)
      setOutput(result)
    } catch (error) {
      console.error('Failed to load output:', error)
    }
  }

  const handleStop = async () => {
    try {
      await window.api.cli.stopSession(sessionId)
      setIsRunning(false)
    } catch (error) {
      console.error('Failed to stop session:', error)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E8E8',
        borderRadius: 6,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E8E8E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FAFAFA'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isRunning ? '#4CAF50' : '#7A7A7A'
            }}
          />
          <span style={{ fontSize: 14, fontWeight: '600', color: '#0D0D0D' }}>
            CLI 输出 - {sessionId}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isRunning && (
            <button
              onClick={handleStop}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                color: '#FFFFFF',
                backgroundColor: '#E42313',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              停止
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                color: '#7A7A7A',
                backgroundColor: 'transparent',
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div
        style={{
          flex: 1,
          padding: 16,
          overflowY: 'auto',
          backgroundColor: '#1E1E1E',
          fontFamily: 'Monaco, Menlo, "Courier New", monospace',
          fontSize: 12,
          lineHeight: 1.6,
          color: '#D4D4D4'
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: '#7A7A7A', fontStyle: 'italic' }}>等待输出...</div>
        ) : (
          output.map((line, index) => (
            <div key={index} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line}
            </div>
          ))
        )}
        <div ref={outputEndRef} />
      </div>
    </div>
  )
}

export default CLIOutputViewer
