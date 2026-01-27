import React, { useState } from 'react'

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('general')

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'cli-tools', label: 'CLI Tools' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <h1
        style={{
          fontFamily: 'Space Grotesk',
          fontSize: '28px',
          fontWeight: '700',
          color: '#0D0D0D',
          margin: 0
        }}
      >
        Settings
      </h1>

      <div style={{ display: 'flex', gap: '32px', height: 'calc(100vh - 200px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {activeSection === 'general' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#0D0D0D',
                    margin: 0
                  }}
                >
                  Application
                </h2>
                <SettingItem label="Language" value="English" />
                <SettingItem label="Theme" value="Light" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#0D0D0D',
                    margin: 0
                  }}
                >
                  Editor
                </h2>
                <SettingItem label="Default Editor" value="VSCode" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#0D0D0D',
                    margin: 0
                  }}
                >
                  Git
                </h2>
                <SettingItem label="Git Path" value="/usr/bin/git" />
              </div>
            </>
          )}
        </div>
      </div>
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
        width: '100%',
        padding: '16px 20px',
        backgroundColor: '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
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

export default Settings
