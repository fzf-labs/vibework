import { ApiService } from './api'
import type { CLIToolInfo, CLISession, CLIToolConfig } from '@/types'

export class CLIToolService extends ApiService {
  async detectAll(): Promise<CLIToolInfo[]> {
    return this.call('cli:detectAll')
  }

  async detect(toolName: string): Promise<CLIToolInfo | null> {
    return this.call('cli:detect', toolName)
  }

  async getConfig(toolName: string): Promise<CLIToolConfig | null> {
    return this.call('cli:getConfig', toolName)
  }

  async saveConfig(toolName: string, config: CLIToolConfig): Promise<void> {
    return this.call('cli:saveConfig', toolName, config)
  }

  async startSession(toolName: string, projectPath: string, args?: string[]): Promise<string> {
    return this.call('cli:startSession', toolName, projectPath, args)
  }

  async stopSession(sessionId: string): Promise<void> {
    return this.call('cli:stopSession', sessionId)
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    return this.call('cli:sendInput', sessionId, input)
  }

  async getOutput(sessionId: string): Promise<string> {
    return this.call('cli:getOutput', sessionId)
  }

  async getSessions(): Promise<CLISession[]> {
    return this.call('cli:getSessions')
  }
}

export const cliToolService = new CLIToolService()
