import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { DataBatcher } from './DataBatcher'

interface Session {
  id: string
  process: ChildProcess
  output: string[]
  status: 'running' | 'stopped' | 'error'
  stdoutBatcher: DataBatcher
  stderrBatcher: DataBatcher
}

export class CLIProcessService extends EventEmitter {
  private sessions: Map<string, Session> = new Map()

  startSession(sessionId: string, command: string, args: string[], cwd?: string): void {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    const childProcess = spawn(command, args, {
      cwd,
      shell: true
    })

    // 创建批处理器
    const stdoutBatcher = new DataBatcher((data) => {
      session.output.push(data)
      this.emit('output', { sessionId, type: 'stdout', content: data })
    })

    const stderrBatcher = new DataBatcher((data) => {
      session.output.push(data)
      this.emit('output', { sessionId, type: 'stderr', content: data })
    })

    const session: Session = {
      id: sessionId,
      process: childProcess,
      output: [],
      status: 'running',
      stdoutBatcher,
      stderrBatcher
    }

    // 使用批处理器处理输出
    childProcess.stdout?.on('data', (data) => {
      session.stdoutBatcher.write(data)
    })

    childProcess.stderr?.on('data', (data) => {
      session.stderrBatcher.write(data)
    })

    childProcess.on('close', (code) => {
      // 刷新批处理器
      session.stdoutBatcher.destroy()
      session.stderrBatcher.destroy()

      session.status = code === 0 ? 'stopped' : 'error'
      this.emit('close', { sessionId, code })
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

  getSessionOutput(sessionId: string): string[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    return session.output
  }

  getAllSessions(): Array<{ id: string; status: string }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status
    }))
  }
}
