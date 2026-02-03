import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { DataBatcher } from './DataBatcher'
import { safeSpawn } from '../utils/safe-exec'
import { config } from '../config'
import { OutputBuffer, OutputSnapshot } from '../utils/output-buffer'
import { OutputSpooler } from '../utils/output-spooler'
import { getAppPaths } from './AppPaths'

const cliProcessAllowlist = config.commandAllowlist

interface Session {
  id: string
  process: ChildProcess
  output: OutputBuffer
  spooler?: OutputSpooler
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

    const fullCommand = [command, ...args].join(' ')
    console.log('[CLIProcessService] startSession:', {
      sessionId,
      command,
      args,
      cwd
    })
    console.log('[CLIProcessService] fullCommand:', fullCommand)

    const childProcess = safeSpawn(command, args, {
      cwd,
      env: process.env,
      allowlist: cliProcessAllowlist,
      label: 'CLIProcessService'
    })

    const outputBuffer = new OutputBuffer({
      maxBytes: config.output.buffer.maxBytes,
      maxEntries: config.output.buffer.maxEntries
    })

    const appPaths = getAppPaths()
    const spooler = new OutputSpooler(appPaths.getCliOutputFile(sessionId), config.output.spool)

    // 创建批处理器
    const stdoutBatcher = new DataBatcher((data) => {
      outputBuffer.push(data)
      spooler.append(`[stdout] ${data}`)
      this.emit('output', { sessionId, type: 'stdout', content: data })
    })

    const stderrBatcher = new DataBatcher((data) => {
      outputBuffer.push(data)
      spooler.append(`[stderr] ${data}`)
      this.emit('output', { sessionId, type: 'stderr', content: data })
    })

    const session: Session = {
      id: sessionId,
      process: childProcess,
      output: outputBuffer,
      spooler,
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
      void session.spooler?.dispose()

      session.status = code === 0 ? 'stopped' : 'error'
      this.emit('close', { sessionId, code })
      this.sessions.delete(sessionId)
    })

    this.sessions.set(sessionId, session)
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.process.kill('SIGTERM')
  }

  getSessionOutput(sessionId: string): OutputSnapshot {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    return session.output.snapshot()
  }

  getAllSessions(): Array<{ id: string; status: string }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status
    }))
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.stdoutBatcher.destroy()
      session.stderrBatcher.destroy()
      session.process.kill('SIGTERM')
      void session.spooler?.dispose()
    }
    this.sessions.clear()
  }
}
