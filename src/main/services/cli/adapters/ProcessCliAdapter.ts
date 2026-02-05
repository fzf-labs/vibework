import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import {
  ProcessCliSession,
  ProcessCommandSpec,
  CompletionDetector,
  StderrNormalizer
} from '../ProcessCliSession'
import { LogNormalizerService } from '../../LogNormalizerService'

export interface ProcessCliAdapterConfig {
  id: string
  buildCommand: (options: CliStartOptions) => ProcessCommandSpec
  detectCompletion: CompletionDetector
  detectStderrCompletion?: CompletionDetector
  normalizeStderr?: StderrNormalizer
}

export class ProcessCliAdapter implements CliAdapter {
  id: string
  private buildCommand: (options: CliStartOptions) => ProcessCommandSpec
  private detectCompletion: CompletionDetector
  private detectStderrCompletion?: CompletionDetector
  private normalizeStderr?: StderrNormalizer
  private normalizer?: LogNormalizerService

  constructor(config: ProcessCliAdapterConfig, normalizer?: LogNormalizerService) {
    this.id = config.id
    this.buildCommand = config.buildCommand
    this.detectCompletion = config.detectCompletion
    this.detectStderrCompletion = config.detectStderrCompletion
    this.normalizeStderr = config.normalizeStderr
    this.normalizer = normalizer
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    const commandSpec = this.buildCommand(options)
    return new ProcessCliSession(
      options.sessionId,
      options.toolId,
      commandSpec,
      this.detectCompletion,
      this.normalizer,
      this.detectStderrCompletion,
      this.normalizeStderr,
      options.taskId,
      options.projectId,
      options.msgStore
    )
  }
}
