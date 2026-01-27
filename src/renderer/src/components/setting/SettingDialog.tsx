import React, { useState, useEffect, useCallback } from 'react'
import { CLIToolInfo } from '../../types/cli'
import GenericCLIToolConfig from '../cli/GenericCLIToolConfig'

interface SettingsDialogProps {
  onClose: () => void
}

interface GeneralSettings {
  autoSave: boolean
  autoSaveInterval: number
  language: string
  startupBehavior: 'last-project' | 'new-project' | 'project-list'
}

interface NotificationSettings {
  enabled: boolean
  soundEnabled: boolean
  soundSettings: {
    enabled: boolean
    taskComplete: boolean
    stageComplete: boolean
    error: boolean
  }
  showInApp: boolean
  showDesktop: boolean
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto'
  fontSize: number
  fontFamily: string
  accentColor: string
  compactMode: boolean
}

// 样式常量
const COLORS = {
  primary: '#E42313',
  text: '#0D0D0D',
  textSecondary: '#7A7A7A',
  border: '#E8E8E8',
  background: '#FFFFFF',
  backgroundSecondary: '#FAFAFA',
  backgroundHover: '#F5F5F5',
  white: '#FFFFFF',
  toggleOff: '#ccc'
}

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
}

// Toggle Switch 组件
const ToggleSwitch: React.FC<{
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}> = ({ checked, onChange, disabled = false }) => (
  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
    <span style={{
      position: 'absolute',
      cursor: disabled ? 'not-allowed' : 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: checked ? COLORS.primary : COLORS.toggleOff,
      transition: '0.3s',
      borderRadius: 24,
      opacity: disabled ? 0.5 : 1
    }}>
      <span style={{
        position: 'absolute',
        height: 18,
        width: 18,
        left: checked ? 23 : 3,
        bottom: 3,
        backgroundColor: COLORS.white,
        transition: '0.3s',
        borderRadius: '50%',
      }} />
    </span>
  </label>
)

// 设置项容器组件
const SettingItem: React.FC<{
  title: string
  description?: string
  children: React.ReactNode
  noBorder?: boolean
}> = ({ title, description, children, noBorder = false }) => (
  <div style={{
    marginBottom: SPACING.xl,
    paddingBottom: noBorder ? 0 : SPACING.xl,
    borderBottom: noBorder ? 'none' : `1px solid ${COLORS.border}`
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, marginRight: SPACING.lg }}>
        <div style={{ fontSize: 14, fontWeight: '500', marginBottom: description ? 4 : 0, color: COLORS.text }}>
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  </div>
)

