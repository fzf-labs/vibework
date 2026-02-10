import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { EventEmitter } from 'events'
import { safeExecFile } from '../utils/safe-exec'
import { config } from '../config'

const cliToolAllowlist = config.commandAllowlist

export type CLIToolInstallState = 'unknown' | 'checking' | 'installed' | 'missing' | 'error'
export type CLIToolConfigState = 'unknown' | 'valid' | 'missing'
export type CLIToolDetectionLevel = 'fast' | 'full'

export interface CLIToolDetectOptions {
  level?: CLIToolDetectionLevel
  force?: boolean
}

export interface CLIToolRefreshOptions extends CLIToolDetectOptions {
  toolIds?: string[]
}

export interface CLIToolInfo {
  id: string
  name: string
  command: string
  displayName: string
  description: string
  installed?: boolean
  version?: string
  installPath?: string
  configValid?: boolean
  configPath?: string
  detectionCommand: string
  installState: CLIToolInstallState
  configState: CLIToolConfigState
  checkedLevel?: CLIToolDetectionLevel
  lastCheckedAt?: string
  latencyMs?: number
  errorMessage?: string
}

export class CLIToolDetectorService extends EventEmitter {
  private readonly inFlightDetections = new Map<string, Promise<CLIToolInfo | null>>()

  private readonly fastTimeoutMs = config.cliToolDetection.fastTimeoutMs

  private readonly fullTimeoutMs = config.cliToolDetection.fullTimeoutMs

  private readonly fastCacheMs = config.cliToolDetection.fastCacheMs

  private readonly fullCacheMs = config.cliToolDetection.fullCacheMs

  private tools: CLIToolInfo[] = [
    {
      id: 'claude-code',
      name: 'claude-code',
      command: 'claude',
      displayName: 'Claude Code',
      description: 'Anthropic 官方 CLI 工具',
      detectionCommand: 'claude --version',
      installState: 'unknown',
      configState: 'unknown'
    },
    {
      id: 'codex',
      name: 'codex',
      command: 'codex',
      displayName: 'Codex',
      description: 'OpenAI Codex CLI 工具',
      detectionCommand: 'codex --version',
      installState: 'unknown',
      configState: 'unknown'
    },
    {
      id: 'gemini-cli',
      name: 'gemini-cli',
      command: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini CLI 工具',
      detectionCommand: 'gemini --version',
      installState: 'unknown',
      configState: 'unknown'
    },
    {
      id: 'opencode',
      name: 'opencode',
      command: 'opencode',
      displayName: 'OpenCode',
      description: 'OpenCode CLI 工具',
      detectionCommand: 'opencode --version',
      installState: 'unknown',
      configState: 'unknown'
    },
    {
      id: 'cursor-agent',
      name: 'cursor-agent',
      command: 'cursor-agent',
      displayName: 'Cursor Agent',
      description: 'Cursor AI Agent CLI 工具',
      detectionCommand: 'cursor-agent --version',
      installState: 'unknown',
      configState: 'unknown'
    }
  ]

  constructor() {
    super()
    this.tools = this.tools.map((tool) => ({
      ...tool,
      ...this.getConfigDetails(tool.id)
    }))
  }

  init(): void {
    void this.refreshTools({ level: 'fast' }).catch((error) => {
      console.error('[CLIToolDetectorService] Failed to warm tool cache:', error)
    })
  }

  async detectTool(toolId: string, options: CLIToolDetectOptions = {}): Promise<CLIToolInfo | null> {
    const level = options.level ?? 'full'
    const tool = this.tools.find((t) => t.id === toolId)
    if (!tool) return null

    if (!options.force && this.isToolFresh(tool, level)) {
      return { ...tool }
    }

    const inFlight = this.inFlightDetections.get(toolId)
    if (inFlight) {
      return inFlight
    }

    const detectionPromise = this.runDetection(toolId, level)
    this.inFlightDetections.set(toolId, detectionPromise)

    try {
      return await detectionPromise
    } finally {
      this.inFlightDetections.delete(toolId)
    }
  }

