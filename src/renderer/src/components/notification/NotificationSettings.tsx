import { useState, useEffect, useCallback } from 'react'

interface SoundSettings {
  enabled: boolean
  taskComplete: boolean
  stageComplete: boolean
  error: boolean
}

export function NotificationSettings(): JSX.Element {
  const [enabled, setEnabled] = useState(true)
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    enabled: true,
    taskComplete: true,
    stageComplete: true,
    error: true
  })
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      const isEnabled = await window.api.notification.isEnabled()
      const sounds = await window.api.notification.getSoundSettings()
      setEnabled(isEnabled)
      setSoundSettings(sounds)
    } catch (error) {
      console.error('Failed to load notification settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadSettings()
    }, 0)
    return () => clearTimeout(initialLoad)
  }, [loadSettings])

  const handleToggle = async (value: boolean): Promise<void> => {
    try {
      await window.api.notification.setEnabled(value)
      setEnabled(value)
    } catch (error) {
      console.error('Failed to update notification settings:', error)
    }
  }

  const handleSoundToggle = async (value: boolean): Promise<void> => {
    try {
      await window.api.notification.setSoundEnabled(value)
      setSoundSettings({ ...soundSettings, enabled: value })
    } catch (error) {
      console.error('Failed to update sound settings:', error)
    }
  }

  const handleSoundSettingChange = async (
    key: keyof SoundSettings,
    value: boolean
  ): Promise<void> => {
    try {
      const newSettings = { ...soundSettings, [key]: value }
      await window.api.notification.setSoundSettings(newSettings)
      setSoundSettings(newSettings)
    } catch (error) {
      console.error('Failed to update sound settings:', error)
    }
  }

  if (loading) {
    return <div className="p-4">加载中...</div>
  }

  const ToggleSwitch = ({
    checked,
    onChange
  }: {
    checked: boolean
    onChange: (value: boolean) => void
  }): JSX.Element => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
  )

  return (
    <div className="p-4 space-y-6">
      {/* 系统通知开关 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">系统通知</h3>
          <p className="text-sm text-gray-500">启用后,任务完成、环节完成等事件将显示系统通知</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={handleToggle} />
      </div>

      {/* 声音提醒设置 */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">声音提醒</h3>
            <p className="text-sm text-gray-500">启用后,通知将伴随声音提示</p>
          </div>
          <ToggleSwitch checked={soundSettings.enabled} onChange={handleSoundToggle} />
        </div>

        {/* 详细声音设置 */}
        {soundSettings.enabled && (
          <div className="ml-4 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">任务完成提示音</span>
              <ToggleSwitch
                checked={soundSettings.taskComplete}
                onChange={(value) => handleSoundSettingChange('taskComplete', value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">环节完成提示音</span>
              <ToggleSwitch
                checked={soundSettings.stageComplete}
                onChange={(value) => handleSoundSettingChange('stageComplete', value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">错误提示音</span>
              <ToggleSwitch
                checked={soundSettings.error}
                onChange={(value) => handleSoundSettingChange('error', value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
