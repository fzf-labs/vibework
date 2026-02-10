import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  AutomationTriggerType,
  CreateAutomationRunInput,
  UpdateAutomationRunInput,
  ReservedAutomationRun
} from '../../types/automation'

interface DueAutomationRow {
  id: string
  next_run_at: string
}

const triggerTypeValues: AutomationTriggerType[] = ['interval', 'daily', 'weekly']

export class AutomationRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createAutomation(input: CreateAutomationInput): Automation {
    const now = new Date().toISOString()
    const id = input.id ?? newUlid()

    if (!triggerTypeValues.includes(input.trigger_type)) {
      throw new Error(`Unsupported trigger type: ${input.trigger_type}`)
    }

    this.db
      .prepare(
        `
          INSERT INTO automations (
            id,
            name,
            enabled,
            trigger_type,
            trigger_json,
            timezone,
            source_task_id,
            template_json,
            next_run_at,
            last_run_at,
            last_status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
        `
      )
      .run(
        id,
        input.name,
        input.enabled === false ? 0 : 1,
        input.trigger_type,
        JSON.stringify(input.trigger_json),
        input.timezone ?? 'Asia/Shanghai',
        input.source_task_id ?? null,
        JSON.stringify(input.template_json),
        input.next_run_at,
        now,
        now
      )

