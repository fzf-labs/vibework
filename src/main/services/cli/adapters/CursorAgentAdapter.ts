import { nanoid } from 'nanoid'
import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { NormalizedEntry } from '../../types/log'

const AUTH_REQUIRED_PATTERNS = [
  /authentication required/i,
  /cursor-agent login/i,
  /cursor[_-]?api[_-]?key/i,
  /secitemcopymatching failed/i
]

function isAuthRequired(line: string): boolean {
  return AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(line))
}

function buildAuthRequiredEntry(line: string): NormalizedEntry {
  return {
    id: nanoid(),
    type: 'error',
    timestamp: Date.now(),
    content: [
      'Cursor authentication required.',
      'Run `cursor-agent login` or set CURSOR_API_KEY, then retry.',
      `Details: ${line}`
    ].join('\n')
  }
}

export class CursorAgentAdapter implements CliAdapter {
  id = 'cursor-agent'
  private adapter: ProcessCliAdapter

  constructor(normalizer?: LogNormalizerService) {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'cursor-agent'
          const args = ['-p', '--output-format=stream-json']
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
        },
        normalizeStderr: (line) => {
          if (isAuthRequired(line)) {
            return buildAuthRequiredEntry(line)
          }
          return null
        }
      },
      normalizer
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return this.adapter.startSession(options)
  }
}
