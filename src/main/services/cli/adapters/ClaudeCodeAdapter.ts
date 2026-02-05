import * as os from 'os'
import * as path from 'path'
import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliSession, InitSequenceStep } from '../ProcessCliSession'
import { LogNormalizerService } from '../../LogNormalizerService'
import { ClaudeCodeNormalizer } from '../../normalizers/ClaudeCodeNormalizer'
import { CLIToolConfigService } from '../../CLIToolConfigService'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import {
  asBoolean,
  asString,
  asStringArray,
  pushFlag,
  pushFlagWithValue,
  pushRepeatableFlag
} from './config-utils'

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

  private getExecutablePath(override?: string): string {
    if (override) return override
    const config = this.configService.getConfig('claude-code')
    const cmd = config.executablePath || 'claude'
    if (cmd === 'claude') {
      return path.join(os.homedir(), '.local/bin/claude')
    }
    return cmd
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const config = this.configService.getConfig('claude-code')
    const toolConfig = options.toolConfig ?? {}
    const model =
      options.model ||
      asString((toolConfig as Record<string, unknown>).model) ||
      config.defaultModel
    const homeDir = os.homedir()

    const args = [
      '-p',
      '--verbose',
      '--output-format=stream-json',
      '--input-format=stream-json',
      '--session-id', options.sessionId
    ]

    const allowDangerouslySkipPermissions = asBoolean(
      (toolConfig as Record<string, unknown>).allowDangerouslySkipPermissions
    )
    if (allowDangerouslySkipPermissions) {
      args.push('--allow-dangerously-skip-permissions')
    }

    const skipPermissions = asBoolean(
      (toolConfig as Record<string, unknown>).dangerouslySkipPermissions
    )
    if (skipPermissions === undefined || skipPermissions === true) {
      args.push('--dangerously-skip-permissions')
    }

    if (model) {
      args.push('--model', model)
    }

    pushFlagWithValue(args, '--agent', (toolConfig as Record<string, unknown>).agent)
    pushFlagWithValue(args, '--agents', (toolConfig as Record<string, unknown>).agentsJson)
    pushRepeatableFlag(args, '--add-dir', (toolConfig as Record<string, unknown>).addDir)

    const allowedTools = asStringArray((toolConfig as Record<string, unknown>).allowedTools)
    if (allowedTools) {
      args.push('--allowed-tools', allowedTools.join(','))
    }
    const disallowedTools = asStringArray((toolConfig as Record<string, unknown>).disallowedTools)
    if (disallowedTools) {
      args.push('--disallowed-tools', disallowedTools.join(','))
    }

    pushFlagWithValue(args, '--append-system-prompt', (toolConfig as Record<string, unknown>).appendSystemPrompt)
    pushFlagWithValue(args, '--system-prompt', (toolConfig as Record<string, unknown>).systemPrompt)
    pushFlagWithValue(args, '--permission-mode', (toolConfig as Record<string, unknown>).permissionMode)
    pushRepeatableFlag(args, '--mcp-config', (toolConfig as Record<string, unknown>).mcpConfig)
    pushFlag(args, '--strict-mcp-config', asBoolean((toolConfig as Record<string, unknown>).strictMcpConfig))
    pushFlagWithValue(args, '--settings', (toolConfig as Record<string, unknown>).settings)
    pushFlagWithValue(args, '--setting-sources', (toolConfig as Record<string, unknown>).settingSources)
    pushFlag(args, '--continue', asBoolean((toolConfig as Record<string, unknown>).continue))
    pushFlagWithValue(args, '--resume', (toolConfig as Record<string, unknown>).resume)
    pushFlagWithValue(args, '--output-format', (toolConfig as Record<string, unknown>).outputFormat)
    pushFlagWithValue(args, '--input-format', (toolConfig as Record<string, unknown>).inputFormat)
    pushFlag(args, '--include-partial-messages', asBoolean((toolConfig as Record<string, unknown>).includePartialMessages))
    pushFlag(args, '--replay-user-messages', asBoolean((toolConfig as Record<string, unknown>).replayUserMessages))
    pushFlag(args, '--no-session-persistence', asBoolean((toolConfig as Record<string, unknown>).noSessionPersistence))
    const debugValue = (toolConfig as Record<string, unknown>).debug
    if (typeof debugValue === 'string' && debugValue.trim()) {
      args.push('--debug', debugValue.trim())
    } else {
      pushFlag(args, '--debug', asBoolean(debugValue))
    }
    pushFlagWithValue(args, '--debug-file', (toolConfig as Record<string, unknown>).debugFile)
    pushFlag(args, '--verbose', asBoolean((toolConfig as Record<string, unknown>).verbose))
    pushRepeatableFlag(args, '--betas', (toolConfig as Record<string, unknown>).betas)
    pushFlagWithValue(args, '--fallback-model', (toolConfig as Record<string, unknown>).fallbackModel)
    pushFlagWithValue(args, '--max-budget-usd', (toolConfig as Record<string, unknown>).maxBudgetUsd)
    pushFlagWithValue(args, '--json-schema', (toolConfig as Record<string, unknown>).jsonSchema)
    pushFlagWithValue(args, '--tools', (toolConfig as Record<string, unknown>).tools)
    pushRepeatableFlag(args, '--file', (toolConfig as Record<string, unknown>).fileResources)
    pushFlag(args, '--chrome', asBoolean((toolConfig as Record<string, unknown>).chrome))
    pushFlag(args, '--no-chrome', asBoolean((toolConfig as Record<string, unknown>).noChrome))
    pushFlag(args, '--ide', asBoolean((toolConfig as Record<string, unknown>).ide))
    pushRepeatableFlag(args, '--plugin-dir', (toolConfig as Record<string, unknown>).pluginDir)

    const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additionalArgs)
    if (additionalArgs) {
      args.push(...additionalArgs)
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
        command: this.getExecutablePath(options.executablePath),
        args,
        cwd: options.workdir,
        env: {
          ...process.env,
          ...(options.env ?? {}),
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
