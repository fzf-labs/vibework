export interface Project {
  id: string
  name: string
  path: string
  type: 'local' | 'remote'
  remoteUrl?: string
  description?: string
  lastOpened?: Date
  createdAt: Date
  config: ProjectConfig
}

export interface ProjectConfig {
  mcpServers?: MCPServer[]
  skills?: Skill[]
  pipelines?: Pipeline[]
  editor?: EditorConfig
}

export interface MCPServer {
  id: string
  name: string
  command: string
  args?: string[]
  enabled: boolean
}

export interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

export interface PipelineStage {
  id: string
  name: string
  requiresConfirmation: boolean
  command?: string
}

export interface EditorConfig {
  type: 'vscode' | 'cursor' | 'other'
  path: string
}
