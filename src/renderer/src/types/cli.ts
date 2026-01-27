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
}

export interface CLITool {
  id: string
  name: string
  command: string
  args?: string[]
  enabled: boolean
  type: 'claude-code' | 'gemini-cli' | 'codex' | 'cursor-agent' | 'other'
}

export interface CLISession {
  id: string
  toolId: string
  projectId: string
  status: 'running' | 'stopped' | 'error'
  startTime: Date
  output: string[]
}

export interface CLIOutput {
  timestamp: Date
  type: 'stdout' | 'stderr'
  content: string
}

export interface CLIToolConfig {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
  [key: string]: any
}
