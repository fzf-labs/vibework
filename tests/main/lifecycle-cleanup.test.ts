import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { PipelineService } from '../../src/main/services/PipelineService'
import { PreviewService } from '../../src/main/services/PreviewService'
import { registerCliSessionIpc } from '../../src/main/ipc/cli-session.ipc'
import { v } from '../../src/main/utils/ipc-response'

describe('pipeline cancellation', () => {
  it('terminates running stage processes on cancel', () => {
    const service = new PipelineService()
    const kill = vi.fn()

    const execution = {
      id: 'exec-1',
      pipelineId: 'pipe-1',
      status: 'running',
      stageExecutions: [
        {
          id: 'stage-1',
          stageId: 'stage',
          status: 'running',
          process: { kill } as any
        }
      ],
      startedAt: new Date()
    }

    ;(service as any).executions.set('exec-1', execution)

    service.cancelExecution('exec-1')

    expect(execution.status).toBe('cancelled')
    expect(execution.stageExecutions[0].status).toBe('failed')
    expect(kill).toHaveBeenCalledWith('SIGTERM')
  })
})

describe('preview stop behavior', () => {
  it('waits for exit and escalates to SIGKILL after timeout', async () => {
    const service = new PreviewService()
    const instanceId = 'preview-1'
    const instance = {
      id: instanceId,
      configId: 'cfg',
      status: 'running',
      startedAt: new Date().toISOString()
    }

    const child = new EventEmitter() as any
    child.exitCode = null
    child.killed = false
    const killCalls: string[] = []
    child.kill = (signal?: NodeJS.Signals) => {
      if (signal) killCalls.push(signal)
      return true
    }

    ;(service as any).instances.set(instanceId, instance)
    ;(service as any).processes.set(instanceId, child)

    vi.useFakeTimers()
    const stopPromise = service.stopPreview(instanceId)

    expect(killCalls).toEqual(['SIGTERM'])

    await vi.advanceTimersByTimeAsync(5000)
    expect(killCalls).toContain('SIGKILL')

    child.emit('exit', 0)
    await stopPromise
    vi.useRealTimers()
  })
})

describe('log stream subscription cleanup', () => {
  it('removes subscriptions on webContents destroyed', () => {
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const unsubscribe = vi.fn()
    const cliSessionService = {
      subscribeToSession: vi.fn(() => unsubscribe),
      getSessionLogHistory: vi.fn(() => [])
    }

    registerCliSessionIpc({
      services: { cliSessionService } as any,
      handle: (channel, _validators, handler) => {
        handlers[channel] = handler
      },
      v,
      resolveProjectIdForSession: () => null
    } as any)

    const webContents = new EventEmitter() as any
    webContents.id = 1
    webContents.isDestroyed = () => false
    webContents.send = vi.fn()

    handlers['logStream:subscribe']({ sender: webContents }, 'session-1')
    webContents.emit('destroyed')

    expect(unsubscribe).toHaveBeenCalled()
  })
})
