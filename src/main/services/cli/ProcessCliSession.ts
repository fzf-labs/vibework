import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { DataBatcher } from '../DataBatcher'
import { LogNormalizerService } from '../LogNormalizerService'
import { MsgStoreService } from '../MsgStoreService'
import { CliCompletionSignal, CliSessionHandle, CliSessionStatus } from './types'
import { LogMsg, NormalizedEntry } from '../../types/log'

export interface ProcessCommandSpec {
  command: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
  initialInput?: string
}

export type CompletionDetector = (line: string) => CliCompletionSignal | null
export type StderrNormalizer = (line: string) => NormalizedEntry | NormalizedEntry[] | null

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
  private stderrNormalizer?: StderrNormalizer
  private normalizer?: LogNormalizerService

  constructor(
    sessionId: string,
    toolId: string,
    commandSpec: ProcessCommandSpec,
    detectCompletion: CompletionDetector,
    normalizer?: LogNormalizerService,
    detectStderrCompletion?: CompletionDetector,
    stderrNormalizer?: StderrNormalizer
  ) {
    super()
    this.sessionId = sessionId
    this.toolId = toolId
    this.detectCompletion = detectCompletion
    this.normalizer = normalizer
    this.detectStderrCompletion = detectStderrCompletion
    this.stderrNormalizer = stderrNormalizer
    this.msgStore = new MsgStoreService(undefined, sessionId)

    this.process = spawn(commandSpec.command, commandSpec.args, {
      cwd: commandSpec.cwd,
      env: commandSpec.env,
      shell: commandSpec.shell ?? true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.stdoutBatcher = new DataBatcher((data) => {
      this.msgStore.push({ type: 'stdout', content: data, timestamp: Date.now() })
      this.emit('output', { sessionId, type: 'stdout', content: data })
    })

    this.stderrBatcher = new DataBatcher((data) => {
      this.msgStore.push({ type: 'stderr', content: data, timestamp: Date.now() })
      this.emit('output', { sessionId, type: 'stderr', content: data })
    })

    this.process.stdout?.on('data', (data) => {
      this.handleStdoutChunk(data)
      this.stdoutBatcher.write(data)
    })

    this.process.stderr?.on('data', (data) => {
      this.handleStderrChunk(data)
      this.stderrBatcher.write(data)
    })

    this.process.on('close', (code) => {
      this.stdoutBatcher.destroy()
      this.stderrBatcher.destroy()

      if (this.completionOverride) {
        this.status = this.completionOverride.status === 'success' ? 'stopped' : 'error'
      } else {
        this.status = code === 0 ? 'stopped' : 'error'
      }

      const finishedMsg: LogMsg = {
        type: 'finished',
        exitCode: code ?? undefined,
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
      this.status = 'error'
      this.emit('status', { sessionId, status: this.status })
      this.emit('error', { sessionId, error })
    })

    if (commandSpec.initialInput) {
      this.sendInput(commandSpec.initialInput)
    }
  }

  stop(): void {
    if (this.process.killed) return
    this.process.kill()
  }

  sendInput(input: string): void {
    if (!input.trim()) return
    try {
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
        this.stop()
      }

      if (this.normalizer) {
        const normalized = this.normalizer.normalize(this.toolId, line)
        if (normalized) {
          const entries = Array.isArray(normalized) ? normalized : [normalized]
          for (const entry of entries) {
            this.msgStore.push({ type: 'normalized', entry, timestamp: Date.now() })
          }
        }
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
        this.stop()
      }

      if (this.stderrNormalizer) {
        const normalized = this.stderrNormalizer(line)
        if (normalized) {
          const entries = Array.isArray(normalized) ? normalized : [normalized]
          for (const entry of entries) {
            this.msgStore.push({ type: 'normalized', entry, timestamp: Date.now() })
          }
        }
      }
    }
  }
}
