import React, { useEffect, useState } from 'react'

interface EditorInfo {
  type: 'vscode' | 'cursor' | 'webstorm' | 'idea' | 'other'
  name: string
  path: string
  command: string
  available: boolean
}

interface EditorSelectorProps {
  value?: string
  onChange: (command: string) => void
}

const EditorSelector: React.FC<EditorSelectorProps> = ({ value, onChange }) => {
  const [editors, setEditors] = useState<EditorInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEditors()
  }, [])

  const loadEditors = async () => {
    try {
      const availableEditors = await window.api.editor.getAvailable()
      setEditors(availableEditors)
    } catch (error) {
      console.error('Failed to load editors:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '8px', color: '#7A7A7A' }}>加载编辑器列表...</div>
  }

  if (editors.length === 0) {
    return (
      <div style={{ padding: '8px', color: '#7A7A7A' }}>
        未检测到可用的编辑器
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {editors.map((editor) => (
        <label
          key={editor.command}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            border: '1px solid #E8E8E8',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: value === editor.command ? '#F0F7FF' : '#FAFAFA'
          }}
        >
          <input
            type="radio"
            name="editor"
            value={editor.command}
            checked={value === editor.command}
            onChange={(e) => onChange(e.target.value)}
            style={{ cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              {editor.name}
            </span>
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#7A7A7A'
              }}
            >
              {editor.path}
            </span>
          </div>
        </label>
      ))}
    </div>
  )
}

export default EditorSelector
