import fs from 'fs'
import os from 'os'
import path from 'path'
import * as pty from 'node-pty'
import { buildTerminalEnv, FALLBACK_SHELL, getDefaultShell } from './env'
import type { TerminalSession } from './types'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

function getShellArgs(shell: string): string[] {
  if (shell.includes('zsh')) return ['-l']
  if (shell.includes('bash')) return []
  return []
}

function validateAndResolveCwd(cwd: string): string {
  if (!cwd) return os.homedir()
  if (!fs.existsSync(cwd)) {
    return os.homedir()
  }
  try {
    const stat = fs.statSync(cwd)
    if (!stat.isDirectory()) {
      return os.homedir()
    }
  } catch {
    return os.homedir()
  }
  try {
    return path.resolve(cwd)
  } catch {
    return os.homedir()
  }
}

function resolveShellPath(shell: string): string {
  if (os.platform() !== 'win32') return shell

  if (shell.includes('\\') || shell.includes('/')) return shell

  const commonPaths = [
    process.env.COMSPEC || '',
    process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` : '',
    process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\cmd.exe` : ''
  ].filter(Boolean)

  for (const shellPath of commonPaths) {
    if (fs.existsSync(shellPath)) {
      return shellPath
    }
  }

  return shell
}

function spawnPty(params: {
  shell: string
  cols: number
  rows: number
  cwd: string
  env: Record<string, string>
}): pty.IPty {
  const { shell, cols, rows, cwd, env } = params
  const resolvedShell = resolveShellPath(shell)
  const shellArgs = getShellArgs(resolvedShell)

  try {
    return pty.spawn(resolvedShell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    })
  } catch (error) {
    console.error('[Terminal] Failed to spawn PTY with', resolvedShell, error)
    return pty.spawn(FALLBACK_SHELL, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    })
  }
}

export function createSession(params: {
  paneId: string
  workspaceId?: string | null
  cwd: string
  cols?: number
  rows?: number
  useFallbackShell?: boolean
}): TerminalSession {
  const { paneId, workspaceId, cwd, cols, rows, useFallbackShell } = params
  const shell = useFallbackShell ? FALLBACK_SHELL : getDefaultShell()
  const workingDir = validateAndResolveCwd(cwd || os.homedir())
  const terminalCols = cols || DEFAULT_COLS
  const terminalRows = rows || DEFAULT_ROWS
  const env = buildTerminalEnv({ paneId, workspaceId, shell })

  const ptyProcess = spawnPty({
    shell,
    cols: terminalCols,
    rows: terminalRows,
    cwd: workingDir,
    env
  })

  return {
    pty: ptyProcess,
    paneId,
    workspaceId,
    cwd: workingDir,
    cols: terminalCols,
    rows: terminalRows,
    isAlive: true,
    startTime: Date.now(),
    lastActive: Date.now(),
    shell
  }
}
