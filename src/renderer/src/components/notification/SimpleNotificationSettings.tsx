/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'

interface NotificationPreferences {
  enabled: boolean
  showSuccess: boolean
  showInfo: boolean
  showWarning: boolean
  showError: boolean
  maxNotifications: number
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  showSuccess: true,
  showInfo: true,
  showWarning: true,
  showError: true,
  maxNotifications: 100
}

// 辅助组件
interface SettingSectionProps {
  title: string
  children: React.ReactNode
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, children }): JSX.Element => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2
        style={{
          fontFamily: 'Space Grotesk',
          fontSize: '18px',
          fontWeight: '600',
          color: '#0D0D0D',
          margin: 0
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
    </div>
  )
}

interface SettingToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false
}): JSX.Element => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: disabled ? '#F5F5F5' : '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: '8px',
        opacity: disabled ? 0.6 : 1
      }}
    >
      <div>
        <div style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: '#7A7A7A' }}>{description}</div>
      </div>
      <label
        style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            cursor: disabled ? 'not-allowed' : 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? '#E42313' : '#E8E8E8',
            transition: '0.3s',
            borderRadius: '24px'
          }}
        >
          <span
            style={{
              position: 'absolute',
              content: '',
              height: '18px',
              width: '18px',
              left: checked ? '23px' : '3px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: '0.3s',
              borderRadius: '50%'
            }}
          />
        </span>
      </label>
    </div>
  )
}

export function SimpleNotificationSettings(): JSX.Element {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  const loadPreferences = useCallback((): void => {
    try {
      const stored = localStorage.getItem('notification-preferences')
      if (stored) {
        setPreferences(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    }
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadPreferences()
    }, 0)
    return () => clearTimeout(initialLoad)
  }, [loadPreferences])

  const savePreferences = (newPreferences: NotificationPreferences): void => {
    try {
      localStorage.setItem('notification-preferences', JSON.stringify(newPreferences))
      setPreferences(newPreferences)
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
    }
  }

  const handleToggle = (key: keyof NotificationPreferences, value: boolean | number): void => {
    const newPreferences = { ...preferences, [key]: value }
    savePreferences(newPreferences)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 通知总开关 */}
      <SettingSection title="通知设置">
        <SettingToggle
          label="启用通知"
          description="开启后将显示系统通知"
          checked={preferences.enabled}
          onChange={(value) => handleToggle('enabled', value)}
        />
      </SettingSection>

      {/* 通知类型设置 */}
      <SettingSection title="通知类型">
        <SettingToggle
          label="成功通知"
          description="显示操作成功的通知"
          checked={preferences.showSuccess}
          onChange={(value) => handleToggle('showSuccess', value)}
          disabled={!preferences.enabled}
        />
        <SettingToggle
          label="信息通知"
          description="显示一般信息通知"
          checked={preferences.showInfo}
          onChange={(value) => handleToggle('showInfo', value)}
          disabled={!preferences.enabled}
        />
        <SettingToggle
          label="警告通知"
          description="显示警告类通知"
          checked={preferences.showWarning}
          onChange={(value) => handleToggle('showWarning', value)}
          disabled={!preferences.enabled}
        />
        <SettingToggle
          label="错误通知"
          description="显示错误类通知"
          checked={preferences.showError}
          onChange={(value) => handleToggle('showError', value)}
          disabled={!preferences.enabled}
        />
      </SettingSection>

      {/* 其他设置 */}
      <SettingSection title="其他设置">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: '#FAFAFA',
            border: '1px solid #E8E8E8',
            borderRadius: '8px'
          }}
        >
          <div>
            <div style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '4px' }}>
              最大通知数量
            </div>
            <div style={{ fontSize: '13px', color: '#7A7A7A' }}>超过此数量的旧通知将被自动删除</div>
          </div>
          <select
            value={preferences.maxNotifications}
            onChange={(e) => handleToggle('maxNotifications', Number(e.target.value))}
            style={{
              padding: '8px 12px',
              border: '1px solid #E8E8E8',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </SettingSection>
    </div>
  )
}
