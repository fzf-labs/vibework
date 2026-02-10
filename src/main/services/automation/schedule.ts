import type {
  Automation,
  AutomationTrigger,
  AutomationTriggerType,
  DailyTrigger,
  IntervalTrigger,
  WeeklyTrigger
} from '../../types/automation'

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
}

export interface ResolvedTriggerInput {
  triggerType: AutomationTriggerType
  trigger: AutomationTrigger
  timezone: string
}

interface LocalDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

interface LocalDate {
  year: number
  month: number
  day: number
}

export function normalizeTimezone(value?: string | null): string {
  const timezone = value?.trim() || 'Asia/Shanghai'
  validateTimezone(timezone)
  return timezone
}

export function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`)
  }
}

export function validateTriggerInput(input: ResolvedTriggerInput): void {
  validateTimezone(input.timezone)

  if (input.triggerType === 'interval') {
    const trigger = input.trigger as IntervalTrigger
    if (!Number.isInteger(trigger.interval_seconds) || trigger.interval_seconds <= 0) {
      throw new Error('interval trigger requires interval_seconds > 0')
    }
    return
  }

  if (input.triggerType === 'daily') {
    const trigger = input.trigger as DailyTrigger
    validateTimeString(trigger.time)
    return
  }

  if (input.triggerType === 'weekly') {
    const trigger = input.trigger as WeeklyTrigger
    if (!Number.isInteger(trigger.day_of_week) || trigger.day_of_week < 1 || trigger.day_of_week > 7) {
      throw new Error('weekly trigger requires day_of_week in range 1..7')
    }
    validateTimeString(trigger.time)
    return
  }

  throw new Error(`Unsupported trigger type: ${input.triggerType}`)
}

export function calculateNextRunAt(
  input: ResolvedTriggerInput,
  referenceDate: Date = new Date()
): string {
  validateTriggerInput(input)

  if (input.triggerType === 'interval') {
    const intervalTrigger = input.trigger as IntervalTrigger
    const nextDate = new Date(referenceDate.getTime() + intervalTrigger.interval_seconds * 1000)
    return nextDate.toISOString()
  }

  if (input.triggerType === 'daily') {
    const dailyTrigger = input.trigger as DailyTrigger
    return calculateNextDailyAt(dailyTrigger, input.timezone, referenceDate).toISOString()
  }

  const weeklyTrigger = input.trigger as WeeklyTrigger
  return calculateNextWeeklyAt(weeklyTrigger, input.timezone, referenceDate).toISOString()
}

export function calculateNextRunAtForAutomation(
  automation: Pick<Automation, 'trigger_type' | 'trigger_json' | 'timezone'>,
  referenceDate: Date = new Date()
): string {
  return calculateNextRunAt(
    {
      triggerType: automation.trigger_type,
      trigger: automation.trigger_json,
      timezone: automation.timezone
    },
    referenceDate
  )
}

function calculateNextDailyAt(trigger: DailyTrigger, timezone: string, referenceDate: Date): Date {
  const { hour, minute } = parseTimeString(trigger.time)
  const localNow = getLocalDateTime(referenceDate, timezone)

  let candidateLocalDate: LocalDate = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day
  }

  let candidateDate = zonedLocalDateTimeToUtc(
    {
      ...candidateLocalDate,
      hour,
      minute
    },
    timezone
  )

  if (candidateDate.getTime() <= referenceDate.getTime()) {
    candidateLocalDate = addDays(candidateLocalDate, 1)
    candidateDate = zonedLocalDateTimeToUtc(
      {
        ...candidateLocalDate,
        hour,
        minute
      },
      timezone
    )
  }

  return candidateDate
}

function calculateNextWeeklyAt(trigger: WeeklyTrigger, timezone: string, referenceDate: Date): Date {
  const { hour, minute } = parseTimeString(trigger.time)
  const localNow = getLocalDateTime(referenceDate, timezone)
  const currentWeekday = getWeekday(referenceDate, timezone)

  let dayDelta = trigger.day_of_week - currentWeekday
  if (dayDelta < 0) {
    dayDelta += 7
  }

  let candidateLocalDate = addDays(
    {
      year: localNow.year,
      month: localNow.month,
      day: localNow.day
    },
    dayDelta
  )

  let candidateDate = zonedLocalDateTimeToUtc(
    {
      ...candidateLocalDate,
      hour,
      minute
    },
    timezone
  )

  if (candidateDate.getTime() <= referenceDate.getTime()) {
    candidateLocalDate = addDays(candidateLocalDate, 7)
    candidateDate = zonedLocalDateTimeToUtc(
      {
        ...candidateLocalDate,
        hour,
        minute
      },
      timezone
    )
  }

  return candidateDate
}

function validateTimeString(value: string): void {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`Invalid time format: ${value}`)
  }

  const parsed = parseTimeString(value)
  if (parsed.hour < 0 || parsed.hour > 23 || parsed.minute < 0 || parsed.minute > 59) {
    throw new Error(`Invalid time value: ${value}`)
  }
}

function parseTimeString(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((part) => Number(part))
  return { hour, minute }
}

function getLocalDateTime(referenceDate: Date, timezone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })

  const parts = formatter.formatToParts(referenceDate)
  const readPart = (type: string): number => {
    const match = parts.find((entry) => entry.type === type)?.value
    if (!match) {
      throw new Error(`Failed to resolve ${type} from timezone formatter`)
    }
    return Number(match)
  }

  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
    hour: readPart('hour'),
    minute: readPart('minute')
  }
}

function getWeekday(referenceDate: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  }).format(referenceDate)

  const weekdayIndex = WEEKDAY_SHORT_TO_INDEX[weekday]
  if (!weekdayIndex) {
    throw new Error(`Failed to resolve weekday for timezone: ${timezone}`)
  }

  return weekdayIndex
}

function addDays(localDate: LocalDate, days: number): LocalDate {
  const baseUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day)
  const result = new Date(baseUtc + days * 24 * 60 * 60 * 1000)

  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate()
  }
}

function zonedLocalDateTimeToUtc(localDateTime: LocalDateTime, timezone: string): Date {
  const utcGuess = new Date(
    Date.UTC(localDateTime.year, localDateTime.month - 1, localDateTime.day, localDateTime.hour, localDateTime.minute)
  )

  const firstOffset = getTimezoneOffsetMilliseconds(timezone, utcGuess)
  let candidate = new Date(utcGuess.getTime() - firstOffset)
  const secondOffset = getTimezoneOffsetMilliseconds(timezone, candidate)

  if (secondOffset !== firstOffset) {
    candidate = new Date(utcGuess.getTime() - secondOffset)
  }

  return candidate
}

function getTimezoneOffsetMilliseconds(timezone: string, referenceDate: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset'
  })

  const offsetToken = formatter
    .formatToParts(referenceDate)
    .find((part) => part.type === 'timeZoneName')?.value

  if (!offsetToken) {
    throw new Error(`Cannot resolve timezone offset for ${timezone}`)
  }

  const matched = offsetToken.match(/^GMT([+-])(\d{2}):(\d{2})$/)
  if (!matched) {
    throw new Error(`Unsupported timezone offset format: ${offsetToken}`)
  }

  const sign = matched[1] === '-' ? -1 : 1
  const hour = Number(matched[2])
  const minute = Number(matched[3])
  return sign * (hour * 60 + minute) * 60 * 1000
}

