import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

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
}

export class ClaudeCodeManager extends EventEmitter {
  private sessions: Map<string, ClaudeCodeSession> = new Map()
  private config: ClaudeCodeConfig

  constructor() {
    super()
    this.config = this.loadConfig()
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
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const session: ClaudeCodeSession = {
      id: sessionId,
      process: childProcess,
      workdir,
      status: 'running',
      output: [],
      startTime: new Date()
    }

    // 监听输出
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      session.output.push(output)
      this.emit('output', { sessionId, type: 'stdout', content: output })
    })

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      session.output.push(output)
      this.emit('output', { sessionId, type: 'stderr', content: output })
    })

    childProcess.on('close', (code) => {
      session.status = code === 0 ? 'stopped' : 'error'
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
}
