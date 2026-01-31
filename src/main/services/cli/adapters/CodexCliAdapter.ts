import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'

function detectCodexCompletion(line: string) {
  const msg = parseJsonLine(line)
  if (!msg) return null

  if (msg.error) {
    return failureSignal('rpc-error')
  }

  const event = (msg.event || msg.method || msg.type) as string | undefined
  if (event) {
    const lowered = event.toLowerCase()
    if (lowered.includes('failed') || lowered.includes('error')) return failureSignal(event)
    if (lowered.includes('completed') || lowered.includes('done') || lowered.includes('success')) {
      return successSignal(event)
    }
  }

  const result = msg.result as Record<string, unknown> | undefined
  if (result) {
    const status = result.status as string | undefined
    const done = result.done as boolean | undefined
    if (status && status.toLowerCase().includes('fail')) return failureSignal(status)
    if (status && (status.toLowerCase().includes('complete') || status.toLowerCase().includes('success'))) {
      return successSignal(status)
    }
    if (done === true) return successSignal('done')
  }

  return null
}

export class CodexCliAdapter implements CliAdapter {
  id = 'codex'
  private adapter: ProcessCliAdapter

  constructor(normalizer?: LogNormalizerService) {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'codex'
          const args = ['app-server']
          return {
            command,
            args,
            cwd: options.workdir,
            env: options.env,
            initialInput: options.prompt
          }
        },
        detectCompletion: detectCodexCompletion
      },
      normalizer
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return this.adapter.startSession(options)
  }
}
