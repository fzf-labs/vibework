import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getAppPaths } from '../app/AppPaths'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  accentColor: string
  backgroundStyle: string
  language: string
  notifications: {
    enabled: boolean
    sound: boolean
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentColor: '#3b82f6',
  backgroundStyle: 'default',
  language: 'zh-CN',
  notifications: {
    enabled: true,
    sound: true
  }
}

export class SettingsService {
  private settingsFile: string
  private settings: AppSettings

  constructor() {
    const appPaths = getAppPaths()
    this.settingsFile = appPaths.getSettingsFile()
    this.settings = this.loadSettings()
  }

  private loadSettings(): AppSettings {
    try {
      if (existsSync(this.settingsFile)) {
        const data = readFileSync(this.settingsFile, 'utf-8')
        const loaded = JSON.parse(data)
        return { ...DEFAULT_SETTINGS, ...loaded }
      }
    } catch (error) {
      console.error('[SettingsService] Failed to load settings:', error)
    }
    return { ...DEFAULT_SETTINGS }
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2))
    } catch (error) {
      console.error('[SettingsService] Failed to save settings:', error)
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updates }
    this.saveSettings()
    return this.getSettings()
  }

  resetSettings(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
    return this.getSettings()
  }
}
