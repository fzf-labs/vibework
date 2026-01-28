import { nanoid } from 'nanoid'
import { NormalizedEntry } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

/**
 * Codex 日志标准化适配器
 */
export class CodexNormalizer implements LogNormalizerAdapter {
  toolId = 'codex'

  parse(line: string): NormalizedEntry | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
      const msg = JSON.parse(trimmed)
      return this.parseMessage(msg)
    } catch {
      return this.createSystemMessage(trimmed)
    }
  }

  private parseMessage(msg: Record<string, unknown>): NormalizedEntry | null {
    const timestamp = Date.now()
    const type = msg.type as string

    if (type === 'message' || type === 'response') {
      return {
        id: nanoid(),
        type: 'assistant_message',
        timestamp,
        content: (msg.content as string) || ''
      }
    }

    return null
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
