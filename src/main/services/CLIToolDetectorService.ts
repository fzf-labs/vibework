import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const execAsync = promisify(exec)

export interface CLIToolInfo {
  id: string
  name: string
  command: string
  displayName: string
  description: string
  installed: boolean
  version?: string
  configValid: boolean
  configPath?: string
  detectionCommand: string
}

export class CLIToolDetectorService {
  private tools: CLIToolInfo[] = [
    {
      id: 'claude-code',
      name: 'claude-code',
      command: 'claude',
      displayName: 'Claude Code',
      description: 'Anthropic 官方 CLI 工具',
      installed: false,
      configValid: false,
      detectionCommand: 'claude --version'
    },
    {
      id: 'codex',
      name: 'codex',
      command: 'codex',
      displayName: 'Codex',
      description: 'OpenAI Codex CLI 工具',
      installed: false,
      configValid: false,
      detectionCommand: 'codex --version'
    },
    {
      id: 'gemini-cli',
      name: 'gemini-cli',
      command: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini CLI 工具',
      installed: false,
      configValid: false,
      detectionCommand: 'gemini --version'
    },
    {
      id: 'opencode',
      name: 'opencode',
      command: 'opencode',
      displayName: 'OpenCode',
      description: 'OpenCode CLI 工具',
      installed: false,
      configValid: false,
      detectionCommand: 'opencode --version'
    },
    {
      id: 'cursor-agent',
      name: 'cursor-agent',
      command: 'cursor-agent',
      displayName: 'Cursor Agent',
      description: 'Cursor AI Agent CLI 工具',
      installed: false,
      configValid: false,
      detectionCommand: 'cursor-agent --version'
    }
  ]

  async detectTool(toolId: string): Promise<CLIToolInfo | null> {
    const tool = this.tools.find((t) => t.id === toolId)
    if (!tool) return null

    try {
      const { stdout } = await execAsync(tool.detectionCommand)
      tool.installed = true
      tool.version = stdout.trim()
      tool.configValid = await this.checkConfig(tool)
    } catch {
      tool.installed = false
      tool.version = undefined
      tool.configValid = false
    }

    return { ...tool }
  }

  private async checkConfig(tool: CLIToolInfo): Promise<boolean> {
    const homeDir = os.homedir()
    let configPath: string

    switch (tool.id) {
      case 'claude-code':
        configPath = path.join(homeDir, '.config', 'claude', 'config.json')
        break
      case 'codex':
        configPath = path.join(homeDir, '.codex', 'config.json')
        break
      case 'gemini-cli':
        configPath = path.join(homeDir, '.gemini', 'config.json')
        break
      case 'opencode':
        configPath = path.join(homeDir, '.opencode', 'config.json')
        break
      case 'cursor-agent':
        configPath = path.join(homeDir, '.cursor', 'agent-config.json')
        break
      default:
        return false
    }

    tool.configPath = configPath
    return fs.existsSync(configPath)
  }

  async detectAllTools(): Promise<CLIToolInfo[]> {
    const results = await Promise.all(this.tools.map((tool) => this.detectTool(tool.id)))
    return results.filter((tool): tool is CLIToolInfo => tool !== null)
  }

  getAllTools(): CLIToolInfo[] {
    return this.tools.map((tool) => ({ ...tool }))
  }

  getTool(toolId: string): CLIToolInfo | undefined {
    const tool = this.tools.find((t) => t.id === toolId)
    return tool ? { ...tool } : undefined
  }
}
