import * as os from 'os'
import * as path from 'path'
import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliSession, InitSequenceStep } from '../ProcessCliSession'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ClaudeCodeNormalizer } from '../../normalizers/ClaudeCodeNormalizer'
import { CLIToolConfigService } from '../../CLIToolConfigService'
import { failureSignal, parseJsonLine, successSignal } from './completion'

function detectClaudeCompletion(line: string) {
  const msg = parseJsonLine(line)
  if (!msg) return null
  if (msg.type === 'error') return failureSignal('error')
  if (msg.type !== 'result') return null

  const subtype = msg.subtype as string | undefined
  const isError = msg.is_error as boolean | undefined
  if (subtype === 'success' || isError === false) return successSignal('result')
  if (subtype === 'error' || isError === true) return failureSignal('result')
  return successSignal('result')
}

export class ClaudeCodeAdapter implements CliAdapter {
  id = 'claude-code'
  private configService: CLIToolConfigService
  private normalizer: LogNormalizerService

  constructor(configService: CLIToolConfigService) {
    this.configService = configService
    this.normalizer = new LogNormalizerService()
    this.normalizer.registerAdapter(new ClaudeCodeNormalizer())
  }

  private getExecutablePath(): string {
    const config = this.configService.getConfig('claude-code')
    const cmd = config.executablePath || 'claude'
    if (cmd === 'claude') {
      return path.join(os.homedir(), '.local/bin/claude')
    }
    return cmd
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const config = this.configService.getConfig('claude-code')
    const model = options.model || (options.toolConfig?.model as string) || config.defaultModel
    const homeDir = os.homedir()

    const args = [
      '-p',
      '--verbose',
      '--output-format=stream-json',
      '--input-format=stream-json',
      '--dangerously-skip-permissions',
      '--session-id', options.sessionId
    ]

    if (model) {
      args.push('--model', model)
    }

    const initSequence: InitSequenceStep[] = [
      {
        message: JSON.stringify({
          type: 'control_request',
          request_id: `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          request: { subtype: 'initialize' }
        })
      }
    ]

    if (options.prompt) {
      initSequence.push({
        delay: 100,
        message: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: options.prompt }
        })
      })
    }

    return new ProcessCliSession(
      options.sessionId,
      options.toolId,
      {
        command: this.getExecutablePath(),
        args,
        cwd: options.workdir,
        env: {
          ...process.env,
          PATH: `${homeDir}/.local/bin:/opt/homebrew/bin:${process.env.PATH || ''}`
        },
        initSequence
      },
      detectClaudeCompletion,
      this.normalizer,
      undefined,
      undefined,
      options.taskId,
      options.projectId,
      options.msgStore
    )
  }
}
