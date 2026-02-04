import type { IPty } from 'node-pty'

export interface TerminalSession {
  pty: IPty
  paneId: string
  workspaceId?: string | null
  cwd: string
  cols: number
  rows: number
  isAlive: boolean
  startTime: number
  lastActive: number
  shell: string
}

export interface CreateTerminalParams {
  paneId: string
  cwd: string
  cols?: number
  rows?: number
  workspaceId?: string | null
}

export interface TerminalDataEvent {
  paneId: string
  data: string
}

export interface TerminalExitEvent {
  paneId: string
  exitCode: number
  signal?: number
}

export interface TerminalErrorEvent {
  paneId: string
  error: string
}
