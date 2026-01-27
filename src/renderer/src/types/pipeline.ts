export interface PipelineStage {
  id: string
  name: string
  type: 'command' | 'approval' | 'script'
  command?: string
  args?: string[]
  script?: string
  workingDirectory?: string
  env?: Record<string, string>
  requiresApproval?: boolean
  continueOnError?: boolean
}

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  stages: PipelineStage[]
  createdAt: number
  updatedAt: number
}

export interface PipelineExecution {
  id: string
  templateId: string
  templateName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentStageIndex: number
  stages: PipelineStageExecution[]
  startTime?: number
  endTime?: number
  workingDirectory?: string
}

export interface PipelineStageExecution {
  id: string
  stageId: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval'
  output?: string[]
  error?: string
  startTime?: number
  endTime?: number
  approvedBy?: string
  approvedAt?: number
}
