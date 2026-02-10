import { EventEmitter } from 'events'
import { newUlid } from '../utils/ids'
import { composeTaskNodePrompt, DatabaseService } from './DatabaseService'
import { TaskService } from './TaskService'
import { CliSessionService } from './cli/CliSessionService'
import type { Automation, AutomationRun, AutomationRunStatus } from '../types/automation'

export interface AutomationRunResult {
  runId: string
  status: AutomationRunStatus
}

export class AutomationRunnerService extends EventEmitter {
  private db: DatabaseService
  private taskService: TaskService
  private cliSessionService: CliSessionService
  private runningAutomationIds: Set<string> = new Set()

  constructor(db: DatabaseService, taskService: TaskService, cliSessionService: CliSessionService) {
    super()
    this.db = db
    this.taskService = taskService
    this.cliSessionService = cliSessionService
  }

  isAutomationRunning(automationId: string): boolean {
    return this.runningAutomationIds.has(automationId)
  }

  hasAnyRunning(): boolean {
    return this.runningAutomationIds.size > 0
  }

  async runReserved(
    automation: Automation,
    run: AutomationRun
  ): Promise<AutomationRunResult> {
    if (this.runningAutomationIds.has(automation.id)) {
      return {
        runId: run.id,
        status: 'skipped'
      }
    }

    this.runningAutomationIds.add(automation.id)
    this.db.updateAutomationLastRun(automation.id, {
      last_status: 'running'
    })

    try {
      const result = await this.execute(automation, run)
      return result
    } finally {
      this.runningAutomationIds.delete(automation.id)
    }
  }

  async runNow(automationId: string): Promise<AutomationRunResult> {
    const automation = this.db.getAutomation(automationId)
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`)
    }

    if (
      this.hasAnyRunning() ||
      this.runningAutomationIds.has(automationId) ||
      this.db.getRunningAutomationRun(automationId)
    ) {
      throw new Error('Automation is already running')
    }

    const nowIso = new Date().toISOString()
    const run = this.db.createAutomationRun({
      automation_id: automationId,
      scheduled_at: nowIso,
      triggered_at: nowIso,
      status: 'running'
    })

    return this.runReserved(automation, run)
  }

  private async execute(automation: Automation, run: AutomationRun): Promise<AutomationRunResult> {
    let taskId: string | null = null
    let taskNodeId: string | null = null
    let sessionId: string | null = null

    try {
      const createdTask = await this.taskService.createTask({
        ...automation.template_json,
        title: this.renderTemplateString(automation.template_json.title),
        prompt: this.renderTemplateString(automation.template_json.prompt),
        taskMode: 'conversation'
      })

      taskId = createdTask.id

      const startedNode = this.db.startTaskExecution(taskId)
      if (!startedNode) {
        throw new Error('Failed to start task execution')
      }

      taskNodeId = startedNode.id

      const nodePrompt = composeTaskNodePrompt(createdTask.prompt, startedNode.prompt)
      const runtimeCliToolId = startedNode.cli_tool_id ?? automation.template_json.cliToolId
      if (!runtimeCliToolId) {
        throw new Error('CLI tool is required for automation run')
      }

      sessionId = newUlid()

      this.db.updateAutomationRun(run.id, {
        task_id: taskId,
        task_node_id: taskNodeId,
        session_id: sessionId
      })

      await this.cliSessionService.startSession(
        sessionId,
        runtimeCliToolId,
        createdTask.workspacePath || automation.template_json.projectPath || process.cwd(),
        nodePrompt,
        undefined,
        undefined,
        createdTask.projectId,
        taskId,
        startedNode.agent_tool_config_id ?? automation.template_json.agentToolConfigId ?? null,
        taskNodeId
      )

      const resultStatus = await this.waitForRunFinish(run.id, taskNodeId, sessionId)
      return {
        runId: run.id,
        status: resultStatus
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const finishedAt = new Date().toISOString()

      this.db.updateAutomationRun(run.id, {
        status: 'failed',
        task_id: taskId,
        task_node_id: taskNodeId,
        session_id: sessionId,
        error_message: message,
        finished_at: finishedAt
      })

      this.db.updateAutomationLastRun(automation.id, {
        last_run_at: finishedAt,
        last_status: 'failed'
      })

      this.emit('run-finished', {
        automationId: automation.id,
        runId: run.id,
        status: 'failed',
        error: message
      })

      return {
        runId: run.id,
        status: 'failed'
      }
    }
  }

  private waitForRunFinish(runId: string, taskNodeId: string, sessionId: string): Promise<AutomationRunStatus> {
    return new Promise((resolve) => {
      let resolved = false

      const cleanup = () => {
        offNodeStatus()
        this.cliSessionService.off('close', onCliClose)
        this.cliSessionService.off('error', onCliError)
      }

      const finalize = (status: AutomationRunStatus, errorMessage?: string) => {
        if (resolved) return
        resolved = true
        cleanup()

        const finishedAt = new Date().toISOString()
        this.db.updateAutomationRun(runId, {
          status,
          error_message: errorMessage ?? null,
          finished_at: finishedAt
        })

        const run = this.db.getAutomationRun(runId)
        if (run) {
          this.db.updateAutomationLastRun(run.automation_id, {
            last_run_at: finishedAt,
            last_status: status
          })

          this.emit('run-finished', {
            automationId: run.automation_id,
            runId,
            status,
            error: errorMessage
          })
        }

        resolve(status)
      }

      const onNodeStatus = (node: { id: string; status: string; error_message?: string | null }) => {
        if (node.id !== taskNodeId) return

        if (node.status === 'in_review' || node.status === 'done') {
          if (node.error_message) {
            finalize('failed', node.error_message)
            return
          }

          finalize('success')
        }
      }

      const onCliClose = (payload: {
        sessionId: string
        code: number | null
        taskNodeId?: string
      }) => {
        if (payload.sessionId !== sessionId) return

        if (typeof payload.code === 'number' && payload.code !== 0) {
          finalize('failed', `CLI exited with code ${payload.code}`)
        }
      }

      const onCliError = (payload: { sessionId: string; error: string }) => {
        if (payload.sessionId !== sessionId) return
        finalize('failed', payload.error)
      }

      const offNodeStatus = this.db.onTaskNodeStatusChange(onNodeStatus)
      this.cliSessionService.on('close', onCliClose)
      this.cliSessionService.on('error', onCliError)

      const currentNode = this.db.getTaskNode(taskNodeId)
      if (currentNode && (currentNode.status === 'in_review' || currentNode.status === 'done')) {
        if (currentNode.error_message) {
          finalize('failed', currentNode.error_message)
          return
        }
        finalize('success')
      }
    })
  }

  private renderTemplateString(value: string): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    return value
      .replaceAll('{{date}}', `${year}-${month}-${day}`)
      .replaceAll('{{datetime}}', now.toISOString())
  }
}
