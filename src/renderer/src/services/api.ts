// IPC 调用封装基类
export class ApiService {
  protected async call<T>(channel: string, ...args: any[]): Promise<T> {
    try {
      return await (window.api as any)[channel](...args)
    } catch (error) {
      console.error(`API call failed: ${channel}`, error)
      throw error
    }
  }
}
