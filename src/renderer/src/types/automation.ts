export type AutomationTriggerType = 'interval' | 'daily' | 'weekly'
export type AutomationRunStatus = 'running' | 'success' | 'failed' | 'skipped'

export interface IntervalTrigger {
  interval_seconds: number
}

export interface DailyTrigger {
  time: string
}

export interface WeeklyTrigger {
  day_of_week: number
  time: string
}

export type AutomationTrigger = IntervalTrigger | DailyTrigger | WeeklyTrigger

export interface AutomationTemplate {
  title: string
  prompt: string
  taskMode: 'conversation'
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
  baseBranch?: string
  worktreeBranchPrefix?: string
  worktreeRootPath?: string
  cliToolId?: string
  agentToolConfigId?: string
}

export interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger_type: AutomationTriggerType
  trigger_json: AutomationTrigger
  timezone: string
  source_task_id: string | null
  template_json: AutomationTemplate
  next_run_at: string
  last_run_at: string | null
  last_status: AutomationRunStatus | null
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  scheduled_at: string
  triggered_at: string
  status: AutomationRunStatus
  task_id: string | null
  task_node_id: string | null
  session_id: string | null
  error_message: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

