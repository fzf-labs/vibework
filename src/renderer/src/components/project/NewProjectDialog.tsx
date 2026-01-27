import React, { useState } from 'react'
import type { NewProjectInput } from '../../types/project'

interface NewProjectDialogProps {
  onClose: () => void
  onSubmit: (project: NewProjectInput) => void
}

const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ onClose, onSubmit }): JSX.Element => {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (): void => {
    if (!name || !path) {
      alert('Please fill in all required fields')
      return
    }

    onSubmit({
      name,
      path,
      type: 'local',
      description,
      config: {}
    })
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
          padding: '32px',
          width: '500px',
          maxWidth: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '24px',
            fontWeight: '600',
            color: '#0D0D0D',
            margin: '0 0 24px 0'
          }}
        >
          New Project
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: '12px',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                fontFamily: 'Inter',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              Project Path *
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              style={{
                padding: '12px',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                fontFamily: 'Inter',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                padding: '12px',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                fontFamily: 'Inter',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#FFFFFF',
                color: '#0D0D0D',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                fontFamily: 'Space Grotesk',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#E42313',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'Space Grotesk',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewProjectDialog
