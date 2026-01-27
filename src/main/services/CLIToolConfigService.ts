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
      case 'cursor-agent':
        return path.join(homeDir, '.cursor', 'agent-config.json')
      default:
        throw new Error(`Unknown tool: ${toolId}`)
    }
  }

  getConfig(toolId: string): ToolConfig {
    const configPath = this.getConfigPath(toolId)

    if (!fs.existsSync(configPath)) {
      return this.getDefaultConfig(toolId)
    }

    try {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error(`Failed to read config for ${toolId}:`, error)
      return this.getDefaultConfig(toolId)
    }
  }

  private getDefaultConfig(toolId: string): ToolConfig {
    switch (toolId) {
      case 'claude-code':
        return { executablePath: 'claude', defaultModel: 'sonnet' }
      case 'codex':
        return { executablePath: 'codex', apiKey: '' }
      case 'gemini-cli':
        return { executablePath: 'gemini', apiKey: '' }
      case 'cursor-agent':
        return { executablePath: 'cursor-agent' }
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
