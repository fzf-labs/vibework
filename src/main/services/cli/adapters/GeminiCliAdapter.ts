import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import { asBoolean, asStringArray, pushFlag, pushFlagWithValue, pushRepeatableFlag } from './config-utils'

export class GeminiCliAdapter implements CliAdapter {
  id = 'gemini-cli'
  private adapter: ProcessCliAdapter

  constructor(normalizer?: LogNormalizerService) {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => {
          const command = options.executablePath || 'gemini'
          const toolConfig = options.toolConfig ?? {}
          const args: string[] = []

          const experimentalAcp = asBoolean((toolConfig as Record<string, unknown>).experimentalAcp)
          if (experimentalAcp !== false) {
            args.push('--experimental-acp')
          }

          pushFlagWithValue(args, '--model', (toolConfig as Record<string, unknown>).model)
          pushFlagWithValue(args, '--prompt', (toolConfig as Record<string, unknown>).prompt)
          pushFlagWithValue(args, '--prompt-interactive', (toolConfig as Record<string, unknown>).promptInteractive)
          pushFlag(args, '--sandbox', asBoolean((toolConfig as Record<string, unknown>).sandbox))
          pushFlag(args, '--yolo', asBoolean((toolConfig as Record<string, unknown>).yolo))
          pushFlagWithValue(args, '--approval-mode', (toolConfig as Record<string, unknown>).approvalMode)
          pushRepeatableFlag(args, '--allowed-mcp-server-names', (toolConfig as Record<string, unknown>).allowedMcpServerNames)
          pushRepeatableFlag(args, '--allowed-tools', (toolConfig as Record<string, unknown>).allowedTools)
          pushRepeatableFlag(args, '--extensions', (toolConfig as Record<string, unknown>).extensions)
          pushFlagWithValue(args, '--resume', (toolConfig as Record<string, unknown>).resume)
          pushRepeatableFlag(args, '--include-directories', (toolConfig as Record<string, unknown>).includeDirectories)
          pushFlagWithValue(args, '--output-format', (toolConfig as Record<string, unknown>).outputFormat)
          pushFlag(args, '--raw-output', asBoolean((toolConfig as Record<string, unknown>).rawOutput))
          pushFlag(args, '--accept-raw-output-risk', asBoolean((toolConfig as Record<string, unknown>).acceptRawOutputRisk))
          pushFlag(args, '--debug', asBoolean((toolConfig as Record<string, unknown>).debug))

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
