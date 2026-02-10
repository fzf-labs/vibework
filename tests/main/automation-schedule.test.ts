import { describe, expect, it } from 'vitest'
import {
  calculateNextRunAt,
  calculateNextRunAtForAutomation,
  validateTriggerInput
} from '../../src/main/services/automation/schedule'

describe('automation schedule helpers', () => {
  it('calculates interval next run from reference time', () => {
    const reference = new Date('2026-02-09T00:00:00.000Z')

    const nextRunAt = calculateNextRunAt(
      {
        triggerType: 'interval',
        trigger: { interval_seconds: 3600 },
        timezone: 'UTC'
      },
      reference
    )

    expect(nextRunAt).toBe('2026-02-09T01:00:00.000Z')
  })

  it('calculates daily next run in timezone', () => {
    const reference = new Date('2026-02-08T20:00:00.000Z')

    const nextRunAt = calculateNextRunAt(
      {
        triggerType: 'daily',
        trigger: { time: '09:00' },
        timezone: 'Asia/Shanghai'
      },
      reference
    )

    expect(nextRunAt).toBe('2026-02-09T01:00:00.000Z')
  })

  it('calculates weekly next run in timezone', () => {
    const reference = new Date('2026-02-09T02:00:00.000Z')

    const nextRunAt = calculateNextRunAt(
      {
        triggerType: 'weekly',
        trigger: { day_of_week: 1, time: '09:00' },
        timezone: 'Asia/Shanghai'
      },
      reference
    )

    expect(nextRunAt).toBe('2026-02-16T01:00:00.000Z')
  })

  it('supports calculating next run directly from automation object', () => {
    const reference = new Date('2026-02-09T00:00:00.000Z')

    const nextRunAt = calculateNextRunAtForAutomation(
      {
        trigger_type: 'interval',
        trigger_json: { interval_seconds: 120 },
        timezone: 'UTC'
      },
      reference
    )

    expect(nextRunAt).toBe('2026-02-09T00:02:00.000Z')
  })

  it('rejects invalid weekly trigger input', () => {
    expect(() => {
      validateTriggerInput({
        triggerType: 'weekly',
        trigger: { day_of_week: 8, time: '09:00' },
        timezone: 'UTC'
      })
    }).toThrow('weekly trigger requires day_of_week in range 1..7')
  })
})

