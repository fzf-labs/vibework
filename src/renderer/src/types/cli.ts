export interface CLITool {
  id: string
  name: string
  command: string
  args?: string[]
  enabled: boolean
  type: 'claude-code' | 'gemini-cli' | 'codex' | 'other'
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
