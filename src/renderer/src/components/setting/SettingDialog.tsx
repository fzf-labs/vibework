import React, { useState, useEffect } from 'react'
import { CLIToolInfo } from '../../types/cli'
import GenericCLIToolConfig from '../cli/GenericCLIToolConfig'

interface SettingsDialogProps {
  onClose: () => void
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('general')
  const [cliTools, setCLITools] = useState<CLIToolInfo[]>([])
  const [detecting, setDetecting] = useState(false)
  const [configToolId, setConfigToolId] = useState<string | null>(null)

  useEffect(() => {
    if (activeSection === 'cli-tools') {
      loadCLITools()
    }
  }, [activeSection])

  const loadCLITools = async () => {
    try {
      const tools = await window.api.cliTools.getAll()
      setCLITools(tools)
      // 自动检测工具状态
      detectAllTools()
    } catch (error) {
      console.error('Failed to load CLI tools:', error)
    }
  }

  const detectAllTools = async () => {
    setDetecting(true)
    try {
      const detectedTools = await window.api.cliTools.detectAll()
      setCLITools(detectedTools)
    } catch (error) {
      console.error('Failed to detect tools:', error)
    } finally {
      setDetecting(false)
    }
  }

  const handleOpenConfig = (toolId: string) => {
    setConfigToolId(toolId)
  }

  const handleCloseConfig = () => {
    setConfigToolId(null)
    detectAllTools() // 重新检测配置状态
  }

  const sections = [
    { id: 'general', label: '通用' },
    { id: 'cli-tools', label: 'CLI 工具' },
    { id: 'notifications', label: '通知' },
    { id: 'appearance', label: '外观' }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: '600' }}>通用设置</h2>
            <p style={{ color: '#7A7A7A', fontSize: 14 }}>通用设置内容待实现</p>
          </div>
        )

      case 'cli-tools':
        return (
          <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: '600' }}>CLI 工具配置</h2>
                <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#7A7A7A' }}>
                  全局配置 AI CLI 工具
                </p>
              </div>
              <button
                onClick={detectAllTools}
                disabled={detecting}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cliTools.map((tool) => (
                <div
                  key={tool.id}
                  style={{
                    padding: 16,
                    border: '1px solid #E8E8E8',
                    borderRadius: 6,
                    backgroundColor: tool.installed ? '#FAFAFA' : '#F5F5F5'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: '600', color: '#0D0D0D', marginBottom: 4 }}>
                        {tool.displayName}
                      </div>
                      <div style={{ fontSize: 12, color: '#7A7A7A', marginBottom: 8 }}>
                        {tool.description}
                      </div>
                      <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginBottom: 8 }}>
                        {tool.command}
                      </div>

                      {/* Status badges */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px',
                          fontSize: 11,
                          borderRadius: 4,
                          backgroundColor: tool.installed ? '#E8F5E9' : '#FFEBEE',
                          color: tool.installed ? '#2E7D32' : '#C62828'
                        }}>
                          {tool.installed ? `已安装 ${tool.version || ''}` : '未安装'}
                        </span>
                        {tool.installed && (
                          <span style={{
                            padding: '2px 8px',
                            fontSize: 11,
                            borderRadius: 4,
                            backgroundColor: tool.configValid ? '#E3F2FD' : '#FFF3E0',
                            color: tool.configValid ? '#1565C0' : '#E65100'
                          }}>
                            {tool.configValid ? '配置正常' : '配置缺失'}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenConfig(tool.id)}
                      style={{
                        padding: '6px 16px',
                        fontSize: 13,
                        color: '#0D0D0D',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E8E8E8',
                        borderRadius: 4,
                        cursor: 'pointer',
                        marginLeft: 16
                      }}
                    >
                      配置
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: '600' }}>通知设置</h2>
            <p style={{ color: '#7A7A7A', fontSize: 14 }}>通知设置内容待实现</p>
          </div>
        )

      case 'appearance':
        return (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: '600' }}>外观设置</h2>
            <p style={{ color: '#7A7A7A', fontSize: 14 }}>外观设置内容待实现</p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '800px',
          height: '600px',
          maxWidth: '90%',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E8E8E8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: '600' }}>设置</h1>
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              fontSize: 18,
              color: '#7A7A7A',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <div
            style={{
              width: 200,
              borderRight: '1px solid #E8E8E8',
              padding: '16px 0',
              backgroundColor: '#FAFAFA'
            }}
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: '100%',
                  padding: '10px 24px',
                  fontSize: 14,
                  textAlign: 'left',
                  color: activeSection === section.id ? '#E42313' : '#0D0D0D',
                  backgroundColor: activeSection === section.id ? '#FFF5F5' : 'transparent',
                  border: 'none',
                  borderLeft: activeSection === section.id ? '3px solid #E42313' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeSection === section.id ? '600' : '400'
                }}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Config Dialog */}
      {configToolId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}
          onClick={handleCloseConfig}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              maxWidth: 600,
              width: '90%'
            }}
          >
            <GenericCLIToolConfig
              toolId={configToolId}
              toolName={cliTools.find(t => t.id === configToolId)?.displayName || ''}
              onClose={handleCloseConfig}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsDialog
