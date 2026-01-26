import React, { useState, useEffect } from 'react'
import { CLITool } from '../../types/cli'

interface SettingsDialogProps {
  onClose: () => void
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('general')
  const [cliTools, setCLITools] = useState<CLITool[]>([])
  const [editingTool, setEditingTool] = useState<CLITool | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    loadCLITools()
  }, [])

  const loadCLITools = () => {
    const savedTools = localStorage.getItem('cliTools')
    if (savedTools) {
      setCLITools(JSON.parse(savedTools))
    } else {
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
      setCLITools(defaultTools)
      localStorage.setItem('cliTools', JSON.stringify(defaultTools))
    }
  }

  const saveCLITools = (tools: CLITool[]) => {
    setCLITools(tools)
    localStorage.setItem('cliTools', JSON.stringify(tools))
  }

  const handleToggleTool = (toolId: string) => {
    const updatedTools = cliTools.map((tool) =>
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    )
    saveCLITools(updatedTools)
  }

  const handleSaveTool = (updatedTool: CLITool) => {
    const updatedTools = cliTools.map((tool) => (tool.id === updatedTool.id ? updatedTool : tool))
    saveCLITools(updatedTools)
    setEditingTool(null)
  }

  const handleAddTool = (newTool: Omit<CLITool, 'id'>) => {
    const tool: CLITool = {
      ...newTool,
      id: Date.now().toString()
    }
    saveCLITools([...cliTools, tool])
    setShowAddDialog(false)
  }

  const handleDeleteTool = (toolId: string) => {
    const updatedTools = cliTools.filter((tool) => tool.id !== toolId)
    saveCLITools(updatedTools)
  }

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'cli-tools', label: 'CLI Tools' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' }
  ]

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
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #E8E8E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2
            style={{
              fontFamily: 'Space Grotesk',
              fontSize: '24px',
              fontWeight: '600',
              color: '#0D0D0D',
              margin: 0
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#7A7A7A'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: '200px',
              borderRight: '1px solid #E8E8E8',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {sections.map((section) => (
              <div
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: activeSection === section.id ? '#E42313' : 'transparent',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    fontFamily: 'Space Grotesk',
                    fontSize: '14px',
                    fontWeight: activeSection === section.id ? '500' : 'normal',
                    color: activeSection === section.id ? '#FFFFFF' : '#7A7A7A'
                  }}
                >
                  {section.label}
                </span>
              </div>
            ))}
          </div>

          {/* Settings Content */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              overflowY: 'auto'
            }}
          >
            {activeSection === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <SettingItem label="Language" value="English" />
                <SettingItem label="Theme" value="Light" />
                <SettingItem label="Auto Update" value="Enabled" />
              </div>
            )}

            {activeSection === 'cli-tools' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ marginBottom: 8 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#0D0D0D'
                    }}
                  >
                    CLI 工具配置
                  </h3>
                  <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#7A7A7A' }}>
                    管理 AI 编程助手工具
                  </p>
                </div>

                {cliTools.map((tool) => (
                  <div
                    key={tool.id}
                    style={{
                      padding: 16,
                      border: '1px solid #E8E8E8',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: '#0D0D0D',
                          marginBottom: 4
                        }}
                      >
                        {tool.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#7A7A7A' }}>
                        命令: {tool.command} {tool.args?.join(' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={tool.enabled}
                          onChange={() => handleToggleTool(tool.id)}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ fontSize: 12, color: '#7A7A7A' }}>启用</span>
                      </label>
                      <button
                        onClick={() => setEditingTool(tool)}
                        style={{
                          padding: '4px 12px',
                          fontSize: 12,
                          color: '#E42313',
                          backgroundColor: 'transparent',
                          border: '1px solid #E42313',
                          borderRadius: 4,
                          cursor: 'pointer'
                        }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteTool(tool.id)}
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
                        删除
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setShowAddDialog(true)}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: 12,
                    fontSize: 14,
                    color: '#E42313',
                    backgroundColor: 'transparent',
                    border: '1px dashed #E42313',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  + 添加 CLI 工具
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      {editingTool && (
        <CLIToolEditDialog
          tool={editingTool}
          onSave={handleSaveTool}
          onCancel={() => setEditingTool(null)}
        />
      )}

      {/* Add Dialog */}
      {showAddDialog && (
        <CLIToolAddDialog onAdd={handleAddTool} onCancel={() => setShowAddDialog(false)} />
      )}
    </div>
  )
}

interface SettingItemProps {
  label: string
  value: string
}

const SettingItem: React.FC<SettingItemProps> = ({ label, value }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        backgroundColor: '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: '8px'
      }}
    >
      <span
        style={{
          fontFamily: 'Inter',
          fontSize: '14px',
          color: '#0D0D0D'
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Inter',
          fontSize: '14px',
          color: '#7A7A7A'
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface CLIToolAddDialogProps {
  onAdd: (tool: Omit<CLITool, 'id'>) => void
  onCancel: () => void
}

const CLIToolAddDialog: React.FC<CLIToolAddDialogProps> = ({ onAdd, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    args: [] as string[],
    enabled: true,
    type: 'other' as CLITool['type']
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd(formData)
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
        zIndex: 1001
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          width: 500,
          padding: 24,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: '600', color: '#0D0D0D' }}>
          添加 CLI 工具
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              工具名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              命令
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              参数 (用空格分隔)
            </label>
            <input
              type="text"
              value={formData.args.join(' ')}
              onChange={(e) =>
                setFormData({ ...formData, args: e.target.value.split(' ').filter(Boolean) })
              }
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              工具类型
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CLITool['type'] })}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
            >
              <option value="claude-code">Claude Code</option>
              <option value="gemini-cli">Gemini CLI</option>
              <option value="codex">Codex</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                color: '#7A7A7A',
                backgroundColor: 'transparent',
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: 14,
                color: '#FFFFFF',
                backgroundColor: '#E42313',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface CLIToolEditDialogProps {
  tool: CLITool
  onSave: (tool: CLITool) => void
  onCancel: () => void
}

const CLIToolEditDialog: React.FC<CLIToolEditDialogProps> = ({ tool, onSave, onCancel }) => {
  const [formData, setFormData] = useState(tool)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
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
        zIndex: 1001
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          width: 500,
          padding: 24,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: '600', color: '#0D0D0D' }}>
          编辑 CLI 工具
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              工具名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              命令
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              参数 (用空格分隔)
            </label>
            <input
              type="text"
              value={formData.args?.join(' ') || ''}
              onChange={(e) =>
                setFormData({ ...formData, args: e.target.value.split(' ').filter(Boolean) })
              }
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                color: '#7A7A7A',
                backgroundColor: 'transparent',
                border: '1px solid #E8E8E8',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: 14,
                color: '#FFFFFF',
                backgroundColor: '#E42313',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsDialog
