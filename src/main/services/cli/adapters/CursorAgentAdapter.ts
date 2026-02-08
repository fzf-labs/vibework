import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asStringArray, pushFlag, pushFlagWithValue } from './config-utils'

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
        const args: string[] = []

        // Keep stable machine-readable output format.
        args.push('-p')
        args.push('--output-format=stream-json')

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
    return this.adapter.startSession(options)
  }
}
