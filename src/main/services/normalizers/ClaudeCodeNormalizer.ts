import { nanoid } from 'nanoid'
import { NormalizedEntry, NormalizedEntryType } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

/**
 * Claude Code stream-json 输出格式
 */
interface ClaudeCodeMessage {
  type: string
  subtype?: string
  content?: string
  tool_use_id?: string
  name?: string
  input?: Record<string, unknown>
  output?: string
  is_error?: boolean
  session_id?: string
  timestamp?: number
}

/**
 * Claude Code 日志标准化适配器
 */
export class ClaudeCodeNormalizer implements LogNormalizerAdapter {
  toolId = 'claude-code'

  parse(line: string): NormalizedEntry | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
      const msg = JSON.parse(trimmed) as ClaudeCodeMessage
      return this.parseMessage(msg)
    } catch {
      // 非 JSON 输出作为系统消息
      return this.createSystemMessage(trimmed)
    }
  }

  private parseMessage(msg: ClaudeCodeMessage): NormalizedEntry | null {
    const timestamp = msg.timestamp || Date.now()

    switch (msg.type) {
      case 'assistant':
        return this.createEntry('assistant_message', msg.content || '', timestamp)

      case 'user':
        return this.createEntry('user_message', msg.content || '', timestamp)

      case 'system':
        return this.createEntry('system_message', msg.content || '', timestamp)

      case 'tool_use':
        return this.createToolUse(msg, timestamp)

      case 'tool_result':
        return this.createToolResult(msg, timestamp)

      default:
        return null
    }
  }

  private createEntry(
    type: NormalizedEntryType,
    content: string,
    timestamp: number
  ): NormalizedEntry {
    return {
      id: nanoid(),
      type,
      timestamp,
      content
    }
  }

  private createToolUse(msg: ClaudeCodeMessage, timestamp: number): NormalizedEntry {
    const toolName = msg.name || 'unknown'
    let type: NormalizedEntryType = 'tool_use'

    // 根据工具名称细分类型
    if (toolName === 'Bash' || toolName === 'execute') {
      type = 'command_run'
    } else if (toolName === 'Edit' || toolName === 'Write') {
      type = 'file_edit'
    } else if (toolName === 'Read') {
      type = 'file_read'
    }

    return {
      id: nanoid(),
      type,
      timestamp,
      content: JSON.stringify(msg.input || {}),
      metadata: {
        toolName,
        toolInput: msg.input,
        toolUseId: msg.tool_use_id,
        status: 'pending'
      }
    }
  }

  private createToolResult(msg: ClaudeCodeMessage, timestamp: number): NormalizedEntry {
    const output = msg.output || ''
    const exitCode = this.extractExitCode(output)

    return {
      id: nanoid(),
      type: 'tool_result',
      timestamp,
      content: output,
      metadata: {
        toolUseId: msg.tool_use_id,
        toolOutput: output,
        exitCode,
        status: msg.is_error ? 'failed' : 'success'
      }
    }
  }

  private extractExitCode(output: string): number | undefined {
    const match = output.match(/\[Process exited with code (\d+)\]/)
    return match ? parseInt(match[1], 10) : undefined
  }

  private createSystemMessage(content: string): NormalizedEntry {
    return {
      id: nanoid(),
      type: 'system_message',
      timestamp: Date.now(),
      content
    }
  }
}
