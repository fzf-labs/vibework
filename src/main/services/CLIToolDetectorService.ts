import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { safeExecFile } from '../utils/safe-exec'
import { config } from '../config'

const cliToolAllowlist = config.commandAllowlist
const defaultTimeoutMs = config.commandTimeoutMs

export interface CLIToolInfo {
  id: string
  name: string
  command: string
  displayName: string
  description: string
  installed: boolean
  version?: string
  installPath?: string
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
      const [command, ...args] = tool.detectionCommand.split(' ').filter(Boolean)
      const { stdout } = await safeExecFile(command, args, {
        allowlist: cliToolAllowlist,
        timeoutMs: defaultTimeoutMs,
        label: 'CLIToolDetectorService'
      })
      tool.installed = true
      tool.version = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
      tool.installPath = await this.resolveInstallPath(tool.command)
      tool.configValid = await this.checkConfig(tool)
    } catch {
      tool.installed = false
      tool.version = undefined
      tool.installPath = undefined
      tool.configValid = false
    }

    return { ...tool }
  }

  private async resolveInstallPath(command: string): Promise<string | undefined> {
    const platform = os.platform()
    const lookupCommand = platform === 'win32' ? 'where' : 'which'

    try {
      const { stdout } = await safeExecFile(lookupCommand, [command], {
        allowlist: cliToolAllowlist,
        timeoutMs: defaultTimeoutMs,
        label: 'CLIToolDetectorService'
      })
      const resolvedPath = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
      return resolvedPath || undefined
    } catch {
      return undefined
    }
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
