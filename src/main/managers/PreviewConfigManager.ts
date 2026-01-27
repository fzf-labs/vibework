import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

interface PreviewConfig {
  id: string
  name: string
  projectId: string
  type: 'frontend' | 'backend'
  command: string
  args: string[]
  cwd?: string
  port?: number
  env?: Record<string, string>
  autoStart?: boolean
  createdAt: string
  updatedAt: string
}

export class PreviewConfigManager {
  private configPath: string
  private configs: Map<string, PreviewConfig> = new Map()

  constructor() {
    const userDataPath = app.getPath('userData')
    const configDir = join(userDataPath, 'preview-configs')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    this.configPath = join(configDir, 'configs.json')
    this.loadConfigs()
  }

  private loadConfigs(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8')
        const configs = JSON.parse(data)
        this.configs = new Map(Object.entries(configs))
      }
    } catch (error) {
      console.error('Failed to load preview configs:', error)
    }
  }

  private saveConfigs(): void {
    try {
      const data = JSON.stringify(Object.fromEntries(this.configs), null, 2)
      writeFileSync(this.configPath, data, 'utf-8')
    } catch (error) {
      console.error('Failed to save preview configs:', error)
      throw error
    }
  }

  getAllConfigs(): PreviewConfig[] {
    return Array.from(this.configs.values())
  }

  getConfigsByProject(projectId: string): PreviewConfig[] {
    return Array.from(this.configs.values()).filter(c => c.projectId === projectId)
  }

  getConfig(id: string): PreviewConfig | undefined {
    return this.configs.get(id)
  }

  addConfig(config: Omit<PreviewConfig, 'id' | 'createdAt' | 'updatedAt'>): PreviewConfig {
    const newConfig: PreviewConfig = {
      ...config,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.configs.set(newConfig.id, newConfig)
    this.saveConfigs()
    return newConfig
  }

  updateConfig(id: string, updates: Partial<PreviewConfig>): PreviewConfig {
    const config = this.configs.get(id)
    if (!config) {
      throw new Error(`Config not found: ${id}`)
    }
    const updatedConfig = {
      ...config,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    }
    this.configs.set(id, updatedConfig)
    this.saveConfigs()
    return updatedConfig
  }

  deleteConfig(id: string): boolean {
    const deleted = this.configs.delete(id)
    if (deleted) {
      this.saveConfigs()
    }
    return deleted
  }
}