    return this.getAutomation(id)!
  }

  updateAutomation(id: string, updates: UpdateAutomationInput): Automation | null {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }
    if (updates.trigger_type !== undefined) {
      if (!triggerTypeValues.includes(updates.trigger_type)) {
        throw new Error(`Unsupported trigger type: ${updates.trigger_type}`)
      }
      fields.push('trigger_type = ?')
      values.push(updates.trigger_type)
    }
    if (updates.trigger_json !== undefined) {
      fields.push('trigger_json = ?')
      values.push(JSON.stringify(updates.trigger_json))
    }
    if (updates.timezone !== undefined) {
      fields.push('timezone = ?')
      values.push(updates.timezone)
    }
    if (updates.source_task_id !== undefined) {
      fields.push('source_task_id = ?')
      values.push(updates.source_task_id)
    }
    if (updates.template_json !== undefined) {
      fields.push('template_json = ?')
      values.push(JSON.stringify(updates.template_json))
    }
    if (updates.next_run_at !== undefined) {
      fields.push('next_run_at = ?')
      values.push(updates.next_run_at)
    }
    if (updates.last_run_at !== undefined) {
      fields.push('last_run_at = ?')
      values.push(updates.last_run_at)
    }
    if (updates.last_status !== undefined) {
      fields.push('last_status = ?')
      values.push(updates.last_status)
    }

    if (fields.length === 0) {
      return this.getAutomation(id)
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString(), id)

    this.db
      .prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values)

    return this.getAutomation(id)
  }

  getAutomation(id: string): Automation | null {
    const row = this.db.prepare('SELECT * FROM automations WHERE id = ?').get(id)
    return row ? this.mapAutomation(row as Record<string, unknown>) : null
  }

  listAutomations(): Automation[] {
    const rows = this.db
      .prepare('SELECT * FROM automations ORDER BY updated_at DESC, created_at DESC')
      .all() as Record<string, unknown>[]
    return rows.map((row) => this.mapAutomation(row))
  }

  deleteAutomation(id: string): boolean {
    return this.db.prepare('DELETE FROM automations WHERE id = ?').run(id).changes > 0
  }

  setAutomationEnabled(id: string, enabled: boolean): Automation | null {
    this.db
      .prepare('UPDATE automations SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), id)
    return this.getAutomation(id)
  }

  listDueAutomations(referenceTimeIso: string): Automation[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM automations
          WHERE enabled = 1
            AND next_run_at <= ?
          ORDER BY next_run_at ASC
        `
      )
      .all(referenceTimeIso) as Record<string, unknown>[]

    return rows.map((row) => this.mapAutomation(row))
  }

  reserveDueAutomationRun(params: {
    automationId: string
    expectedScheduledAt: string
    nextRunAt: string
    triggeredAt: string
  }): ReservedAutomationRun | null {
    const transaction = this.db.transaction(() => {
      const now = new Date().toISOString()
      const due = this.db
        .prepare(
          `
            SELECT id, next_run_at
            FROM automations
            WHERE id = ?
              AND enabled = 1
              AND next_run_at = ?
            LIMIT 1
          `
        )
        .get(params.automationId, params.expectedScheduledAt) as DueAutomationRow | undefined

      if (!due) {
        return null
      }

      const runId = newUlid()
      this.db
        .prepare(
          `
            INSERT INTO automation_runs (
              id,
              automation_id,
              scheduled_at,
              triggered_at,
              status,
              task_id,
              task_node_id,
              session_id,
              error_message,
              finished_at,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, 'running', NULL, NULL, NULL, NULL, NULL, ?, ?)
          `
        )
        .run(runId, params.automationId, params.expectedScheduledAt, params.triggeredAt, now, now)

      this.db
        .prepare(
          `
            UPDATE automations
            SET next_run_at = ?, updated_at = ?
            WHERE id = ?
              AND next_run_at = ?
          `
        )
        .run(params.nextRunAt, now, params.automationId, params.expectedScheduledAt)

      const automation = this.getAutomation(params.automationId)
      const run = this.getAutomationRun(runId)
      if (!automation || !run) {
        throw new Error('Failed to reserve automation run')
      }

      return {
        automation,
        run
      } satisfies ReservedAutomationRun
    })

    try {
      return transaction()
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return null
      }
      throw error
    }
  }

  createAutomationRun(input: CreateAutomationRunInput): AutomationRun {
    const now = new Date().toISOString()
    const runId = input.id ?? newUlid()

    this.db
      .prepare(
        `
          INSERT INTO automation_runs (
            id,
            automation_id,
            scheduled_at,
            triggered_at,
            status,
            task_id,
            task_node_id,
            session_id,
            error_message,
            finished_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        runId,
        input.automation_id,
        input.scheduled_at,
        input.triggered_at,
        input.status,
        input.task_id ?? null,
        input.task_node_id ?? null,
        input.session_id ?? null,
        input.error_message ?? null,
        input.finished_at ?? null,
        now,
        now
      )

    return this.getAutomationRun(runId)!
  }

  getAutomationRun(id: string): AutomationRun | null {
    const row = this.db.prepare('SELECT * FROM automation_runs WHERE id = ?').get(id)
    return (row as AutomationRun | undefined) ?? null
  }

  listAutomationRuns(automationId: string, limit = 100): AutomationRun[] {
    return this.db
      .prepare(
        `
          SELECT *
          FROM automation_runs
          WHERE automation_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(automationId, limit) as AutomationRun[]
  }

  getRunningRunByAutomationId(automationId: string): AutomationRun | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM automation_runs
          WHERE automation_id = ?
            AND status = 'running'
          ORDER BY created_at DESC
          LIMIT 1
        `
      )
      .get(automationId)

    return (row as AutomationRun | undefined) ?? null
  }

  markStaleRunningRunsFailed(errorMessage = 'interrupted_by_app_restart'): number {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE automation_runs
          SET
            status = 'failed',
            error_message = COALESCE(error_message, ?),
            finished_at = COALESCE(finished_at, ?),
            updated_at = ?
          WHERE status = 'running'
        `
      )
      .run(errorMessage, now, now)

    return result.changes
  }

  updateAutomationRun(id: string, updates: UpdateAutomationRunInput): AutomationRun | null {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.task_id !== undefined) {
      fields.push('task_id = ?')
      values.push(updates.task_id)
    }
    if (updates.task_node_id !== undefined) {
      fields.push('task_node_id = ?')
      values.push(updates.task_node_id)
    }
    if (updates.session_id !== undefined) {
      fields.push('session_id = ?')
      values.push(updates.session_id)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?')
      values.push(updates.error_message)
    }
    if (updates.finished_at !== undefined) {
      fields.push('finished_at = ?')
      values.push(updates.finished_at)
    }

    if (fields.length === 0) {
      return this.getAutomationRun(id)
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString(), id)

    this.db.prepare(`UPDATE automation_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.getAutomationRun(id)
  }

  updateAutomationLastRun(
    automationId: string,
    updates: {
      last_run_at?: string | null
      last_status?: 'success' | 'failed' | 'skipped' | 'running' | null
    }
  ): Automation | null {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.last_run_at !== undefined) {
      fields.push('last_run_at = ?')
      values.push(updates.last_run_at)
    }
    if (updates.last_status !== undefined) {
      fields.push('last_status = ?')
      values.push(updates.last_status)
    }

    if (fields.length === 0) {
      return this.getAutomation(automationId)
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString(), automationId)

    this.db
      .prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values)

    return this.getAutomation(automationId)
  }

  private mapAutomation(row: Record<string, unknown>): Automation {
    const triggerType = String(row.trigger_type) as AutomationTriggerType
    const triggerJsonRaw = String(row.trigger_json ?? '{}')
    const templateJsonRaw = String(row.template_json ?? '{}')

    let triggerJson: unknown
    let templateJson: unknown
    try {
      triggerJson = JSON.parse(triggerJsonRaw)
    } catch {
      triggerJson = {}
    }
    try {
      templateJson = JSON.parse(templateJsonRaw)
    } catch {
      templateJson = {}
    }

    return {
      id: String(row.id),
      name: String(row.name),
      enabled: Number(row.enabled ?? 0) === 1,
      trigger_type: triggerType,
      trigger_json: triggerJson as Automation['trigger_json'],
      timezone: String(row.timezone ?? 'Asia/Shanghai'),
      source_task_id: (row.source_task_id as string | null | undefined) ?? null,
      template_json: templateJson as Automation['template_json'],
      next_run_at: String(row.next_run_at),
      last_run_at: (row.last_run_at as string | null | undefined) ?? null,
      last_status: (row.last_status as Automation['last_status'] | undefined) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('UNIQUE constraint failed') || error.message.includes('constraint failed'))
    )
  }
}

