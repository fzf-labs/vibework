import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

interface ToolConfig {
  executablePath?: string
  apiKey?: string
  defaultModel?: string
  [key: string]: unknown
}

export class CLIToolConfigService {
  private getConfigPath(toolId: string): string {
    const homeDir = os.homedir()

    switch (toolId) {
      case 'claude-code':
        return path.join(homeDir, '.config', 'claude', 'config.json')
      case 'codex':
        return path.join(homeDir, '.codex', 'config.json')
      case 'gemini-cli':
        return path.join(homeDir, '.gemini', 'config.json')
      case 'opencode':
        return path.join(homeDir, '.opencode', 'config.json')
      case 'cursor-agent':
        return path.join(homeDir, '.cursor', 'agent-config.json')
      default:
        throw new Error(`Unknown tool: ${toolId}`)
    }
  }

  getConfig(toolId: string): ToolConfig {
    const configPath = this.getConfigPath(toolId)
    const defaults = this.getDefaultConfig(toolId)

    if (!fs.existsSync(configPath)) {
      return defaults
    }

    try {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return defaults
      }
      return { ...defaults, ...(parsed as ToolConfig) }
    } catch (error) {
      console.error(`Failed to read config for ${toolId}:`, error)
      return defaults
    }
  }

  private getDefaultConfig(toolId: string): ToolConfig {
    switch (toolId) {
      case 'claude-code':
        return { executablePath: 'claude', defaultModel: 'sonnet' }
      case 'codex':
        return { executablePath: 'codex' }
      case 'gemini-cli':
        return { executablePath: 'gemini' }
      case 'opencode':
        return { executablePath: 'opencode' }
      case 'cursor-agent':
        return { executablePath: 'cursor-agent', defaultModel: 'auto' }
      default:
        return {}
    }
  }

  saveConfig(toolId: string, config: ToolConfig): void {
    const configPath = this.getConfigPath(toolId)
    const configDir = path.dirname(configPath)

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }
}
