import { DatabaseService } from './DatabaseService'
import { AutomationRunnerService } from './AutomationRunnerService'
import { calculateNextRunAtForAutomation } from './automation/schedule'

const DEFAULT_SCAN_INTERVAL_MS = 30_000

export class AutomationService {
  private db: DatabaseService
  private runner: AutomationRunnerService
  private scanIntervalMs: number
  private timer: NodeJS.Timeout | null = null
  private scanning = false

  constructor(db: DatabaseService, runner: AutomationRunnerService, scanIntervalMs = DEFAULT_SCAN_INTERVAL_MS) {
    this.db = db
    this.runner = runner
    this.scanIntervalMs = scanIntervalMs
  }

  init(): void {
    const recovered = this.db.markStaleRunningAutomationRunsFailed('interrupted_by_app_restart')
    if (recovered > 0) {
      console.log(`[AutomationService] Marked ${recovered} stale run(s) as failed`)
    }

    void this.scanDueAutomations()

    this.timer = setInterval(() => {
      void this.scanDueAutomations()
    }, this.scanIntervalMs)
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async runNow(automationId: string): Promise<{ runId: string; status: 'running' | 'success' | 'failed' | 'skipped' }> {
    const result = await this.runner.runNow(automationId)
    return {
      runId: result.runId,
      status: result.status
    }
  }

  private async scanDueAutomations(): Promise<void> {
    if (this.scanning) {
      return
    }
    this.scanning = true

    try {
      const now = new Date()
      const dueAutomations = this.db.listDueAutomations(now.toISOString())

      for (const automation of dueAutomations) {
        if (this.runner.hasAnyRunning()) {
          break
        }

        if (this.runner.isAutomationRunning(automation.id) || this.db.getRunningAutomationRun(automation.id)) {
          continue
        }

        const scheduledAt = automation.next_run_at
        const nextRunAt = calculateNextRunAtForAutomation(automation, new Date(scheduledAt))

        const reserved = this.db.reserveDueAutomationRun({
          automationId: automation.id,
          expectedScheduledAt: scheduledAt,
          nextRunAt,
          triggeredAt: new Date().toISOString()
        })

        if (!reserved) {
          continue
        }

        void this.runner.runReserved(reserved.automation, reserved.run)
      }
    } catch (error) {
      console.error('[AutomationService] Failed to scan automations:', error)
    } finally {
      this.scanning = false
    }
  }
}
