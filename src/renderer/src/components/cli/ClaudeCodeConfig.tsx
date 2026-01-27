import React, { useState, useEffect, useCallback } from 'react'

interface ClaudeCodeConfigProps {
  onClose?: () => void
}

const ClaudeCodeConfig: React.FC<ClaudeCodeConfigProps> = ({ onClose }): JSX.Element => {
  const [config, setConfig] = useState({
    executablePath: 'claude',
    defaultModel: 'sonnet'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.claudeCode.getConfig()
      setConfig(result)
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.claudeCode.saveConfig(config)
      alert('配置已保存')
      onClose?.()
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>加载中...</div>
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: '600' }}>Claude Code 配置</h2>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: '500' }}>
          可执行文件路径
        </label>
        <input
          type="text"
          value={config.executablePath}
          onChange={(e) => setConfig({ ...config, executablePath: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #E8E8E8',
            borderRadius: 4
          }}
          placeholder="claude"
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: '500' }}>
          默认模型
        </label>
        <select
          value={config.defaultModel}
          onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #E8E8E8',
            borderRadius: 4
          }}
        >
          <option value="sonnet">Sonnet</option>
          <option value="opus">Opus</option>
          <option value="haiku">Haiku</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              color: '#0D0D0D',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E8E8',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            color: '#FFFFFF',
            backgroundColor: '#E42313',
            border: 'none',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

export default ClaudeCodeConfig
