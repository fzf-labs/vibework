import React, { useState } from 'react'
import { CLITool } from '../../types/cli'

interface CLIToolConfigProps {
  onClose: () => void
}

const CLIToolConfig: React.FC<CLIToolConfigProps> = ({ onClose }): JSX.Element => {
  const [tools, setTools] = useState<CLITool[]>([
    {
      id: '1',
      name: 'Claude Code',
      command: 'claude',
      args: [],
      enabled: true,
      type: 'claude-code'
    },
    {
      id: '2',
      name: 'Gemini CLI',
      command: 'gemini',
      args: [],
      enabled: false,
      type: 'gemini-cli'
    }
  ])

  const [editingTool, setEditingTool] = useState<CLITool | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const handleToggleTool = (toolId: string): void => {
    setTools(tools.map((tool) => (tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool)))
  }

  const handleEditTool = (tool: CLITool): void => {
    setEditingTool(tool)
  }

  const handleSaveTool = (updatedTool: CLITool): void => {
    setTools(tools.map((tool) => (tool.id === updatedTool.id ? updatedTool : tool)))
    setEditingTool(null)
  }

  const handleAddTool = (newTool: Omit<CLITool, 'id'>): void => {
    const tool: CLITool = {
      ...newTool,
      id: Date.now().toString()
    }
    setTools([...tools, tool])
    setShowAddDialog(false)
  }

  const handleDeleteTool = (toolId: string): void => {
    setTools(tools.filter((tool) => tool.id !== toolId))
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
          borderRadius: 8,
          width: 700,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E8E8E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: '600',
              color: '#0D0D0D'
            }}
          >
            CLI 工具配置
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              color: '#7A7A7A',
              cursor: 'pointer',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tools.map((tool) => (
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
                    onClick={() => handleEditTool(tool)}
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
          </div>

          <button
            onClick={() => setShowAddDialog(true)}
            style={{
              marginTop: 16,
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

interface CLIToolEditDialogProps {
  tool: CLITool
  onSave: (tool: CLITool) => void
  onCancel: () => void
}

const CLIToolEditDialog: React.FC<CLIToolEditDialogProps> = ({
  tool,
  onSave,
  onCancel
}): JSX.Element => {
  const [formData, setFormData] = useState(tool)

  const handleSubmit = (e: React.FormEvent): void => {
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

interface CLIToolAddDialogProps {
  onAdd: (tool: Omit<CLITool, 'id'>) => void
  onCancel: () => void
}

const CLIToolAddDialog: React.FC<CLIToolAddDialogProps> = ({ onAdd, onCancel }): JSX.Element => {
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    args: [] as string[],
    enabled: true,
    type: 'other' as CLITool['type']
  })

  const handleSubmit = (e: React.FormEvent): void => {
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
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as CLITool['type'] })
              }
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

export default CLIToolConfig
