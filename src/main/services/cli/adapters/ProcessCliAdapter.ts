import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import {
  ProcessCliSession,
  ProcessCommandSpec,
  CompletionDetector
} from '../ProcessCliSession'

export interface ProcessCliAdapterConfig {
  id: string
  buildCommand: (options: CliStartOptions) => ProcessCommandSpec
  detectCompletion: CompletionDetector
  detectStderrCompletion?: CompletionDetector
}

export class ProcessCliAdapter implements CliAdapter {
  id: string
  private buildCommand: (options: CliStartOptions) => ProcessCommandSpec
  private detectCompletion: CompletionDetector
  private detectStderrCompletion?: CompletionDetector

  constructor(config: ProcessCliAdapterConfig) {
    this.id = config.id
    this.buildCommand = config.buildCommand
    this.detectCompletion = config.detectCompletion
    this.detectStderrCompletion = config.detectStderrCompletion
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const commandSpec = this.buildCommand(options)
    return new ProcessCliSession(
      options.sessionId,
      options.toolId,
      commandSpec,
      this.detectCompletion,
      this.detectStderrCompletion,
      options.taskId,
      options.projectId,
      options.taskNodeId,
      options.msgStore
    )
  }
}
