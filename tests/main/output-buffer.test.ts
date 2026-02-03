import { describe, expect, it } from 'vitest'
import { OutputBuffer } from '../../src/main/utils/output-buffer'

describe('OutputBuffer', () => {
  it('truncates output when limits are exceeded', () => {
    const buffer = new OutputBuffer({ maxBytes: 10, maxEntries: 2 })

    buffer.push('12345')
    buffer.push('67890')
    const snapshot = buffer.snapshot()
    expect(snapshot.output).toEqual(['12345', '67890'])
    expect(snapshot.truncated).toBe(false)

    buffer.push('abc')
    const truncated = buffer.snapshot()
    expect(truncated.output.length).toBeLessThanOrEqual(2)
    expect(truncated.truncated).toBe(true)
  })
})
