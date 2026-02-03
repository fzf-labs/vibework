import { existsSync, readFileSync } from 'fs'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const createSessionRoot = () => mkdtempSync(join(tmpdir(), 'vibework-msgstore-'))

const envSnapshot = {
  VIBEWORK_LOG_BATCH_MAX_BYTES: process.env.VIBEWORK_LOG_BATCH_MAX_BYTES,
  VIBEWORK_LOG_FLUSH_INTERVAL_MS: process.env.VIBEWORK_LOG_FLUSH_INTERVAL_MS,
  VIBEWORK_LOG_MAX_BYTES: process.env.VIBEWORK_LOG_MAX_BYTES,
  VIBEWORK_LOG_MAX_FILES: process.env.VIBEWORK_LOG_MAX_FILES
}

const setupMsgStore = async (env: Record<string, string>) => {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value
  })

  vi.resetModules()
  const sessionRoot = createSessionRoot()

  vi.doMock('../../src/main/services/AppPaths', () => ({
    getAppPaths: () => ({
      getProjectSessionsDir: () => sessionRoot,
      getSessionMessagesFile: (sessionId: string) => join(sessionRoot, `${sessionId}.jsonl`),
      getSessionsDir: () => sessionRoot,
      getLegacySessionMessagesFile: (sessionId: string) =>
        join(sessionRoot, sessionId, 'messages.jsonl')
    })
  }))

  const { MsgStoreService } = await import('../../src/main/services/MsgStoreService')
  return { MsgStoreService, sessionRoot }
}

describe('MsgStoreService', () => {
  afterEach(() => {
    Object.entries(envSnapshot).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
    vi.useRealTimers()
    vi.resetModules()
  })

  it('flushes logs asynchronously on the batch interval', async () => {
    vi.useFakeTimers()
    const { MsgStoreService, sessionRoot } = await setupMsgStore({
      VIBEWORK_LOG_BATCH_MAX_BYTES: '1000000',
      VIBEWORK_LOG_FLUSH_INTERVAL_MS: '50',
      VIBEWORK_LOG_MAX_BYTES: '1000000',
      VIBEWORK_LOG_MAX_FILES: '1'
    })

    const store = new MsgStoreService(undefined, 'session-a', 'project')
    const logFilePath = join(sessionRoot, 'session-a.jsonl')

    store.push({ type: 'stdout', content: 'hello' } as any)
    expect(existsSync(logFilePath)).toBe(false)

    await vi.advanceTimersByTimeAsync(60)
    await new Promise((resolve) => setImmediate(resolve))

    expect(existsSync(logFilePath)).toBe(true)
    const content = readFileSync(logFilePath, 'utf-8')
    expect(content).toContain('hello')
    vi.useRealTimers()
  })

  it('rotates logs when file size exceeds limits', async () => {
    const { MsgStoreService, sessionRoot } = await setupMsgStore({
      VIBEWORK_LOG_BATCH_MAX_BYTES: '1',
      VIBEWORK_LOG_FLUSH_INTERVAL_MS: '1',
      VIBEWORK_LOG_MAX_BYTES: '200',
      VIBEWORK_LOG_MAX_FILES: '2'
    })

    const store = new MsgStoreService(undefined, 'session-b', 'project')
    const logFilePath = join(sessionRoot, 'session-b.jsonl')

    for (let i = 0; i < 10; i += 1) {
      store.push({ type: 'stdout', content: 'x'.repeat(80) } as any)
    }

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(existsSync(logFilePath)).toBe(true)
    expect(existsSync(`${logFilePath}.1`)).toBe(true)
  })
})
