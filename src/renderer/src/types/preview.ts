export interface PreviewConfig {
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

export interface PreviewInstance {
  id: string
  configId: string
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  pid?: number
  port?: number
  startedAt?: string
  error?: string
}
