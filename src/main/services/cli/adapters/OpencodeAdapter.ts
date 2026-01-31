import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'

export class OpencodeAdapter implements CliAdapter {
  id = 'opencode'
  private adapter: ProcessCliAdapter

  constructor(normalizer?: LogNormalizerService) {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'opencode'
          const args: string[] = []
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
      },
      normalizer
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return this.adapter.startSession(options)
  }
}
