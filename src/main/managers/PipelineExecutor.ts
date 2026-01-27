import { exec } from 'child_process'
import { promisify } from 'util'
import EventEmitter from 'events'

const execAsync = promisify(exec)

interface PipelineStage {
  id: string
  name: string
  type: 'command' | 'manual' | 'approval' | 'notification'
  order: number
  requiresApproval: boolean
  command?: string
  args?: string[]
  workingDirectory?: string
  timeout?: number
  retryCount?: number
  continueOnError?: boolean
}

interface StageExecution {
  id: string
  stageId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'waiting_approval'
  startedAt?: Date
  completedAt?: Date
  output?: string
  error?: string
  exitCode?: number
}

interface PipelineExecution {
  id: string
  pipelineId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  stageExecutions: StageExecution[]
  startedAt?: Date
  completedAt?: Date
}

export class PipelineExecutor extends EventEmitter {
  private executions: Map<string, PipelineExecution> = new Map()
  private pendingApprovals: Map<string, { executionId: string; stageId: string }> = new Map()

  constructor() {
    super()
  }

  /**
   * 执行流水线
   */
  async executePipeline(
    pipelineId: string,
    stages: PipelineStage[],
    workingDirectory?: string
  ): Promise<string> {
    const executionId = Date.now().toString()
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId,
      status: 'pending',
      stageExecutions: [],
      startedAt: new Date()
    }

    this.executions.set(executionId, execution)
    this.emit('execution:started', execution)

    // 按顺序执行环节
    this.executeStages(executionId, stages, workingDirectory)

    return executionId
  }

  /**
   * 按顺序执行环节
   */
  private async executeStages(
    executionId: string,
    stages: PipelineStage[],
    workingDirectory?: string
  ): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) return

    execution.status = 'running'
    this.emit('execution:updated', execution)

    const sortedStages = [...stages].sort((a, b) => a.order - b.order)

    for (const stage of sortedStages) {
      const stageExecution = await this.executeStage(executionId, stage, workingDirectory)

      if (stageExecution.status === 'failed' && !stage.continueOnError) {
        execution.status = 'failed'
        execution.completedAt = new Date()
        this.emit('execution:completed', execution)
        return
      }
    }

    execution.status = 'success'
    execution.completedAt = new Date()
    this.emit('execution:completed', execution)
  }

  /**
   * 执行单个环节
   */
  private async executeStage(
    executionId: string,
    stage: PipelineStage,
    workingDirectory?: string
  ): Promise<StageExecution> {
    const execution = this.executions.get(executionId)
    if (!execution) throw new Error('Execution not found')

    const stageExecution: StageExecution = {
      id: Date.now().toString(),
      stageId: stage.id,
      status: 'pending',
      startedAt: new Date()
    }

    execution.stageExecutions.push(stageExecution)
    this.emit('stage:started', { executionId, stageExecution })

    // 检查是否需要审批
    if (stage.requiresApproval) {
      stageExecution.status = 'waiting_approval'
      this.pendingApprovals.set(stageExecution.id, { executionId, stageId: stage.id })
      this.emit('stage:waiting_approval', { executionId, stageExecution })
      return stageExecution
    }

    // 根据类型执行环节
    try {
      stageExecution.status = 'running'
      this.emit('stage:updated', { executionId, stageExecution })

      if (stage.type === 'command' && stage.command) {
        await this.executeCommand(stageExecution, stage, workingDirectory)
      }

      stageExecution.status = 'success'
      stageExecution.completedAt = new Date()
      this.emit('stage:completed', { executionId, stageExecution })
    } catch (error) {
      stageExecution.status = 'failed'
      stageExecution.error = String(error)
      stageExecution.completedAt = new Date()
      this.emit('stage:failed', { executionId, stageExecution })
    }

    return stageExecution
  }

  /**
   * 执行命令
   */
  private async executeCommand(
    stageExecution: StageExecution,
    stage: PipelineStage,
    workingDirectory?: string
  ): Promise<void> {
    const command = stage.command!
    const args = stage.args || []
    const cwd = stage.workingDirectory || workingDirectory
    const timeout = stage.timeout || 300000
    const retryCount = stage.retryCount || 0

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const fullCommand = `${command} ${args.join(' ')}`
        const { stdout, stderr } = await execAsync(fullCommand, {
          cwd,
          timeout
        })

        stageExecution.output = stdout
        if (stderr) {
          stageExecution.error = stderr
        }
        stageExecution.exitCode = 0
        return
      } catch (error: any) {
        lastError = error
        stageExecution.exitCode = error.code || 1

        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    throw lastError
  }

  /**
   * 审批环节
   */
  approveStage(stageExecutionId: string, approvedBy: string): void {
    const approval = this.pendingApprovals.get(stageExecutionId)
    if (!approval) {
      throw new Error('Approval not found')
    }

    const execution = this.executions.get(approval.executionId)
    if (!execution) {
      throw new Error('Execution not found')
    }

    const stageExecution = execution.stageExecutions.find(s => s.id === stageExecutionId)
    if (!stageExecution) {
      throw new Error('Stage execution not found')
    }

    stageExecution.status = 'success'
    stageExecution.completedAt = new Date()
    this.pendingApprovals.delete(stageExecutionId)

    this.emit('stage:approved', { executionId: approval.executionId, stageExecution, approvedBy })
  }

  /**
   * 获取执行记录
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * 获取所有执行记录
   */
  getAllExecutions(): PipelineExecution[] {
    return Array.from(this.executions.values())
  }

  /**
   * 取消执行
   */
  cancelExecution(executionId: string): void {
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw new Error('Execution not found')
    }

    execution.status = 'cancelled'
    execution.completedAt = new Date()
    this.emit('execution:cancelled', execution)
  }
}
