import React, { useState } from 'react'
import SettingsDialog from '../settings/SettingsDialog'

interface NavItem {
  id: string
  label: string
  active: boolean
}

interface SidebarProps {
  activeNav: string
  onNavChange: (navId: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({ activeNav, onNavChange }) => {
  const [showSettings, setShowSettings] = useState(false)
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', active: activeNav === 'overview' },
    { id: 'tasks', label: 'Task', active: activeNav === 'tasks' },
    { id: 'skills', label: 'Skill', active: activeNav === 'skills' },
    { id: 'mcps', label: 'MCP', active: activeNav === 'mcps' }
  ]

  return (
    <div
      style={{
        width: '240px',
        height: '100%',
        backgroundColor: '#FAFAFA',
        borderRight: '1px solid #E8E8E8',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onNavChange(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 0',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: item.active ? '#E42313' : 'transparent'
              }}
            />
            <span
              style={{
                fontFamily: 'Space Grotesk',
                fontSize: '14px',
                fontWeight: item.active ? '500' : 'normal',
                color: item.active ? '#0D0D0D' : '#7A7A7A'
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#E42313',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
            <span
              style={{
                fontFamily: 'Space Grotesk',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D'
              }}
            >
              User
            </span>
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#7A7A7A'
              }}
            >
              user@example.com
            </span>
          </div>
          <div
            onClick={() => setShowSettings(true)}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '6px',
              backgroundColor: 'transparent'
            }}
          >
            <span style={{ fontSize: '18px', color: '#7A7A7A' }}>⚙️</span>
          </div>
        </div>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default Sidebar
