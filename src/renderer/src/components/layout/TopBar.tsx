import React from 'react'
import ProjectSelector from './ProjectSelector'

const TopBar: React.FC = () => {
  return (
    <div
      style={{
        height: '60px',
        width: '100%',
        borderBottom: '1px solid #E8E8E8',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '18px',
            fontWeight: '600',
            color: '#0D0D0D'
          }}
        >
          VibeWork
        </span>
      </div>

      <ProjectSelector />
    </div>
  )
}

export default TopBar