// 子设置项组件
const SubSettingItem: React.FC<{
  label: string
  children: React.ReactNode
}> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
    {children}
  </div>
)

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }): JSX.Element => {
  const [activeSection, setActiveSection] = useState('general')
  const [cliTools, setCLITools] = useState<CLIToolInfo[]>([])
  const [detecting, setDetecting] = useState(false)
  const [configToolId, setConfigToolId] = useState<string | null>(null)

  // 通用设置
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    autoSave: true,
    autoSaveInterval: 5,
    language: 'zh-CN',
    startupBehavior: 'last-project'
  })

  // 通知设置
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    soundEnabled: true,
    soundSettings: {
      enabled: true,
      taskComplete: true,
      stageComplete: true,
      error: true
    },
    showInApp: true,
    showDesktop: true
  })

  // 外观设置
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: 'light',
    fontSize: 14,
    fontFamily: 'system-ui',
    accentColor: '#E42313',
    compactMode: false
  })

  // 加载设置
  useEffect(() => {
    loadGeneralSettings()
    loadNotificationSettings()
    loadAppearanceSettings()
  }, [])

  const loadGeneralSettings = (): void => {
    try {
      const stored = localStorage.getItem('generalSettings')
      if (stored) {
        setGeneralSettings(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load general settings:', error)
    }
  }

  const loadNotificationSettings = async (): Promise<void> => {
    try {
      const enabled = await window.api.notification.isEnabled()
      const soundSettings = await window.api.notification.getSoundSettings()
      const stored = localStorage.getItem('notificationSettings')
      const localSettings = stored ? JSON.parse(stored) : {}

      setNotificationSettings({
        enabled,
        soundEnabled: soundSettings.enabled,
        soundSettings,
        showInApp: localSettings.showInApp ?? true,
        showDesktop: localSettings.showDesktop ?? true
      })
    } catch (error) {
      console.error('Failed to load notification settings:', error)
    }
  }

  const loadAppearanceSettings = (): void => {
    try {
      const stored = localStorage.getItem('appearanceSettings')
      if (stored) {
        setAppearanceSettings(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load appearance settings:', error)
    }
  }

  // 保存设置
  const saveGeneralSettings = (settings: GeneralSettings): void => {
    try {
      localStorage.setItem('generalSettings', JSON.stringify(settings))
      setGeneralSettings(settings)
    } catch (error) {
      console.error('Failed to save general settings:', error)
    }
  }

  const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
    try {
      await window.api.notification.setEnabled(settings.enabled)
      await window.api.notification.setSoundSettings(settings.soundSettings)
      localStorage.setItem('notificationSettings', JSON.stringify({
        showInApp: settings.showInApp,
        showDesktop: settings.showDesktop
      }))
      setNotificationSettings(settings)
    } catch (error) {
      console.error('Failed to save notification settings:', error)
    }
  }

  const saveAppearanceSettings = (settings: AppearanceSettings): void => {
    try {
      localStorage.setItem('appearanceSettings', JSON.stringify(settings))
      setAppearanceSettings(settings)
      applyTheme(settings.theme)
    } catch (error) {
      console.error('Failed to save appearance settings:', error)
    }
  }

  const applyTheme = (theme: 'light' | 'dark' | 'auto'): void => {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  const detectAllTools = useCallback(async (): Promise<void> => {
    setDetecting(true)
    try {
      const detectedTools = await window.api.cliTools.detectAll()
      setCLITools(detectedTools)
    } catch (error) {
      console.error('Failed to detect tools:', error)
    } finally {
      setDetecting(false)
    }
  }, [])

  const loadCLITools = useCallback(async (): Promise<void> => {
    try {
      const tools = await window.api.cliTools.getAll()
      setCLITools(tools)
      // 自动检测工具状态
      detectAllTools()
    } catch (error) {
      console.error('Failed to load CLI tools:', error)
    }
  }, [detectAllTools])

  useEffect(() => {
    if (activeSection === 'cli-tools') {
      loadCLITools()
    }
  }, [activeSection, loadCLITools])

  const handleOpenConfig = (toolId: string): void => {
    setConfigToolId(toolId)
  }

  const handleCloseConfig = (): void => {
    setConfigToolId(null)
    detectAllTools() // 重新检测配置状态
  }

  const sections = [
    { id: 'general', label: '通用' },
    { id: 'cli-tools', label: 'CLI 工具' },
    { id: 'notifications', label: '通知' },
    { id: 'appearance', label: '外观' }
  ]

  const renderContent = (): JSX.Element | null => {
    switch (activeSection) {
      case 'general':
        return (
          <div style={{ padding: SPACING.xl, maxWidth: 600 }}>
            <h2 style={{ margin: `0 0 ${SPACING.xl}px 0`, fontSize: 18, fontWeight: '600', color: COLORS.text }}>
              通用设置
            </h2>

            {/* 自动保存 */}
            <SettingItem
              title="自动保存"
              description="自动保存项目配置和工作状态"
            >
              <ToggleSwitch
                checked={generalSettings.autoSave}
                onChange={(checked) => saveGeneralSettings({ ...generalSettings, autoSave: checked })}
              />
            </SettingItem>

            {generalSettings.autoSave && (
              <div style={{ marginTop: -SPACING.lg, marginBottom: SPACING.xl, paddingLeft: SPACING.lg }}>
                <label style={{ fontSize: 13, color: COLORS.text, display: 'block', marginBottom: SPACING.sm }}>
                  自动保存间隔（分钟）
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={generalSettings.autoSaveInterval}
                  onChange={(e) => saveGeneralSettings({ ...generalSettings, autoSaveInterval: parseInt(e.target.value) || 5 })}
                  style={{
                    width: 100,
                    padding: `${SPACING.sm}px ${SPACING.md}px`,
                    fontSize: 13,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    color: COLORS.text
                  }}
                />
              </div>
            )}

            {/* 语言设置 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>语言</div>
              <select
                value={generalSettings.language}
                onChange={(e) => saveGeneralSettings({ ...generalSettings, language: e.target.value })}
                style={{
                  width: '100%',
                  padding: `${SPACING.sm}px ${SPACING.md}px`,
                  fontSize: 13,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  backgroundColor: COLORS.background,
                  color: COLORS.text,
                  cursor: 'pointer'
                }}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>

            {/* 启动行为 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>启动时</div>
              <select
                value={generalSettings.startupBehavior}
                onChange={(e) => saveGeneralSettings({ ...generalSettings, startupBehavior: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: `${SPACING.sm}px ${SPACING.md}px`,
                  fontSize: 13,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  backgroundColor: COLORS.background,
                  color: COLORS.text,
                  cursor: 'pointer'
                }}
              >
                <option value="last-project">打开上次的项目</option>
                <option value="project-list">显示项目列表</option>
                <option value="new-project">创建新项目</option>
              </select>
            </div>
          </div>
        )

      case 'cli-tools':
        return (
          <div style={{ padding: SPACING.xl, height: '100%', overflow: 'auto' }}>
            <div
              style={{
                marginBottom: SPACING.xl,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: '600', color: COLORS.text }}>CLI 工具配置</h2>
                <p style={{ margin: `${SPACING.sm}px 0 0 0`, fontSize: 13, color: COLORS.textSecondary }}>
                  全局配置 AI CLI 工具
                </p>
              </div>
              <button
                onClick={detectAllTools}
                disabled={detecting}
                style={{
                  padding: `${SPACING.sm}px ${SPACING.md}px`,
                  fontSize: 13,
                  color: COLORS.text,
                  backgroundColor: COLORS.background,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  cursor: detecting ? 'not-allowed' : 'pointer',
                  opacity: detecting ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!detecting) e.currentTarget.style.backgroundColor = COLORS.backgroundHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.background
                }}
              >
                {detecting ? '检测中...' : '刷新检测'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              {cliTools.map((tool) => (
                <div
                  key={tool.id}
                  style={{
                    padding: SPACING.lg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    backgroundColor: tool.installed ? COLORS.backgroundSecondary : COLORS.backgroundHover,
                    transition: 'all 0.2s'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: SPACING.lg
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: COLORS.text,
                          marginBottom: SPACING.xs
                        }}
                      >
                        {tool.displayName}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
                        {tool.description}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#999',
                          fontFamily: 'monospace',
                          marginBottom: SPACING.sm
                        }}
                      >
                        {tool.command}
                      </div>

                      {/* Status badges */}
                      <div style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            fontSize: 11,
                            borderRadius: 4,
                            backgroundColor: tool.installed ? '#E8F5E9' : '#FFEBEE',
                            color: tool.installed ? '#2E7D32' : '#C62828',
                            fontWeight: '500'
                          }}
                        >
                          {tool.installed ? `已安装 ${tool.version || ''}` : '未安装'}
                        </span>
                        {tool.installed && (
                          <span
                            style={{
                              padding: '2px 8px',
                              fontSize: 11,
                              borderRadius: 4,
                              backgroundColor: tool.configValid ? '#E3F2FD' : '#FFF3E0',
                              color: tool.configValid ? '#1565C0' : '#E65100',
                              fontWeight: '500'
                            }}
                          >
                            {tool.configValid ? '配置正常' : '配置缺失'}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenConfig(tool.id)}
                      style={{
                        padding: `${SPACING.sm}px ${SPACING.lg}px`,
                        fontSize: 13,
                        color: COLORS.text,
                        backgroundColor: COLORS.background,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = COLORS.backgroundHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = COLORS.background
                      }}
                    >
                      配置
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div style={{ padding: SPACING.xl, maxWidth: 600 }}>
            <h2 style={{ margin: `0 0 ${SPACING.xl}px 0`, fontSize: 18, fontWeight: '600', color: COLORS.text }}>
              通知设置
            </h2>

            {/* 启用通知 */}
            <SettingItem
              title="启用通知"
              description="接收任务和流程的通知提醒"
            >
              <ToggleSwitch
                checked={notificationSettings.enabled}
                onChange={(checked) => saveNotificationSettings({ ...notificationSettings, enabled: checked })}
              />
            </SettingItem>

            {/* 通知类型 */}
            <div style={{ marginBottom: SPACING.xl, paddingBottom: SPACING.xl, borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.lg, color: COLORS.text }}>通知类型</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
                <SubSettingItem label="应用内通知">
                  <ToggleSwitch
                    checked={notificationSettings.showInApp}
                    onChange={(checked) => saveNotificationSettings({ ...notificationSettings, showInApp: checked })}
                  />
                </SubSettingItem>

                <SubSettingItem label="桌面通知">
                  <ToggleSwitch
                    checked={notificationSettings.showDesktop}
                    onChange={(checked) => saveNotificationSettings({ ...notificationSettings, showDesktop: checked })}
                  />
                </SubSettingItem>
              </div>
            </div>

            {/* 声音提醒 */}
            <SettingItem
              title="声音提醒"
              description="通知时播放提示音"
              noBorder
            >
              <ToggleSwitch
                checked={notificationSettings.soundSettings.enabled}
                onChange={(checked) => saveNotificationSettings({
                  ...notificationSettings,
                  soundSettings: { ...notificationSettings.soundSettings, enabled: checked }
                })}
              />
            </SettingItem>

            {notificationSettings.soundSettings.enabled && (
              <div style={{ paddingLeft: SPACING.lg, display: 'flex', flexDirection: 'column', gap: SPACING.md, marginTop: -SPACING.lg }}>
                <SubSettingItem label="任务完成提示音">
                  <ToggleSwitch
                    checked={notificationSettings.soundSettings.taskComplete}
                    onChange={(checked) => saveNotificationSettings({
                      ...notificationSettings,
                      soundSettings: { ...notificationSettings.soundSettings, taskComplete: checked }
                    })}
                  />
                </SubSettingItem>

                <SubSettingItem label="环节完成提示音">
                  <ToggleSwitch
                    checked={notificationSettings.soundSettings.stageComplete}
                    onChange={(checked) => saveNotificationSettings({
                      ...notificationSettings,
                      soundSettings: { ...notificationSettings.soundSettings, stageComplete: checked }
                    })}
                  />
                </SubSettingItem>

                <SubSettingItem label="错误提示音">
                  <ToggleSwitch
                    checked={notificationSettings.soundSettings.error}
                    onChange={(checked) => saveNotificationSettings({
                      ...notificationSettings,
                      soundSettings: { ...notificationSettings.soundSettings, error: checked }
                    })}
                  />
                </SubSettingItem>
              </div>
            )}
          </div>
        )

      case 'appearance':
        return (
          <div style={{ padding: SPACING.xl, maxWidth: 600 }}>
            <h2 style={{ margin: `0 0 ${SPACING.xl}px 0`, fontSize: 18, fontWeight: '600', color: COLORS.text }}>
              外观设置
            </h2>

            {/* 主题 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>主题</div>
              <div style={{ display: 'flex', gap: SPACING.md }}>
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => saveAppearanceSettings({ ...appearanceSettings, theme })}
                    style={{
                      flex: 1,
                      padding: `${SPACING.md}px ${SPACING.lg}px`,
                      fontSize: 13,
                      color: appearanceSettings.theme === theme ? COLORS.white : COLORS.text,
                      backgroundColor: appearanceSettings.theme === theme ? COLORS.primary : COLORS.background,
                      border: `1px solid ${appearanceSettings.theme === theme ? COLORS.primary : COLORS.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: appearanceSettings.theme === theme ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                  </button>
                ))}
              </div>
            </div>

            {/* 字体大小 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>字体大小</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                <input
                  type="range"
                  min="12"
                  max="18"
                  step="1"
                  value={appearanceSettings.fontSize}
                  onChange={(e) => saveAppearanceSettings({ ...appearanceSettings, fontSize: parseInt(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: COLORS.textSecondary, minWidth: 40 }}>
                  {appearanceSettings.fontSize}px
                </span>
              </div>
            </div>

            {/* 字体 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>字体</div>
              <select
                value={appearanceSettings.fontFamily}
                onChange={(e) => saveAppearanceSettings({ ...appearanceSettings, fontFamily: e.target.value })}
                style={{
                  width: '100%',
                  padding: `${SPACING.sm}px ${SPACING.md}px`,
                  fontSize: 13,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  backgroundColor: COLORS.background,
                  color: COLORS.text,
                  cursor: 'pointer'
                }}
              >
                <option value="system-ui">系统默认</option>
                <option value="'SF Pro', -apple-system, BlinkMacSystemFont">SF Pro</option>
                <option value="'PingFang SC', 'Microsoft YaHei'">苹方 / 微软雅黑</option>
                <option value="'Consolas', 'Monaco', monospace">等宽字体</option>
              </select>
            </div>

            {/* 主题色 */}
            <div style={{ marginBottom: SPACING.xl }}>
              <div style={{ fontSize: 14, fontWeight: '500', marginBottom: SPACING.sm, color: COLORS.text }}>主题色</div>
              <div style={{ display: 'flex', gap: SPACING.md, flexWrap: 'wrap' }}>
                {['#E42313', '#1890FF', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96'].map((color) => (
                  <button
                    key={color}
                    onClick={() => saveAppearanceSettings({ ...appearanceSettings, accentColor: color })}
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: color,
                      border: appearanceSettings.accentColor === color ? `3px solid ${COLORS.text}` : `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {appearanceSettings.accentColor === color && (
                      <span style={{ color: COLORS.white, fontSize: 18, fontWeight: 'bold' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 紧凑模式 */}
            <SettingItem
              title="紧凑模式"
              description="减少界面元素间距,显示更多内容"
              noBorder
            >
              <ToggleSwitch
                checked={appearanceSettings.compactMode}
                onChange={(checked) => saveAppearanceSettings({ ...appearanceSettings, compactMode: checked })}
              />
            </SettingItem>
          </div>
        )

      default:
        return null
    }
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
          backgroundColor: COLORS.background,
          borderRadius: '12px',
          width: '800px',
          height: '600px',
          maxWidth: '90%',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: `${SPACING.xl}px ${SPACING.xl}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: '600', color: COLORS.text }}>设置</h1>
          <button
            onClick={onClose}
            style={{
              padding: `${SPACING.xs}px ${SPACING.sm}px`,
              fontSize: 18,
              color: COLORS.textSecondary,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.backgroundHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <div
            style={{
              width: 200,
              borderRight: `1px solid ${COLORS.border}`,
              padding: `${SPACING.lg}px 0`,
              backgroundColor: COLORS.backgroundSecondary
            }}
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: '100%',
                  padding: `${SPACING.md}px ${SPACING.xl}px`,
                  fontSize: 14,
                  textAlign: 'left',
                  color: activeSection === section.id ? COLORS.primary : COLORS.text,
                  backgroundColor: activeSection === section.id ? '#FFF5F5' : 'transparent',
                  border: 'none',
                  borderLeft: activeSection === section.id ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeSection === section.id ? '600' : '400',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = COLORS.backgroundHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'auto' }}>{renderContent()}</div>
        </div>
      </div>

      {/* Config Dialog */}
      {configToolId && (
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
          onClick={handleCloseConfig}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORS.background,
              borderRadius: 8,
              maxWidth: 600,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <GenericCLIToolConfig
              toolId={configToolId}
              toolName={cliTools.find((t) => t.id === configToolId)?.displayName || ''}
              onClose={handleCloseConfig}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsDialog
