import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { MsgStoreService } from './MsgStoreService'
import { LogNormalizerService } from './LogNormalizerService'
import { ClaudeCodeNormalizer } from './normalizers/ClaudeCodeNormalizer'
import { LogMsg } from '../types/log'

interface MCPServer {
  name: string
  command: string
  args?: string[]
}

interface Skill {
  name: string
  command: string
  description?: string
}

interface ClaudeCodeConfig {
  executablePath?: string
  defaultModel?: string
  mcpServers?: MCPServer[]
  skills?: Skill[]
}

interface ClaudeCodeSession {
  id: string
  process: ChildProcess
  workdir: string
  status: 'running' | 'stopped' | 'error'
  output: string[]
  startTime: Date
  msgStore: MsgStoreService
}

export class ClaudeCodeService extends EventEmitter {
  private sessions: Map<string, ClaudeCodeSession> = new Map()
  private config: ClaudeCodeConfig
  private normalizer: LogNormalizerService

  constructor() {
    super()
    this.config = this.loadConfig()
    this.normalizer = new LogNormalizerService()
    this.normalizer.registerAdapter(new ClaudeCodeNormalizer())
  }

  private loadConfig(): ClaudeCodeConfig {
    const configPath = path.join(os.homedir(), '.vibework', 'claude-code.json')

    if (fs.existsSync(configPath)) {
      try {
        const data = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(data)
      } catch (error) {
        console.error('Failed to load Claude Code config:', error)
      }
    }

    // 返回默认配置
    return {
      executablePath: 'claude',
      defaultModel: 'sonnet'
    }
  }

  saveConfig(config: Partial<ClaudeCodeConfig>): void {
    this.config = { ...this.config, ...config }
    const configPath = path.join(os.homedir(), '.vibework', 'claude-code.json')
    const configDir = path.dirname(configPath)

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2))
  }

  getConfig(): ClaudeCodeConfig {
    return { ...this.config }
  }

  startSession(sessionId: string, workdir: string, options?: { model?: string }): void {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    const command = this.config.executablePath || 'claude'
    const args: string[] = []

    // 添加模型参数
    if (options?.model || this.config.defaultModel) {
      args.push('--model', options?.model || this.config.defaultModel!)
    }

    const childProcess = spawn(command, args, {
      cwd: workdir,
      shell: true, // 使用系统默认 shell
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}`
      }
    })

    const msgStore = new MsgStoreService(undefined, sessionId)

    const session: ClaudeCodeSession = {
      id: sessionId,
      process: childProcess,
      workdir,
      status: 'running',
      output: [],
      startTime: new Date(),
      msgStore
    }

    // 监听输出
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      session.output.push(output)

      // 推送到 MsgStore
      const stdoutMsg: LogMsg = {
        type: 'stdout',
        content: output,
        timestamp: Date.now()
      }
      msgStore.push(stdoutMsg)

      // 尝试解析为结构化日志
      const lines = output.split('\n')
      for (const line of lines) {
        const entry = this.normalizer.normalize('claude-code', line)
        if (entry) {
          msgStore.push({
            type: 'normalized',
            entry,
            timestamp: Date.now()
          })
        }
      }

      this.emit('output', { sessionId, type: 'stdout', content: output })
    })

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      session.output.push(output)

      // 推送到 MsgStore
      msgStore.push({
        type: 'stderr',
        content: output,
        timestamp: Date.now()
      })

      this.emit('output', { sessionId, type: 'stderr', content: output })
    })

    childProcess.on('close', (code) => {
      session.status = code === 0 ? 'stopped' : 'error'

      // 推送完成消息
      msgStore.push({
        type: 'finished',
        exitCode: code ?? undefined,
        timestamp: Date.now()
      })

      this.emit('close', { sessionId, code })
    })

    childProcess.on('error', (error) => {
      session.status = 'error'
      this.emit('error', { sessionId, error: error.message })
    })

    this.sessions.set(sessionId, session)
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.process.kill()
    this.sessions.delete(sessionId)
  }

  sendInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.process.stdin?.write(input + '\n')
  }

  getSessionOutput(sessionId: string): string[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    return session.output
  }

  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): Array<{ id: string; status: string; workdir: string; startTime: Date }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status,
      workdir: s.workdir,
      startTime: s.startTime
    }))
  }

  /**
   * 获取会话的 MsgStore
   */
  getSessionMsgStore(sessionId: string): MsgStoreService | undefined {
    return this.sessions.get(sessionId)?.msgStore
  }

  /**
   * 订阅会话的日志流
   */
  subscribeToSession(sessionId: string, callback: (msg: LogMsg) => void): (() => void) | undefined {
    const msgStore = this.getSessionMsgStore(sessionId)
    if (!msgStore) return undefined
    return msgStore.subscribe(callback)
  }

  /**
   * 获取会话的历史日志
   */
  getSessionLogHistory(sessionId: string): LogMsg[] {
    // 优先从内存中获取
    const msgStore = this.getSessionMsgStore(sessionId)
    if (msgStore) {
      return msgStore.getHistory()
    }
    // 如果 session 不存在，从文件加载历史日志
    return MsgStoreService.loadFromFile(sessionId)
  }
}
