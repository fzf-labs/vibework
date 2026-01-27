import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

interface Session {
  id: string
  process: ChildProcess
  output: string[]
  status: 'running' | 'stopped' | 'error'
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

    const session: Session = {
      id: sessionId,
      process: childProcess,
      output: [],
      status: 'running'
    }

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
