import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { DataBatcher } from '../../utils/data-batcher'
import { MsgStoreService } from '../MsgStoreService'
import { CliCompletionSignal, CliSessionHandle, CliSessionStatus } from './types'
import { LogMsgInput } from '../../types/log'
import { safeSpawn } from '../../utils/safe-exec'
import { config } from '../../config'

export interface InitSequenceStep {
  message: string | (() => string)
  delay?: number  // milliseconds
}

export interface ProcessCommandSpec {
  command: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
  initialInput?: string
  initSequence?: InitSequenceStep[]
  closeStdinAfterInput?: boolean
}

export type CompletionDetector = (line: string) => CliCompletionSignal | null

export class ProcessCliSession extends EventEmitter implements CliSessionHandle {
  sessionId: string
  toolId: string
  status: CliSessionStatus = 'running'
  msgStore: MsgStoreService

  private process: ChildProcess
  private stdoutBatcher: DataBatcher
  private stderrBatcher: DataBatcher
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private completionOverride: CliCompletionSignal | null = null
  private detectCompletion: CompletionDetector
  private detectStderrCompletion?: CompletionDetector
  private hasStdout = false
  private hasStderr = false
  private noOutputTimer?: NodeJS.Timeout
  private stillRunningTimer?: NodeJS.Timeout

