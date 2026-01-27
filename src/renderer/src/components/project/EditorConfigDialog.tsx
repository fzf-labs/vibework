import React, { useState } from 'react'
import { Project } from '../../types/project'
import EditorSelector from './EditorSelector'

interface EditorConfigDialogProps {
  project: Project
  open: boolean
  onClose: () => void
  onSave: (editorCommand: string) => void
}

const EditorConfigDialog: React.FC<EditorConfigDialogProps> = ({
  project,
  open,
  onClose,
  onSave
}): JSX.Element | null => {
  const [selectedEditor, setSelectedEditor] = useState<string>(
    () => project.config.editor?.path || ''
  )

  const handleSave = (): void => {
    if (selectedEditor) {
      onSave(selectedEditor)
      onClose()
    }
  }

  if (!open) return null

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
          padding: '24px',
          width: '500px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '20px',
            fontWeight: '600',
            color: '#0D0D0D',
            marginBottom: '16px'
          }}
        >
          配置编辑器
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              fontFamily: 'Inter',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0D0D0D',
              marginBottom: '8px',
              display: 'block'
            }}
          >
            选择默认编辑器
          </label>
          <EditorSelector value={selectedEditor} onChange={setSelectedEditor} />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #E8E8E8',
              backgroundColor: '#FFFFFF',
              color: '#0D0D0D',
              cursor: 'pointer',
              fontFamily: 'Inter',
              fontSize: '14px'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedEditor}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: selectedEditor ? '#2563EB' : '#E8E8E8',
              color: '#FFFFFF',
              cursor: selectedEditor ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter',
              fontSize: '14px'
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditorConfigDialog
