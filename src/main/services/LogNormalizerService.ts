import { NormalizedEntry } from '../types/log'

/**
 * 日志标准化适配器接口
 */
export interface LogNormalizerAdapter {
  toolId: string
  parse(line: string): NormalizedEntry | NormalizedEntry[] | null
}

/**
 * 日志标准化服务
 */
export class LogNormalizerService {
  private adapters: Map<string, LogNormalizerAdapter> = new Map()

  /**
   * 注册适配器
   */
  registerAdapter(adapter: LogNormalizerAdapter): void {
    this.adapters.set(adapter.toolId, adapter)
  }

  /**
   * 获取适配器
   */
  getAdapter(toolId: string): LogNormalizerAdapter | undefined {
    return this.adapters.get(toolId)
  }

  /**
   * 标准化日志行
   */
  normalize(toolId: string, line: string): NormalizedEntry | NormalizedEntry[] | null {
    const adapter = this.adapters.get(toolId)
    if (!adapter) {
      return null
    }
    return adapter.parse(line)
  }

  /**
   * 获取所有已注册的工具 ID
   */
  getRegisteredTools(): string[] {
    return Array.from(this.adapters.keys())
  }
}
