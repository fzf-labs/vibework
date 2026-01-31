import { EventEmitter } from 'events'
import { ClaudeCodeService } from '../../ClaudeCodeService'
import { MsgStoreService } from '../../MsgStoreService'
import { CliAdapter, CliCompletionSignal, CliSessionHandle, CliSessionStatus, CliStartOptions } from '../types'
import { failureSignal, parseJsonLine, successSignal } from './completion'

class ClaudeSessionHandle extends EventEmitter implements CliSessionHandle {
  sessionId: string
  toolId: string
  status: CliSessionStatus = 'running'
  msgStore: MsgStoreService

  private service: ClaudeCodeService
  private completionOverride: CliCompletionSignal | null = null
  private stdoutBuffer = ''
  private onOutputBound: (data: { sessionId: string; type: string; content: string }) => void
  private onCloseBound: (data: { sessionId: string; code: number }) => void
  private onErrorBound: (data: { sessionId: string; error: string }) => void

  constructor(service: ClaudeCodeService, options: CliStartOptions) {
    super()
    this.service = service
    this.sessionId = options.sessionId
    this.toolId = options.toolId
    this.msgStore = service.getSessionMsgStore(options.sessionId) || new MsgStoreService(undefined, options.sessionId)

    this.onOutputBound = (data) => {
      if (data.sessionId !== this.sessionId) return
      this.emit('output', data)
      this.handleOutputChunk(data.content)
    }

    this.onCloseBound = (data) => {
      if (data.sessionId !== this.sessionId) return
      if (!this.completionOverride) {
        this.status = data.code === 0 ? 'stopped' : 'error'
      }
      const forcedStatus = this.completionOverride
        ? (this.status as CliSessionStatus)
        : undefined
      this.emit('status', { sessionId: this.sessionId, status: this.status })
      this.emit('close', { sessionId: this.sessionId, code: data.code, forcedStatus })
      this.cleanup()
    }

    this.onErrorBound = (data) => {
      if (data.sessionId !== this.sessionId) return
      this.status = 'error'
      this.emit('status', { sessionId: this.sessionId, status: this.status })
      this.emit('error', { sessionId: this.sessionId, error: data.error })
    }

    this.service.on('output', this.onOutputBound)
    this.service.on('close', this.onCloseBound)
    this.service.on('error', this.onErrorBound)
  }

  stop(): void {
    try {
      this.service.stopSession(this.sessionId)
    } catch {
      // ignore
    }
  }

  sendInput(input: string): void {
    const trimmed = input.trim()
    if (!trimmed) return
    const parsed = parseJsonLine(trimmed)
    const payload = parsed && typeof parsed.type === 'string'
      ? trimmed
      : JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: input
          }
        })
    this.service.sendInput(this.sessionId, payload)
  }

  private handleOutputChunk(chunk: string): void {
    this.stdoutBuffer += chunk
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const completion = detectClaudeCompletion(line)
      if (completion && !this.completionOverride) {
        this.completionOverride = completion
        this.status = completion.status === 'success' ? 'stopped' : 'error'
        this.emit('status', { sessionId: this.sessionId, status: this.status, forced: true })
        this.stop()
      }
    }
  }

  private cleanup(): void {
    this.service.off('output', this.onOutputBound)
    this.service.off('close', this.onCloseBound)
    this.service.off('error', this.onErrorBound)
  }
}

function detectClaudeCompletion(line: string): CliCompletionSignal | null {
  const msg = parseJsonLine(line)
  if (!msg) return null
  if (msg.type === 'error') return failureSignal('error')
  if (msg.type !== 'result') return null

  const subtype = msg.subtype as string | undefined
  const isError = msg.is_error as boolean | undefined
  if (subtype === 'success' || isError === false) return successSignal('result')
  if (subtype === 'error' || isError === true) return failureSignal('result')
  return successSignal('result')
}

export class ClaudeCodeAdapter implements CliAdapter {
  id = 'claude-code'
  private service: ClaudeCodeService

  constructor(service: ClaudeCodeService) {
    this.service = service
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const model =
      options.model || (options.toolConfig?.model as string | undefined)
    this.service.startSession(options.sessionId, options.workdir, {
      prompt: options.prompt,
      model
    })
    return new ClaudeSessionHandle(this.service, options)
  }
}
