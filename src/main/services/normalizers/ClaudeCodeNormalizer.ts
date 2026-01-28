import { nanoid } from 'nanoid'
import { NormalizedEntry, NormalizedEntryType } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

/**
 * Claude Code stream-json 输出格式
 */
interface ContentItem {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

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
  // assistant/user 消息的嵌套结构
  message?: {
    content?: ContentItem[]
    role?: string
    model?: string
  }
  // tool_use_result 字段（user 消息中）
  tool_use_result?: {
    stdout?: string
    stderr?: string
    interrupted?: boolean
  }
  // result 消息的字段
  result?: string
  duration_ms?: number
  total_cost_usd?: number
  // system 消息的字段
  model?: string
  cwd?: string
  tools?: string[]
}

/**
 * Claude Code 日志标准化适配器
 */
export class ClaudeCodeNormalizer implements LogNormalizerAdapter {
  toolId = 'claude-code'

  parse(line: string): NormalizedEntry | NormalizedEntry[] | null {
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

  private parseMessage(msg: ClaudeCodeMessage): NormalizedEntry | NormalizedEntry[] | null {
    const timestamp = msg.timestamp || Date.now()

    switch (msg.type) {
      case 'assistant':
        return this.parseAssistantMessage(msg, timestamp)

      case 'user':
        return this.parseUserMessage(msg, timestamp)

      case 'system':
        return this.parseSystemMessage(msg, timestamp)

      case 'result':
        return this.parseResultMessage(msg, timestamp)

      case 'tool_use':
        return this.createToolUse(msg, timestamp)

      case 'tool_result':
        return this.createToolResult(msg, timestamp)

      case 'control_response':
        return this.createEntry('system_message', 'Session initialized', timestamp)

      default:
        return null
    }
  }

  /**
   * 解析 assistant 消息
   * 格式: {"type":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use",...}],...}}
   */
  private parseAssistantMessage(
    msg: ClaudeCodeMessage,
    timestamp: number
  ): NormalizedEntry | NormalizedEntry[] | null {
    const entries: NormalizedEntry[] = []

    if (msg.message?.content && Array.isArray(msg.message.content)) {
      for (const item of msg.message.content) {
        if (item.type === 'text' && item.text) {
          // 跳过 "(no content)" 占位符
          if (item.text !== '(no content)') {
            entries.push(this.createEntry('assistant_message', item.text, timestamp))
          }
        } else if (item.type === 'tool_use' && item.name) {
          entries.push(this.createToolUseFromContent(item, timestamp))
        }
      }
    } else if (msg.content) {
      entries.push(this.createEntry('assistant_message', msg.content, timestamp))
    }

    if (entries.length === 0) return null
    if (entries.length === 1) return entries[0]
    return entries
  }

  /**
   * 解析 user 消息（工具结果）
   * 格式: {"type":"user","message":{"content":[{"tool_use_id":"...","type":"tool_result","content":"..."}]},"tool_use_result":{...}}
   */
  private parseUserMessage(msg: ClaudeCodeMessage, timestamp: number): NormalizedEntry | null {
    // 优先使用 tool_use_result 中的详细信息
    if (msg.tool_use_result) {
      const stdout = msg.tool_use_result.stdout || ''
      const stderr = msg.tool_use_result.stderr || ''
      const content = stderr ? `${stdout}\n${stderr}` : stdout

      if (content) {
        return this.createEntry('tool_result', content.trim(), timestamp)
      }
    }

    // 回退到 message.content
    if (msg.message?.content && Array.isArray(msg.message.content)) {
      for (const item of msg.message.content) {
        if (item.type === 'tool_result' && item.content) {
          return {
            id: nanoid(),
            type: 'tool_result',
            timestamp,
            content: item.content,
            metadata: {
              toolUseId: item.tool_use_id,
              isError: item.is_error
            }
          }
        }
      }
    }

    return null
  }

  /**
   * 解析 system 消息
   * 格式: {"type":"system","subtype":"init","model":"...","tools":[...],...}
   */
  private parseSystemMessage(msg: ClaudeCodeMessage, timestamp: number): NormalizedEntry | null {
    let content = ''

    if (msg.subtype === 'init') {
      const model = msg.model || 'unknown'
      content = `System initialized with model: ${model}`
    } else if (msg.content) {
      content = msg.content
    } else if (msg.subtype) {
      content = `System: ${msg.subtype}`
    }

    if (!content) return null

    return this.createEntry('system_message', content, timestamp)
  }

  /**
   * 解析 result 消息
   * 格式: {"type":"result","subtype":"success","result":"...","duration_ms":...,"total_cost_usd":...}
   */
  private parseResultMessage(msg: ClaudeCodeMessage, timestamp: number): NormalizedEntry | null {
    const duration = msg.duration_ms ? `${(msg.duration_ms / 1000).toFixed(1)}s` : ''
    const cost = msg.total_cost_usd ? `$${msg.total_cost_usd.toFixed(4)}` : ''
    const status = msg.subtype === 'success' ? '✓' : '✗'

    const content = `${status} Completed ${duration ? `in ${duration}` : ''} ${cost ? `(${cost})` : ''}`.trim()

    return this.createEntry('system_message', content, timestamp)
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

  /**
   * 从 assistant 消息的 content 数组中创建工具调用条目
   */
  private createToolUseFromContent(item: ContentItem, timestamp: number): NormalizedEntry {
    const toolName = item.name || 'unknown'
    let type: NormalizedEntryType = 'tool_use'

    if (toolName === 'Bash' || toolName === 'execute') {
      type = 'command_run'
    } else if (toolName === 'Edit' || toolName === 'Write') {
      type = 'file_edit'
    } else if (toolName === 'Read') {
      type = 'file_read'
    }

    // 格式化工具输入为可读内容
    let content = ''
    if (item.input) {
      if (toolName === 'Bash' && item.input.command) {
        content = `$ ${item.input.command}`
      } else if ((toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') && item.input.file_path) {
        content = String(item.input.file_path)
      } else {
        content = JSON.stringify(item.input, null, 2)
      }
    }

    return {
      id: nanoid(),
      type,
      timestamp,
      content,
      metadata: {
        toolName,
        toolInput: item.input,
        toolUseId: item.id,
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
