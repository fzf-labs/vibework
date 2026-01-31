import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'

export class GeminiCliAdapter implements CliAdapter {
  id = 'gemini-cli'
  private adapter: ProcessCliAdapter

  constructor(normalizer?: LogNormalizerService) {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'gemini'
          const args = ['--experimental-acp']
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

          if (Object.prototype.hasOwnProperty.call(msg, 'Done')) {
            return successSignal('acp-done')
          }
          if (Object.prototype.hasOwnProperty.call(msg, 'Error')) {
            return failureSignal('acp-error')
          }
          if (msg.type === 'error') return failureSignal('error')
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
