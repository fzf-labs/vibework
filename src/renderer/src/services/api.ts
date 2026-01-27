// IPC 调用封装基类
export class ApiService {
  protected async call<T>(channel: string, ...args: unknown[]): Promise<T> {
    try {
      const api = window.api as Record<string, (...args: unknown[]) => Promise<T>>
      return await api[channel](...args)
    } catch (error) {
      console.error(`API call failed: ${channel}`, error)
      throw error
    }
  }
}
