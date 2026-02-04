import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { MsgStoreService } from './MsgStoreService'
import { LogNormalizerService } from './LogNormalizerService'
import { ClaudeCodeNormalizer } from './normalizers/ClaudeCodeNormalizer'
import { LogMsg, LogMsgInput } from '../types/log'
import { DataBatcher } from '../utils/data-batcher'
import { safeSpawn } from '../utils/safe-exec'
import { config } from '../config'

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
  stdoutBatcher: DataBatcher
  stderrBatcher: DataBatcher
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

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.process.stdout?.removeAllListeners()
    session.process.stderr?.removeAllListeners()
    session.process.removeAllListeners()
    this.sessions.delete(sessionId)
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
      defaultModel: config.models.claudeDefaultModel
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

  startSession(
    sessionId: string,
    workdir: string,
    options?: { model?: string; prompt?: string; projectId?: string | null; msgStore?: MsgStoreService }
  ): void {
    console.log('[ClaudeCodeService] Starting session:', sessionId, 'workdir:', workdir)

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    const command = this.config.executablePath || 'claude'
    const args: string[] = []

    // 使用 -p 模式 + stream-json 双向通信（参考 vibe-kanban）
    args.push('-p')
    args.push('--verbose')
    args.push('--output-format=stream-json')
    args.push('--input-format=stream-json')
    args.push('--dangerously-skip-permissions')
    args.push('--session-id', sessionId)

    // 添加模型参数
    if (options?.model || this.config.defaultModel) {
      args.push('--model', options?.model || this.config.defaultModel!)
    }

    // 注意：使用 --input-format=stream-json 时，prompt 通过 stdin 发送，不作为命令行参数
    const prompt = options?.prompt
    if (prompt) {
      console.log('[ClaudeCodeService] Prompt:', prompt)
    }

    console.log('[ClaudeCodeService] Spawning command:', command, 'args:', args)

    // 获取 claude 的完整路径
    const homeDir = process.env.HOME || os.homedir()
    const claudePath = `${homeDir}/.local/bin/claude`
    const actualCommand = command === 'claude' ? claudePath : command

    console.log('[ClaudeCodeService] HOME:', homeDir)
    console.log('[ClaudeCodeService] Using actual command path:', actualCommand)
    console.log('[ClaudeCodeService] Full command:', [actualCommand, ...args].join(' '))
    console.log('[ClaudeCodeService] CWD:', workdir)

    // 检查文件是否存在
    const fileExists = fs.existsSync(actualCommand)
    console.log('[ClaudeCodeService] Command file exists:', fileExists)

    // 检查并创建工作目录
    const cwdExists = fs.existsSync(workdir)
    console.log('[ClaudeCodeService] CWD exists:', cwdExists)
    if (!cwdExists) {
      console.log('[ClaudeCodeService] Creating CWD:', workdir)
      fs.mkdirSync(workdir, { recursive: true })
    }

    const childProcess = safeSpawn(actualCommand, args, {
      cwd: workdir,
      stdio: ['pipe', 'pipe', 'pipe'],
      allowlist: config.commandAllowlist,
      label: 'ClaudeCodeService',
      env: {
        ...process.env,
        PATH: `${homeDir}/.local/bin:/opt/homebrew/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}`
      }
    })

    console.log('[ClaudeCodeService] Process spawned, PID:', childProcess.pid)
    console.log('[ClaudeCodeService] stdout available:', !!childProcess.stdout)
    console.log('[ClaudeCodeService] stderr available:', !!childProcess.stderr)

    const msgStore = options?.msgStore ?? new MsgStoreService(undefined, sessionId, options?.projectId)

    // 创建 stdout 批处理器
    const stdoutBatcher = new DataBatcher((data) => {
      session.output.push(data)

      // 推送到 MsgStore
      const stdoutMsg: LogMsgInput = {
        type: 'stdout',
        content: data,
        timestamp: Date.now()
      }
      msgStore.push(stdoutMsg)

      // 尝试解析为结构化日志
      const lines = data.split('\n')
      for (const line of lines) {
        const result = this.normalizer.normalize('claude-code', line)
        if (result) {
          // 处理单个条目或数组
          const entries = Array.isArray(result) ? result : [result]
          for (const entry of entries) {
            msgStore.push({
              type: 'normalized',
              entry,
              timestamp: Date.now()
            })
          }
        }
      }

      this.emit('output', { sessionId, type: 'stdout', content: data })
    })

    // 创建 stderr 批处理器
    const stderrBatcher = new DataBatcher((data) => {
      session.output.push(data)

      // 推送到 MsgStore
      msgStore.push({
        type: 'stderr',
        content: data,
        timestamp: Date.now()
      })

      this.emit('output', { sessionId, type: 'stderr', content: data })
    })

    const session: ClaudeCodeSession = {
      id: sessionId,
      process: childProcess,
      workdir,
      status: 'running',
      output: [],
      startTime: new Date(),
      msgStore,
      stdoutBatcher,
      stderrBatcher
    }

    // 监听输出 - 使用批处理器
    childProcess.stdout?.on('data', (data) => {
      console.log('[ClaudeCodeService] stdout chunk:', data.length, 'bytes')
      session.stdoutBatcher.write(data)
    })

    childProcess.stderr?.on('data', (data) => {
      console.log('[ClaudeCodeService] stderr chunk:', data.length, 'bytes')
      session.stderrBatcher.write(data)
    })

    // 添加 spawn 事件监听
    childProcess.on('spawn', () => {
      console.log('[ClaudeCodeService] Process spawn event fired')
    })

    childProcess.on('close', (code) => {
      console.log('[ClaudeCodeService] Process closed with code:', code)

      // 刷新批处理器中的剩余数据
      session.stdoutBatcher.destroy()
      session.stderrBatcher.destroy()

      session.status = code === 0 ? 'stopped' : 'error'

      // 推送完成消息
      msgStore.push({
        type: 'finished',
        exit_code: code ?? undefined,
        timestamp: Date.now()
      })

      this.emit('close', { sessionId, code })
      this.cleanupSession(sessionId)
    })

    childProcess.on('error', (error) => {
      console.error('[ClaudeCodeService] Process error:', error.message)
      session.status = 'error'
      this.emit('error', { sessionId, error: error.message })
    })

    this.sessions.set(sessionId, session)
    console.log('[ClaudeCodeService] Session created and stored:', sessionId)

    // 通过 stdin 发送 Initialize 和 User 消息（参考 vibe-kanban）
    this.initializeSession(childProcess, prompt)
  }

  /**
   * 初始化 Claude CLI 会话
   * 发送 Initialize 控制请求和用户消息
   */
  private initializeSession(childProcess: ChildProcess, prompt?: string): void {
    const stdin = childProcess.stdin
    if (!stdin) {
      console.error('[ClaudeCodeService] No stdin available')
      return
    }

    // 生成唯一的 request_id
    const requestId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 1. 发送 Initialize 控制请求
    const initMessage = JSON.stringify({
      type: 'control_request',
      request_id: requestId,
      request: {
        subtype: 'initialize'
      }
    })
    console.log('[ClaudeCodeService] Sending initialize message')
    stdin.write(initMessage + '\n')

    // 2. 如果有 prompt，发送用户消息
    if (prompt) {
      // 稍微延迟发送用户消息，确保初始化完成
      setTimeout(() => {
        const userMessage = JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: prompt
          }
        })
        console.log('[ClaudeCodeService] Sending user message')
        stdin.write(userMessage + '\n')
      }, 100)
    }
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.process.kill('SIGTERM')
  }

  sendInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    console.log('[ClaudeCodeService] Prompt:', input)
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
