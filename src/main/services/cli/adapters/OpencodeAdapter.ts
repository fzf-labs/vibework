import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asStringArray, pushFlag, pushFlagWithValue, pushRepeatableFlag } from './config-utils'

type RecordLike = Record<string, unknown>

export class OpencodeAdapter implements CliAdapter {
  id = 'opencode'
  private adapter: ProcessCliAdapter
  private resumeIds = new Map<string, string>()
  private stdoutBuffers = new Map<string, string>()

  constructor() {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'opencode'
          const toolConfig = options.toolConfig ?? {}
          const resumeId = this.getResumeId(options)
          const args: string[] = []

          pushFlagWithValue(args, '--model', (toolConfig as Record<string, unknown>).model)
          const continueFlag = asBoolean((toolConfig as Record<string, unknown>).continue)
          pushFlag(args, '--continue', resumeId ? undefined : continueFlag)
          pushFlagWithValue(args, '--session', resumeId)
          pushFlagWithValue(args, '--prompt', (toolConfig as Record<string, unknown>).prompt)
          pushFlagWithValue(args, '--agent', (toolConfig as Record<string, unknown>).agent)
          pushFlag(args, '--print-logs', asBoolean((toolConfig as Record<string, unknown>).printLogs))
          pushFlagWithValue(args, '--log-level', (toolConfig as Record<string, unknown>).logLevel)
          pushFlagWithValue(args, '--port', (toolConfig as Record<string, unknown>).port)
          pushFlagWithValue(args, '--hostname', (toolConfig as Record<string, unknown>).hostname)
          pushFlag(args, '--mdns', asBoolean((toolConfig as Record<string, unknown>).mdns))
          pushFlagWithValue(args, '--mdns-domain', (toolConfig as Record<string, unknown>).mdnsDomain)
          pushRepeatableFlag(args, '--cors', (toolConfig as Record<string, unknown>).cors)

          const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additional_params)
          if (additionalArgs) {
            args.push(...additionalArgs)
          }
          return {
            command,
            args,
            cwd: options.workdir,
            env: options.env,
            initialInput: options.prompt
          }
        },
        detectCompletion: (line) => {
          const msg = parseJsonLine(line)
          if (!msg) return null

          if (msg.type === 'done') return successSignal('done')
          if (msg.type === 'error') return failureSignal('error')

          if (msg.type === 'sdk_event') {
            const event = msg.event as Record<string, unknown> | undefined
            const eventType = event?.type as string | undefined
            if (eventType === 'session.error') return failureSignal('session.error')
          }

          return null
        }
      }
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const handle = await this.adapter.startSession(options)
    this.attachResumeTracking(handle, options.sessionId, options.onResumeIdCaptured)
    return handle
  }

  private getResumeId(options: CliStartOptions): string | undefined {
    const config = options.toolConfig as RecordLike | undefined
    const configured =
      this.getString(config?.session) ||
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
        if (!resumeId || this.resumeIds.get(sessionId) === resumeId) continue
        this.resumeIds.set(sessionId, resumeId)
        if (!onResumeIdCaptured) continue
        try {
          const maybePromise = onResumeIdCaptured(resumeId)
          if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
            void (maybePromise as Promise<void>).catch((error: unknown) => {
              console.warn('[OpencodeAdapter] Failed to persist session id:', error)
            })
          }
        } catch (error) {
          console.warn('[OpencodeAdapter] Failed to persist session id:', error)
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
        const nested = this.extractResumeIdFromValue(item, depth + 1, seen)
        if (nested) return nested
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
