import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

interface PreviewInstance {
  id: string
  configId: string
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  pid?: number
  port?: number
  startedAt?: string
  error?: string
}

export class PreviewExecutor extends EventEmitter {
  private instances: Map<string, PreviewInstance> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private outputBuffers: Map<string, string[]> = new Map()

  startPreview(
    instanceId: string,
    configId: string,
    command: string,
    args: string[],
    cwd?: string,
    env?: Record<string, string>
  ): void {
    // 检查是否已经在运行
    if (this.instances.has(instanceId)) {
      throw new Error(`Preview instance ${instanceId} already exists`)
    }

    // 创建实例记录
    const instance: PreviewInstance = {
      id: instanceId,
      configId,
      status: 'starting',
      startedAt: new Date().toISOString()
    }
    this.instances.set(instanceId, instance)
    this.outputBuffers.set(instanceId, [])

    try {
      // 启动进程
      const process = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        shell: true
      })

      this.processes.set(instanceId, process)
      instance.pid = process.pid
      instance.status = 'running'

      // 监听输出
      process.stdout?.on('data', (data) => {
        this.handleOutput(instanceId, data.toString())
      })

      process.stderr?.on('data', (data) => {
        this.handleOutput(instanceId, data.toString())
      })

      // 监听进程退出
      process.on('exit', (code) => {
        this.handleExit(instanceId, code)
      })

      process.on('error', (error) => {
        this.handleError(instanceId, error)
      })

      this.emit('started', instanceId)
    } catch (error) {
      instance.status = 'error'
      instance.error = String(error)
      this.emit('error', instanceId, error)
      throw error
    }
  }

  stopPreview(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Preview instance ${instanceId} not found`)
    }

    const process = this.processes.get(instanceId)
    if (process) {
      instance.status = 'stopping'
      process.kill()
    }
  }

  restartPreview(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Preview instance ${instanceId} not found`)
    }

    this.stopPreview(instanceId)
    // 重启逻辑需要在外部处理,因为需要配置信息
  }

  getInstance(instanceId: string): PreviewInstance | undefined {
    return this.instances.get(instanceId)
  }

  getAllInstances(): PreviewInstance[] {
    return Array.from(this.instances.values())
  }

  getOutput(instanceId: string, limit: number = 100): string[] {
    const buffer = this.outputBuffers.get(instanceId) || []
    return buffer.slice(-limit)
  }

  private handleOutput(instanceId: string, data: string): void {
    const buffer = this.outputBuffers.get(instanceId) || []
    const lines = data.split('\n').filter(line => line.trim())
    buffer.push(...lines)

    // 限制缓冲区大小
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000)
    }

    this.emit('output', instanceId, lines)
  }

  private handleExit(instanceId: string, code: number | null): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.status = code === 0 ? 'stopped' : 'error'
      if (code !== 0) {
        instance.error = `Process exited with code ${code}`
      }
    }
    this.processes.delete(instanceId)
    this.emit('exit', instanceId, code)
  }

  private handleError(instanceId: string, error: Error): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.status = 'error'
      instance.error = error.message
    }
    this.emit('error', instanceId, error)
  }

  clearInstance(instanceId: string): void {
    this.instances.delete(instanceId)
    this.processes.delete(instanceId)
    this.outputBuffers.delete(instanceId)
  }
}
