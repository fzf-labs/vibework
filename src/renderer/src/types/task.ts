/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * 任务类型
 */
export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'other'

/**
 * 任务
 */
export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  type: TaskType
  priority: TaskPriority
  status: TaskStatus
  assignee?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
  dueDate?: Date
  pipelineId?: string
  worktreePath?: string
  branchName?: string
}

/**
 * 流水线环节类型
 */
export type StageType = 'command' | 'manual' | 'approval' | 'notification'

/**
 * 流水线环节状态
 */
export type StageStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'

/**
 * 流水线环节
 */
export interface PipelineStage {
  id: string
  name: string
  description?: string
  type: StageType
  order: number
  requiresApproval: boolean
  command?: string
  args?: string[]
  workingDirectory?: string
  timeout?: number
  retryCount?: number
  continueOnError?: boolean
  condition?: string
}

/**
 * 流水线环节执行记录
 */
export interface StageExecution {
  id: string
  stageId: string
  status: StageStatus
  startedAt?: Date
  completedAt?: Date
  output?: string
  error?: string
  exitCode?: number
  approvedBy?: string
  approvedAt?: Date
}

/**
 * 流水线
 */
export interface Pipeline {
  id: string
  name: string
  description?: string
  projectId?: string
  stages: PipelineStage[]
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 流水线执行状态
 */
export type PipelineExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

/**
 * 流水线执行记录
 */
export interface PipelineExecution {
  id: string
  pipelineId: string
  taskId?: string
  status: PipelineExecutionStatus
  stageExecutions: StageExecution[]
  startedAt?: Date
  completedAt?: Date
  triggeredBy?: string
}
