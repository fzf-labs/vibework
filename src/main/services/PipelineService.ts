import { ChildProcess } from 'child_process'
import EventEmitter from 'events'
import { safeSpawn } from '../utils/safe-exec'
import { config } from '../config'
import { OutputBuffer } from '../utils/output-buffer'
import { OutputSpooler } from '../utils/output-spooler'
import { getAppPaths } from '../app/AppPaths'

const pipelineAllowlist = config.commandAllowlist

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
  outputTruncated?: boolean
  error?: string
  errorTruncated?: boolean
  exitCode?: number
  process?: ChildProcess
}

interface PipelineExecution {
  id: string
  pipelineId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  stageExecutions: StageExecution[]
  startedAt?: Date
  completedAt?: Date
}

export class PipelineService extends EventEmitter {
  private executions: Map<string, PipelineExecution> = new Map()
  private pendingApprovals: Map<string, { executionId: string; stageId: string }> = new Map()
  private stageSpoolers: Map<string, OutputSpooler> = new Map()

  constructor() {
    super()
  }

  /**
   * 执行工作流
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

    const isCancelled = (): boolean => execution.status === 'cancelled'

    execution.status = 'running'
    this.emit('execution:updated', execution)

    const sortedStages = [...stages].sort((a, b) => a.order - b.order)

    for (const stage of sortedStages) {
      if (isCancelled()) {
        this.emit('execution:completed', execution)
        return
      }
      const stageExecution = await this.executeStage(executionId, stage, workingDirectory)

      if (isCancelled()) {
        execution.completedAt = new Date()
        this.emit('execution:completed', execution)
        return
      }

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

    const isCancelled = (): boolean => execution.status === 'cancelled'

    const stageExecution: StageExecution = {
      id: Date.now().toString(),
      stageId: stage.id,
      status: 'pending',
      startedAt: new Date()
    }

    execution.stageExecutions.push(stageExecution)
    this.emit('stage:started', { executionId, stageExecution })

    if (isCancelled()) {
      stageExecution.status = 'skipped'
      stageExecution.completedAt = new Date()
      this.emit('stage:completed', { executionId, stageExecution })
      return stageExecution
    }

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

      if (isCancelled()) {
        stageExecution.status = 'failed'
        stageExecution.error = 'Execution cancelled'
      } else {
        stageExecution.status = 'success'
      }
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
    const timeout = stage.timeout ?? 300000
    const retryCount = stage.retryCount || 0

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        console.log('[PipelineService] executeCommand:', {
          command,
          args,
          cwd,
          timeout,
          attempt,
          retryCount
        })
        console.log('[PipelineService] fullCommand:', [command, ...args].join(' '))

        const childProcess = safeSpawn(command, args, {
          cwd,
          env: process.env,
          timeoutMs: timeout,
          allowlist: pipelineAllowlist,
          label: 'PipelineService'
        })

        stageExecution.process = childProcess

        const outputBuffer = new OutputBuffer({
          maxBytes: config.output.buffer.maxBytes,
          maxEntries: config.output.buffer.maxEntries
        })
        const errorBuffer = new OutputBuffer({
          maxBytes: config.output.buffer.maxBytes,
          maxEntries: config.output.buffer.maxEntries
        })

        const appPaths = getAppPaths()
        const spooler = new OutputSpooler(
          appPaths.getPipelineStageOutputFile(stageExecution.id, stage.id),
          config.output.spool
        )
        this.stageSpoolers.set(stageExecution.id, spooler)

        let exitCode: number | null = null
        let stderrMessage = ''
        try {
          childProcess.stdout?.on('data', (data) => {
            const chunk = data.toString()
            outputBuffer.push(chunk)
            spooler.append(chunk)
          })

          childProcess.stderr?.on('data', (data) => {
            const chunk = data.toString()
            errorBuffer.push(chunk)
            spooler.append(chunk)
          })

          const result = await new Promise<{ code: number | null }>((resolve, reject) => {
            childProcess.once('error', reject)
            childProcess.once('close', (code) => resolve({ code }))
          })

          const outputSnapshot = outputBuffer.snapshot()
          const errorSnapshot = errorBuffer.snapshot()
          stageExecution.output = outputSnapshot.output.join('')
          stageExecution.outputTruncated = outputSnapshot.truncated
          stderrMessage = errorSnapshot.output.join('')
          if (stderrMessage) {
            stageExecution.error = stderrMessage
            stageExecution.errorTruncated = errorSnapshot.truncated
          }
          exitCode = result.code
          stageExecution.exitCode = result.code ?? 0
        } finally {
          await spooler.dispose()
          this.stageSpoolers.delete(stageExecution.id)
        }

        if (exitCode && exitCode !== 0) {
          throw new Error(stderrMessage || `Command exited with code ${exitCode}`)
        }

        return
      } catch (error) {
        const execError = error as NodeJS.ErrnoException
        lastError = execError instanceof Error ? execError : new Error(String(error))
        stageExecution.exitCode = typeof execError.code === 'number' ? execError.code : 1

        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
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

    const stageExecution = execution.stageExecutions.find((s) => s.id === stageExecutionId)
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
    for (const stage of execution.stageExecutions) {
      if (stage.status === 'running') {
        stage.status = 'failed'
        stage.error = 'Execution cancelled'
        stage.completedAt = new Date()
      }
      stage.process?.kill('SIGTERM')
      const spooler = this.stageSpoolers.get(stage.id)
      if (spooler) {
        void spooler.dispose()
        this.stageSpoolers.delete(stage.id)
      }
    }
    this.emit('execution:cancelled', execution)
  }

  dispose(): void {
    for (const executionId of this.executions.keys()) {
      this.cancelExecution(executionId)
    }
    this.executions.clear()
    this.pendingApprovals.clear()
    this.stageSpoolers.clear()
  }
}
