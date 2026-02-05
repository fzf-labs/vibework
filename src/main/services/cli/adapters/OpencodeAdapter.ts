import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asStringArray, pushFlag, pushFlagWithValue, pushRepeatableFlag } from './config-utils'

export class OpencodeAdapter implements CliAdapter {
  id = 'opencode'
  private adapter: ProcessCliAdapter

  constructor() {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'opencode'
          const toolConfig = options.toolConfig ?? {}
          const args: string[] = []

          pushFlagWithValue(args, '--model', (toolConfig as Record<string, unknown>).model)
          pushFlag(args, '--continue', asBoolean((toolConfig as Record<string, unknown>).continue))
          pushFlagWithValue(args, '--session', (toolConfig as Record<string, unknown>).session)
          pushFlagWithValue(args, '--prompt', (toolConfig as Record<string, unknown>).prompt)
          pushFlagWithValue(args, '--agent', (toolConfig as Record<string, unknown>).agent)
          pushFlag(args, '--print-logs', asBoolean((toolConfig as Record<string, unknown>).printLogs))
          pushFlagWithValue(args, '--log-level', (toolConfig as Record<string, unknown>).logLevel)
          pushFlagWithValue(args, '--port', (toolConfig as Record<string, unknown>).port)
          pushFlagWithValue(args, '--hostname', (toolConfig as Record<string, unknown>).hostname)
          pushFlag(args, '--mdns', asBoolean((toolConfig as Record<string, unknown>).mdns))
          pushFlagWithValue(args, '--mdns-domain', (toolConfig as Record<string, unknown>).mdnsDomain)
          pushRepeatableFlag(args, '--cors', (toolConfig as Record<string, unknown>).cors)

          const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additionalArgs)
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
    return this.adapter.startSession(options)
  }
}
