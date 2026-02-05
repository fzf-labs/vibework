import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asString, asStringArray, pushFlag, pushFlagWithValue } from './config-utils'

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

  private log(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info('[CursorAgentAdapter]', message, meta)
    } else {
      console.info('[CursorAgentAdapter]', message)
    }
  }

  private redactHeader(value: string): string {
    const idx = value.indexOf(':')
    if (idx === -1) return value
    const name = value.slice(0, idx).trim()
    if (/authorization|api[-_]?key|token/i.test(name)) {
      return `${name}: ***`
    }
    return value
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
        continue
      }
      if (entry === '--header' && redacted[i + 1]) {
        redacted[i + 1] = this.redactHeader(redacted[i + 1])
        i += 1
      }
    }
    return redacted
  }

  constructor() {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'cursor-agent'
          const toolConfig = options.toolConfig ?? {}
          const args: string[] = []

          const print = asBoolean((toolConfig as Record<string, unknown>).print)
          if (print !== false) {
            args.push('-p')
          }

          const outputFormat = asString((toolConfig as Record<string, unknown>).outputFormat)
          if (outputFormat) {
            args.push('--output-format', outputFormat)
          } else {
            args.push('--output-format=stream-json')
          }

          pushFlag(args, '--stream-partial-output', asBoolean((toolConfig as Record<string, unknown>).streamPartialOutput))
          pushFlag(args, '--cloud', asBoolean((toolConfig as Record<string, unknown>).cloud))
          pushFlagWithValue(args, '--mode', (toolConfig as Record<string, unknown>).mode)
          pushFlag(args, '--plan', asBoolean((toolConfig as Record<string, unknown>).plan))
          pushFlagWithValue(args, '--resume', (toolConfig as Record<string, unknown>).resume)
          pushFlag(args, '--continue', asBoolean((toolConfig as Record<string, unknown>).continue))
          pushFlagWithValue(args, '--model', (toolConfig as Record<string, unknown>).model)
          pushFlag(args, '--force', asBoolean((toolConfig as Record<string, unknown>).force))
          pushFlagWithValue(args, '--sandbox', (toolConfig as Record<string, unknown>).sandbox)
          pushFlag(args, '--approve-mcps', asBoolean((toolConfig as Record<string, unknown>).approveMcps))
          pushFlagWithValue(args, '--workspace', (toolConfig as Record<string, unknown>).workspace)

          const headers = asStringArray((toolConfig as Record<string, unknown>).headers)
          if (headers) {
            for (const header of headers) {
              args.push('--header', header)
            }
          }

          const apiKey = asString((toolConfig as Record<string, unknown>).apiKey)
          if (apiKey) {
            args.push('--api-key', apiKey)
          }

          const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additionalArgs)
          if (additionalArgs) {
            args.push(...additionalArgs)
          }

          const env = {
            ...(options.env ?? {})
          } as Record<string, string>

          if (apiKey && !env.CURSOR_API_KEY) {
            env.CURSOR_API_KEY = apiKey
          }
          const prompt = options.prompt?.trim()
          if (prompt) {
            args.push(prompt)
          }
          this.log('buildCommand', {
            sessionId: options.sessionId,
            workdir: options.workdir,
            command,
            args: this.redactArgs(args),
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
      }
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return this.adapter.startSession(options)
  }
}
