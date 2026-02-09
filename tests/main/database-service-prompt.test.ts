import { describe, expect, it } from 'vitest'
import { composeTaskNodePrompt } from '../../src/main/services/DatabaseService'

describe('composeTaskNodePrompt', () => {
  it('uses task prompt for conversation nodes', () => {
    expect(composeTaskNodePrompt('conversation prompt', '')).toBe('conversation prompt')
  })

  it('combines task and template prompts for workflow nodes', () => {
    expect(composeTaskNodePrompt('task prompt', 'template prompt')).toBe(
      'task prompt\n\ntemplate prompt'
    )
  })

  it('uses template prompt when task prompt is empty', () => {
    expect(composeTaskNodePrompt('', 'template prompt')).toBe('template prompt')
  })
})
