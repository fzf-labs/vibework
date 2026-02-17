import { EventEmitter } from 'events'
import { MsgStoreService } from '../MsgStoreService'

export type CliSessionStatus = 'running' | 'stopped' | 'error'

export interface CliStartOptions {
  sessionId: string
  toolId: string
  workdir: string
  taskId?: string
  taskNodeId?: string
  projectId?: string | null
  prompt?: string
  env?: NodeJS.ProcessEnv
  executablePath?: string
  toolConfig?: Record<string, unknown>
  model?: string
  onResumeIdCaptured?: (resumeId: string) => void | Promise<void>
  msgStore?: MsgStoreService
}

export interface CliCompletionSignal {
  status: 'success' | 'failure'
  reason?: string
}

export interface CliSessionHandle extends EventEmitter {
  sessionId: string
  toolId: string
  status: CliSessionStatus
  msgStore: MsgStoreService
  stop: () => void
  sendInput?: (input: string) => void
}

export interface CliAdapter {
  id: string
  startSession: (options: CliStartOptions) => Promise<CliSessionHandle>
}
