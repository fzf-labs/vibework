import { existsSync, readFileSync } from 'fs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const createSessionRoot = () => mkdtempSync(join(tmpdir(), 'vibework-msgstore-'))
const sessionRoots: string[] = []

const waitFor = async (predicate: () => boolean, timeoutMs = 1000): Promise<void> => {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

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
  sessionRoots.push(sessionRoot)

  vi.doMock('../../src/main/app/AppPaths', () => ({
    getAppPaths: () => ({
      getProjectSessionsDir: () => sessionRoot,
      getTaskDataDir: (taskId: string) => join(sessionRoot, taskId),
      getTaskMessagesFile: (taskId: string) => join(sessionRoot, `${taskId}.jsonl`),
      getTaskNodeMessagesFile: (taskId: string, taskNodeId: string) =>
        join(sessionRoot, taskId, `${taskNodeId}.jsonl`),
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
    while (sessionRoots.length > 0) {
      const root = sessionRoots.pop()
      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
    vi.useRealTimers()
    vi.resetModules()
  })

  it('flushes logs asynchronously on the batch interval', async () => {
    const { MsgStoreService, sessionRoot } = await setupMsgStore({
      VIBEWORK_LOG_BATCH_MAX_BYTES: '1000000',
      VIBEWORK_LOG_FLUSH_INTERVAL_MS: '10',
      VIBEWORK_LOG_MAX_BYTES: '1000000',
      VIBEWORK_LOG_MAX_FILES: '1'
    })

    const store = new MsgStoreService(undefined, 'task-a', 'session-a', 'project', 'node-a')
    const logFilePath = join(sessionRoot, 'task-a', 'node-a.jsonl')

    store.push({ type: 'stdout', content: 'hello' } as any)
    expect(existsSync(logFilePath)).toBe(false)

    await waitFor(() => existsSync(logFilePath), 1000)

    expect(existsSync(logFilePath)).toBe(true)
    const content = readFileSync(logFilePath, 'utf-8')
    expect(content).toContain('hello')
  })

  it('rotates logs when file size exceeds limits', async () => {
    const { MsgStoreService, sessionRoot } = await setupMsgStore({
      VIBEWORK_LOG_BATCH_MAX_BYTES: '1',
      VIBEWORK_LOG_FLUSH_INTERVAL_MS: '1',
      VIBEWORK_LOG_MAX_BYTES: '200',
      VIBEWORK_LOG_MAX_FILES: '2'
    })

    const store = new MsgStoreService(undefined, 'task-b', 'session-b', 'project', 'node-b')
    const logFilePath = join(sessionRoot, 'task-b', 'node-b.jsonl')

    for (let i = 0; i < 10; i += 1) {
      store.push({ type: 'stdout', content: 'x'.repeat(80) } as any)
    }

    await waitFor(() => existsSync(logFilePath), 1000)
    await waitFor(() => existsSync(`${logFilePath}.1`), 1000)

    expect(existsSync(logFilePath)).toBe(true)
    expect(existsSync(`${logFilePath}.1`)).toBe(true)
  })

  it('stores and loads logs by task node file', async () => {
    const { MsgStoreService, sessionRoot } = await setupMsgStore({
      VIBEWORK_LOG_BATCH_MAX_BYTES: '1000000',
      VIBEWORK_LOG_FLUSH_INTERVAL_MS: '10',
      VIBEWORK_LOG_MAX_BYTES: '1000000',
      VIBEWORK_LOG_MAX_FILES: '1'
    })

    const store = new MsgStoreService(undefined, 'task-c', 'session-c', 'project', 'node-1')
    const nodeLogPath = join(sessionRoot, 'task-c', 'node-1.jsonl')

    store.push({ type: 'stdout', content: 'node-1-only' } as any)
    await waitFor(() => existsSync(nodeLogPath), 1000)

    expect(existsSync(nodeLogPath)).toBe(true)

    const nodeHistory = MsgStoreService.loadFromFile('task-c', 'node-1', 'project') as Array<{ content?: string }>
    expect(nodeHistory.some((entry) => entry.content?.includes('node-1-only'))).toBe(true)

    const otherNodeHistory = MsgStoreService.loadFromFile('task-c', 'node-2', 'project')
    expect(otherNodeHistory.length).toBe(0)
  })
})