  constructor(
    sessionId: string,
    toolId: string,
    commandSpec: ProcessCommandSpec,
    detectCompletion: CompletionDetector,
    detectStderrCompletion?: CompletionDetector,
    taskId?: string,
    projectId?: string | null,
    msgStore?: MsgStoreService
  ) {
    super()
    this.sessionId = sessionId
    this.toolId = toolId
    this.detectCompletion = detectCompletion
    this.detectStderrCompletion = detectStderrCompletion
    this.msgStore = msgStore ?? new MsgStoreService(undefined, taskId, sessionId, projectId)

    try {
      this.process = safeSpawn(commandSpec.command, commandSpec.args, {
        cwd: commandSpec.cwd,
        env: commandSpec.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        allowlist: config.commandAllowlist,
        label: 'ProcessCliSession'
      })
    } catch (error) {
      console.error('[ProcessCliSession] spawn_failed', {
        sessionId,
        toolId,
        command: commandSpec.command,
        argsCount: commandSpec.args.length,
        cwd: commandSpec.cwd,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    this.log('spawned', {
      pid: this.process.pid,
      command: commandSpec.command,
      argsCount: commandSpec.args.length,
      cwd: commandSpec.cwd,
      hasInitialInput: commandSpec.initialInput !== undefined,
      closeStdinAfterInput: Boolean(commandSpec.closeStdinAfterInput),
      initSequenceLength: commandSpec.initSequence?.length ?? 0
    })

    this.noOutputTimer = setTimeout(() => {
      if (!this.hasStdout && !this.hasStderr) {
        this.log('no_output_yet', {
          pid: this.process.pid,
          exitCode: this.process.exitCode,
          signalCode: this.process.signalCode,
          killed: this.process.killed,
          stdinWritable: this.process.stdin?.writable ?? false
        })
      }
    }, 3000)

    this.stillRunningTimer = setTimeout(() => {
      if (this.status === 'running' && !this.process.killed) {
        this.log('still_running', {
          pid: this.process.pid,
          exitCode: this.process.exitCode,
          signalCode: this.process.signalCode,
          hasStdout: this.hasStdout,
          hasStderr: this.hasStderr
        })
      }
    }, 15000)

    this.stdoutBatcher = new DataBatcher((data) => {
      this.msgStore.push({ type: 'stdout', content: data, timestamp: Date.now() })
      this.emit('output', { sessionId, type: 'stdout', content: data })
    })

    this.stderrBatcher = new DataBatcher((data) => {
      this.msgStore.push({ type: 'stderr', content: data, timestamp: Date.now() })
      this.emit('output', { sessionId, type: 'stderr', content: data })
    })

    this.process.stdout?.on('data', (data) => {
      if (!this.hasStdout) {
        this.hasStdout = true
        this.clearNoOutputTimer()
        this.log('stdout_first_chunk', {
          pid: this.process.pid,
          bytes: typeof data === 'string' ? data.length : data.byteLength
        })
      }
      this.handleStdoutChunk(data)
      this.stdoutBatcher.write(data)
    })

    this.process.stderr?.on('data', (data) => {
      if (!this.hasStderr) {
        this.hasStderr = true
        this.clearNoOutputTimer()
        this.log('stderr_first_chunk', {
          pid: this.process.pid,
          bytes: typeof data === 'string' ? data.length : data.byteLength
        })
      }
      this.handleStderrChunk(data)
      this.stderrBatcher.write(data)
    })

    this.process.on('close', (code, signal) => {
      this.clearNoOutputTimer()
      this.clearStillRunningTimer()
      this.stdoutBatcher.destroy()
      this.stderrBatcher.destroy()

      if (this.completionOverride) {
        this.status = this.completionOverride.status === 'success' ? 'stopped' : 'error'
      } else {
        this.status = code === 0 ? 'stopped' : 'error'
      }

      this.log('closed', { pid: this.process.pid, code, signal })

      const finishedMsg: LogMsgInput = {
        type: 'finished',
        exit_code: code ?? undefined,
        timestamp: Date.now()
      }
      this.msgStore.push(finishedMsg)

      const forcedStatus = this.completionOverride
        ? (this.status as CliSessionStatus)
        : undefined
      this.emit('status', { sessionId, status: this.status })
      this.emit('close', { sessionId, code, forcedStatus })
    })

    this.process.on('error', (error) => {
      this.clearNoOutputTimer()
      this.clearStillRunningTimer()
      this.status = 'error'
      this.emit('status', { sessionId, status: this.status })
      this.emit('error', { sessionId, error })
      this.log('process_error', {
        pid: this.process.pid,
        error: error instanceof Error ? error.message : String(error)
      })
    })

    if (commandSpec.initialInput !== undefined) {
      this.sendInput(commandSpec.initialInput)
    }

    if (commandSpec.initSequence?.length) {
      const initPromise = this.runInitSequence(commandSpec.initSequence)
      if (commandSpec.closeStdinAfterInput) {
        void initPromise.finally(() => {
          try {
            this.process.stdin?.end()
          } catch {
            // ignore
          }
        })
      }
    } else if (commandSpec.closeStdinAfterInput) {
      try {
        this.process.stdin?.end()
      } catch {
        // ignore
      }
    }
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info('[ProcessCliSession]', message, {
        sessionId: this.sessionId,
        toolId: this.toolId,
        ...meta
      })
    } else {
      console.info('[ProcessCliSession]', message, {
        sessionId: this.sessionId,
        toolId: this.toolId
      })
    }
  }

  private clearNoOutputTimer(): void {
    if (this.noOutputTimer) {
      clearTimeout(this.noOutputTimer)
      this.noOutputTimer = undefined
    }
  }

  private clearStillRunningTimer(): void {
    if (this.stillRunningTimer) {
      clearTimeout(this.stillRunningTimer)
      this.stillRunningTimer = undefined
    }
  }

  private async runInitSequence(sequence: InitSequenceStep[]): Promise<void> {
    for (const step of sequence) {
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay))
      }
      const msg = typeof step.message === 'function' ? step.message() : step.message
      this.process.stdin?.write(msg + '\n')
    }
  }

  stop(): void {
    if (this.process.killed) return
    this.process.kill()
  }

  sendInput(input: string): void {
    if (!input.trim()) return
    try {
      this.completionOverride = null
      if (this.status !== 'running') {
        this.status = 'running'
        this.emit('status', { sessionId: this.sessionId, status: this.status })
      }
      this.process.stdin?.write(input + '\n')
    } catch {
      // ignore
    }
  }

  private handleStdoutChunk(chunk: Buffer | string): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    this.stdoutBuffer += text

    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const completion = this.detectCompletion(line)
      if (completion && !this.completionOverride) {
        this.completionOverride = completion
        this.status = completion.status === 'success' ? 'stopped' : 'error'
        this.emit('status', { sessionId: this.sessionId, status: this.status, forced: true })
      }

    }
  }

  private handleStderrChunk(chunk: Buffer | string): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    this.stderrBuffer += text

    const lines = this.stderrBuffer.split('\n')
    this.stderrBuffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const completion = this.detectStderrCompletion?.(line)
      if (completion && !this.completionOverride) {
        this.completionOverride = completion
        this.status = completion.status === 'success' ? 'stopped' : 'error'
        this.emit('status', { sessionId: this.sessionId, status: this.status, forced: true })
      }

    }
  }
}
