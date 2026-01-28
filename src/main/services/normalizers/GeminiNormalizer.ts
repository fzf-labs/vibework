import { nanoid } from 'nanoid'
import { NormalizedEntry } from '../../types/log'
import { LogNormalizerAdapter } from '../LogNormalizerService'

/**
 * Gemini CLI 日志标准化适配器
 */
export class GeminiNormalizer implements LogNormalizerAdapter {
  toolId = 'gemini-cli'

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
    const role = msg.role as string

    if (role === 'model' || role === 'assistant') {
      return {
        id: nanoid(),
        type: 'assistant_message',
        timestamp,
        content: (msg.text as string) || (msg.content as string) || ''
      }
    }

    if (role === 'user') {
      return {
        id: nanoid(),
        type: 'user_message',
        timestamp,
        content: (msg.text as string) || (msg.content as string) || ''
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
