import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'
import type { AutomationService } from '../services/AutomationService'
import { IPC_CHANNELS } from './channels'
import {
  calculateNextRunAt,
  normalizeTimezone,
  validateTriggerInput
} from '../services/automation/schedule'
import type { AutomationTriggerType } from '../types/automation'

type UnknownRecord = Record<string, unknown>

const triggerTypeValues = ['interval', 'daily', 'weekly'] as const

const isTriggerType = (value: unknown): value is AutomationTriggerType => {
  return triggerTypeValues.includes(value as AutomationTriggerType)
}

const requireString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`)
  }
  return value.trim()
}

const parseTrigger = (triggerType: (typeof triggerTypeValues)[number], raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('trigger_json must be an object')
  }

  const record = raw as UnknownRecord

  if (triggerType === 'interval') {
    const intervalSeconds = record.interval_seconds
    if (!Number.isInteger(intervalSeconds) || Number(intervalSeconds) <= 0) {
      throw new Error('interval_seconds must be integer > 0')
    }
    return {
      interval_seconds: Number(intervalSeconds)
    }
  }

  if (triggerType === 'daily') {
    return {
      time: requireString(record.time, 'trigger_json.time')
    }
  }

  const dayOfWeek = record.day_of_week
  if (!Number.isInteger(dayOfWeek) || Number(dayOfWeek) < 1 || Number(dayOfWeek) > 7) {
    throw new Error('day_of_week must be integer in range 1..7')
  }

  return {
    day_of_week: Number(dayOfWeek),
    time: requireString(record.time, 'trigger_json.time')
  }
}

const parseTemplate = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('template_json must be an object')
  }

  const record = raw as UnknownRecord
  const taskMode = record.taskMode

  if (taskMode !== 'conversation') {
    throw new Error('Only conversation task mode is supported for automations')
  }

  return {
    title: requireString(record.title, 'template_json.title'),
    prompt: requireString(record.prompt, 'template_json.prompt'),
    taskMode: 'conversation' as const,
    projectId: typeof record.projectId === 'string' && record.projectId ? record.projectId : undefined,
    projectPath:
      typeof record.projectPath === 'string' && record.projectPath ? record.projectPath : undefined,
    createWorktree: Boolean(record.createWorktree),
    baseBranch:
      typeof record.baseBranch === 'string' && record.baseBranch ? record.baseBranch : undefined,
    worktreeBranchPrefix:
      typeof record.worktreeBranchPrefix === 'string' && record.worktreeBranchPrefix
        ? record.worktreeBranchPrefix
        : undefined,
    worktreeRootPath:
      typeof record.worktreeRootPath === 'string' && record.worktreeRootPath
        ? record.worktreeRootPath
        : undefined,
    cliToolId:
      typeof record.cliToolId === 'string' && record.cliToolId ? record.cliToolId : undefined,
    agentToolConfigId:
      typeof record.agentToolConfigId === 'string' && record.agentToolConfigId
        ? record.agentToolConfigId
        : undefined
  }
}

const ensureAutomationService = (
  automationService: AutomationService | undefined
): AutomationService => {
  if (!automationService) {
    throw new Error('Automation service is not available')
  }
  return automationService
}

const buildCreateInput = (input: UnknownRecord) => {
  const name = requireString(input.name, 'name')
  const triggerType = input.trigger_type
  if (!isTriggerType(triggerType)) {
    throw new Error('trigger_type must be interval, daily or weekly')
  }

  const timezone = normalizeTimezone(
    typeof input.timezone === 'string' ? input.timezone : undefined
  )
  const trigger = parseTrigger(triggerType, input.trigger_json)
  validateTriggerInput({
    triggerType,
    trigger,
    timezone
  })

  const template = parseTemplate(input.template_json)
  const nextRunAt = calculateNextRunAt(
    {
      triggerType,
      trigger,
      timezone
    },
    new Date()
  )

  return {
    name,
    enabled: input.enabled === undefined ? true : Boolean(input.enabled),
    trigger_type: triggerType,
    trigger_json: trigger,
    timezone,
    source_task_id:
      typeof input.source_task_id === 'string' && input.source_task_id ? input.source_task_id : null,
    template_json: template,
    next_run_at: nextRunAt
  }
}

const buildUpdateInput = (
  current: Awaited<ReturnType<DatabaseService['getAutomation']>>,
  input: UnknownRecord
) => {
  if (!current) {
    throw new Error('Automation not found')
  }

  const updates: UnknownRecord = {}

  if ('name' in input) {
    updates.name = requireString(input.name, 'name')
  }
  if ('enabled' in input) {
    updates.enabled = Boolean(input.enabled)
  }
  if ('source_task_id' in input) {
    updates.source_task_id =
      typeof input.source_task_id === 'string' && input.source_task_id ? input.source_task_id : null
  }

  const hasTriggerFields =
    'trigger_type' in input || 'trigger_json' in input || 'timezone' in input

  if (hasTriggerFields) {
    const triggerTypeCandidate = 'trigger_type' in input ? input.trigger_type : current.trigger_type
    if (!isTriggerType(triggerTypeCandidate)) {
      throw new Error('trigger_type must be interval, daily or weekly')
    }
    const triggerType = triggerTypeCandidate

    const timezone = normalizeTimezone(
      'timezone' in input ? (input.timezone as string | undefined) : current.timezone
    )

    const rawTrigger =
      'trigger_json' in input
        ? input.trigger_json
        : current.trigger_json

    const trigger = parseTrigger(triggerType, rawTrigger)

    validateTriggerInput({
      triggerType,
      trigger,
      timezone
    })

    updates.trigger_type = triggerType
    updates.trigger_json = trigger
    updates.timezone = timezone
    updates.next_run_at = calculateNextRunAt(
      {
        triggerType,
        trigger,
        timezone
      },
      new Date()
    )
  }

  if ('template_json' in input) {
    updates.template_json = parseTemplate(input.template_json)
  }

  return updates
}

export const registerAutomationIpc = ({
  handle,
  services,
  v
}: IpcModuleContext): void => {
  const databaseService = services.databaseService as DatabaseService
  const automationService = ensureAutomationService(services.automationService)

  handle(IPC_CHANNELS.automation.create, [v.object()], (_, input) => {
    const createInput = buildCreateInput(input)
    return databaseService.createAutomation(createInput)
  })

  handle(IPC_CHANNELS.automation.update, [v.string(), v.object()], (_, id, updates) => {
    const current = databaseService.getAutomation(id)
    const parsedUpdates = buildUpdateInput(current, updates)
    return databaseService.updateAutomation(id, parsedUpdates as Parameters<DatabaseService['updateAutomation']>[1])
  })

  handle(IPC_CHANNELS.automation.delete, [v.string()], (_, id) => {
    return databaseService.deleteAutomation(id)
  })

  handle(IPC_CHANNELS.automation.get, [v.string()], (_, id) => {
    return databaseService.getAutomation(id)
  })

  handle(IPC_CHANNELS.automation.list, [], () => {
    return databaseService.listAutomations()
  })

  handle(IPC_CHANNELS.automation.setEnabled, [v.string(), v.boolean()], (_, id, enabled) => {
    return databaseService.setAutomationEnabled(id, enabled)
  })

  handle(IPC_CHANNELS.automation.runNow, [v.string()], async (_, id) => {
    return await automationService.runNow(id)
  })

  handle(IPC_CHANNELS.automation.listRuns, [v.string(), v.optional(v.number({ min: 1, max: 500 }))], (_, id, limit) => {
    return databaseService.listAutomationRuns(id, limit ?? 100)
  })
}