  private async runDetection(toolId: string, level: CLIToolDetectionLevel): Promise<CLIToolInfo | null> {
    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    const startedAt = Date.now()
    this.updateTool(toolId, {
      installState: 'checking',
      errorMessage: undefined
    })

    const configDetails = this.getConfigDetails(toolId)

    const installPath = await this.resolveInstallPath(tool.command)
    if (!installPath) {
      const updated = this.updateTool(toolId, {
        installed: false,
        installState: 'missing',
        version: undefined,
        installPath: undefined,
        checkedLevel: level,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        ...configDetails
      })
      return updated ? { ...updated } : null
    }

    const version =
      level === 'full'
        ? await this.resolveVersion(tool)
        : tool.version

    const updated = this.updateTool(toolId, {
      installed: true,
      installState: 'installed',
      version,
      installPath,
      checkedLevel: level,
      lastCheckedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      errorMessage: undefined,
      ...configDetails
    })

    return updated ? { ...updated } : null
  }

  private isToolFresh(tool: CLIToolInfo, level: CLIToolDetectionLevel): boolean {
    if (!tool.lastCheckedAt) {
      return false
    }

    const checkedAt = Date.parse(tool.lastCheckedAt)
    if (Number.isNaN(checkedAt)) {
      return false
    }

    const age = Date.now() - checkedAt

    if (level === 'full') {
      return tool.checkedLevel === 'full' && age <= this.fullCacheMs
    }

    if (tool.checkedLevel === 'full') {
      return age <= this.fullCacheMs
    }

    return age <= this.fastCacheMs
  }

  private updateTool(toolId: string, updates: Partial<CLIToolInfo>): CLIToolInfo | null {
    const index = this.tools.findIndex((tool) => tool.id === toolId)
    if (index === -1) {
      return null
    }

    const next = {
      ...this.tools[index],
      ...updates
    }
    this.tools[index] = next
    this.emit('updated', this.getSnapshot())
    return next
  }

  private async resolveVersion(tool: CLIToolInfo): Promise<string | undefined> {
    const [command, ...args] = tool.detectionCommand.split(' ').filter(Boolean)

    try {
      const { stdout } = await safeExecFile(command, args, {
        allowlist: cliToolAllowlist,
        timeoutMs: this.fullTimeoutMs,
        label: 'CLIToolDetectorService'
      })

      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
    } catch {
      return undefined
    }
  }

  private async resolveInstallPath(command: string): Promise<string | undefined> {
    const platform = os.platform()
    const lookupCommand = platform === 'win32' ? 'where' : 'which'

    try {
      const { stdout } = await safeExecFile(lookupCommand, [command], {
        allowlist: cliToolAllowlist,
        timeoutMs: this.fastTimeoutMs,
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

  private getConfigDetails(toolId: string): Pick<CLIToolInfo, 'configPath' | 'configValid' | 'configState'> {
    const configPath = this.getConfigPath(toolId)
    if (!configPath) {
      return {
        configPath: undefined,
        configValid: undefined,
        configState: 'unknown'
      }
    }

    const exists = fs.existsSync(configPath)

    return {
      configPath,
      configValid: exists,
      configState: exists ? 'valid' : 'missing'
    }
  }

  private getConfigPath(toolId: string): string | undefined {
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
        return undefined
    }
  }

  async detectAllTools(options: CLIToolDetectOptions = {}): Promise<CLIToolInfo[]> {
    const results = await Promise.all(this.tools.map((tool) => this.detectTool(tool.id, options)))
    return results.filter((tool): tool is CLIToolInfo => tool !== null)
  }

  async refreshTools(options: CLIToolRefreshOptions = {}): Promise<CLIToolInfo[]> {
    const level = options.level ?? 'fast'
    const requestedIds = Array.isArray(options.toolIds)
      ? options.toolIds.filter((toolId): toolId is string => typeof toolId === 'string' && toolId.length > 0)
      : this.tools.map((tool) => tool.id)

    await Promise.all(
      requestedIds.map((toolId) =>
        this.detectTool(toolId, {
          level,
          force: options.force
        })
      )
    )

    return this.getSnapshot()
  }

  getSnapshot(): CLIToolInfo[] {
    return this.tools.map((tool) => ({ ...tool }))
  }

  getAllTools(): CLIToolInfo[] {
    return this.getSnapshot()
  }

  getTool(toolId: string): CLIToolInfo | undefined {
    const tool = this.tools.find((t) => t.id === toolId)
    return tool ? { ...tool } : undefined
  }
}
