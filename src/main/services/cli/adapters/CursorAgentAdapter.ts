import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asStringArray, pushFlag, pushFlagWithValue } from './config-utils'

type RecordLike = Record<string, unknown>

const AUTH_REQUIRED_PATTERNS = [
  /authentication required/i,
  /cursor-agent login/i,
  /cursor[_-]?api[_-]?key/i,
  /secitemcopymatching failed/i
]

function isAuthRequired(line: string): boolean {
  return AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(line))
}

export class CursorAgentAdapter implements CliAdapter {
  id = 'cursor-agent'
  private adapter: ProcessCliAdapter
  private resumeIds = new Map<string, string>()
  private stdoutBuffers = new Map<string, string>()

  private log(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info('[CursorAgentAdapter]', message, meta)
    } else {
      console.info('[CursorAgentAdapter]', message)
    }
  }

  private redactArgs(args: string[]): string[] {
    const redacted = [...args]
    for (let i = 0; i < redacted.length; i += 1) {
      const entry = redacted[i]
      if (entry === '--api-key') {
        if (redacted[i + 1]) {
          redacted[i + 1] = '***'
        }
        i += 1
        continue
      }
      if (entry.startsWith('--api-key=')) {
        redacted[i] = '--api-key=***'
      }
    }
    return redacted
  }

  constructor() {
    this.adapter = new ProcessCliAdapter({
      id: this.id,
      buildCommand: (options: CliStartOptions) => {
        const command = options.executablePath || 'cursor-agent'
        const toolConfig = options.toolConfig ?? {}
        const resumeId = this.getResumeId(options)
        const args: string[] = []

        // Keep stable machine-readable output format.
        args.push('-p')
        args.push('--output-format=stream-json')
        if (resumeId) {
          args.push('--resume', resumeId)
        }

        pushFlagWithValue(args, '--api-key', (toolConfig as Record<string, unknown>).api_key)
        pushFlag(args, '--force', asBoolean((toolConfig as Record<string, unknown>).force))
        pushFlagWithValue(args, '--model', (toolConfig as Record<string, unknown>).model)

        const additionalParams = asStringArray(
          (toolConfig as Record<string, unknown>).additional_params
        )
        if (additionalParams) {
          args.push(...additionalParams)
        }

        const env = {
          ...(options.env ?? {})
        } as Record<string, string>

        const prompt = options.prompt?.trim()
        if (prompt) {
          args.push(prompt)
        }

        this.log('buildCommand', {
          sessionId: options.sessionId,
          workdir: options.workdir,
          command,
          args: this.redactArgs(args),
          resumeId: resumeId ?? null,
          toolConfigKeys: Object.keys(toolConfig as Record<string, unknown>),
          envCursorKey: Boolean(env.CURSOR_API_KEY),
          promptLength: options.prompt ? options.prompt.length : 0
        })

        return {
          command,
          args,
          cwd: options.workdir,
          env,
          initialInput: undefined,
          closeStdinAfterInput: true
        }
      },
      detectCompletion: (line) => {
        const msg = parseJsonLine(line)
        if (!msg) return null
        if (msg.type === 'result') {
          const subtype = msg.subtype as string | undefined
          const isError = msg.is_error as boolean | undefined
          if (subtype === 'error' || isError === true) return failureSignal('result')
          return successSignal('result')
        }
        if (msg.type === 'error') return failureSignal('error')
        return null
      },
      detectStderrCompletion: (line) => {
        if (isAuthRequired(line)) {
          return failureSignal('auth-required')
        }
        return null
      }
    })
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const handle = await this.adapter.startSession(options)
    this.attachResumeTracking(handle, options.sessionId, options.onResumeIdCaptured)
    return handle
  }

  private getResumeId(options: CliStartOptions): string | undefined {
    const config = options.toolConfig as RecordLike | undefined
    const configured =
      this.getString(config?.resume) ||
      this.getString(config?.resumeId) ||
      this.getString(config?.resume_id) ||
      this.getString(config?.sessionId) ||
      this.getString(config?.session_id) ||
      this.getString(config?.conversationId) ||
      this.getString(config?.conversation_id) ||
      this.getString(config?.threadId) ||
      this.getString(config?.thread_id)
    return configured || this.resumeIds.get(options.sessionId)
  }

  private attachResumeTracking(
    handle: CliSessionHandle,
    sessionId: string,
    onResumeIdCaptured?: (resumeId: string) => void | Promise<void>
  ): void {
    let buffer = this.stdoutBuffers.get(sessionId) ?? ''

    const onOutput = (data: { sessionId: string; type: 'stdout' | 'stderr'; content: string }) => {
      if (data.sessionId !== sessionId || data.type !== 'stdout') return

      buffer += data.content
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const msg = parseJsonLine(line)
        if (!msg || typeof msg !== 'object') continue
        const resumeId = this.extractResumeId(msg as RecordLike)
        if (resumeId) {
          if (this.resumeIds.get(sessionId) === resumeId) {
            continue
          }
          this.resumeIds.set(sessionId, resumeId)
          this.log('resumeIdCaptured', { sessionId, resumeId })
          if (onResumeIdCaptured) {
            try {
              const maybePromise = onResumeIdCaptured(resumeId)
              if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
                void (maybePromise as Promise<void>).catch((error: unknown) => {
                  console.warn('[CursorAgentAdapter] Failed to persist resume id:', error)
                })
              }
            } catch (error) {
              console.warn('[CursorAgentAdapter] Failed to persist resume id:', error)
            }
          }
        }
      }

      this.stdoutBuffers.set(sessionId, buffer)
    }

    const cleanup = () => {
      this.stdoutBuffers.delete(sessionId)
      handle.off('output', onOutput)
      handle.off('close', onClose)
      handle.off('error', onError)
    }

    const onClose = () => cleanup()
    const onError = () => cleanup()

    handle.on('output', onOutput)
    handle.on('close', onClose)
    handle.on('error', onError)
  }

  private extractResumeId(message: RecordLike): string | undefined {
    return this.extractResumeIdFromValue(message, 0, new Set<RecordLike>())
  }

  private extractResumeIdFromValue(
    value: unknown,
    depth: number,
    seen: Set<RecordLike>
  ): string | undefined {
    if (depth > 6) return undefined

    if (Array.isArray(value)) {
      for (const item of value) {
        const fromItem = this.extractResumeIdFromValue(item, depth + 1, seen)
        if (fromItem) return fromItem
      }
      return undefined
    }

    const record = this.asRecord(value)
    if (!record) return undefined
    if (seen.has(record)) return undefined
    seen.add(record)

    const direct = this.getKnownResumeId(record)
    if (direct) return direct

    const nestedCandidates = [
      record.session,
      record.conversation,
      record.thread,
      record.params,
      record.result,
      record.data,
      record.payload,
      record.event,
      record.message,
      record.context
    ]

    for (const candidate of nestedCandidates) {
      const nested = this.extractResumeIdFromValue(candidate, depth + 1, seen)
      if (nested) return nested
    }

    for (const candidate of Object.values(record)) {
      const nested = this.extractResumeIdFromValue(candidate, depth + 1, seen)
      if (nested) return nested
    }

    return undefined
  }

  private getKnownResumeId(record: RecordLike): string | undefined {
    const direct =
      this.getString(record.sessionId) ||
      this.getString(record.session_id) ||
      this.getString(record.conversationId) ||
      this.getString(record.conversation_id) ||
      this.getString(record.threadId) ||
      this.getString(record.thread_id)
    if (direct) return direct

    const recordType = this.getString(record.type)?.toLowerCase()
    if (
      recordType &&
      (recordType.includes('session') ||
        recordType.includes('conversation') ||
        recordType.includes('thread'))
    ) {
      const typedId = this.getString(record.id)
      if (typedId) return typedId
    }

    return undefined
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private asRecord(value: unknown): RecordLike | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as RecordLike)
      : null
  }
}
