import { EventEmitter } from 'events'
import type { AppPaths } from '../services/AppPaths'
import type { ProjectService } from '../services/ProjectService'
import type { GitService } from '../services/GitService'
import type { CLIProcessService } from '../services/CLIProcessService'
import type { ClaudeCodeService } from '../services/ClaudeCodeService'
import type { CLIToolDetectorService } from '../services/CLIToolDetectorService'
import type { CLIToolConfigService } from '../services/CLIToolConfigService'
import type { EditorService } from '../services/EditorService'
import type { PipelineService } from '../services/PipelineService'
import type { PreviewConfigService } from '../services/PreviewConfigService'
import type { PreviewService } from '../services/PreviewService'
import type { NotificationService } from '../services/NotificationService'
import type { DatabaseService } from '../services/DatabaseService'
import type { SettingsService } from '../services/SettingsService'
import type { TaskService } from '../services/TaskService'
import type { CliSessionService } from '../services/cli/CliSessionService'

export interface LifecycleService {
  init?: () => void | Promise<void>
  dispose?: () => void | Promise<void>
}

export interface AppServices {
  projectService: ProjectService
  gitService: GitService
  cliProcessService: CLIProcessService
  claudeCodeService: ClaudeCodeService
  cliToolDetectorService: CLIToolDetectorService
  cliToolConfigService: CLIToolConfigService
  editorService: EditorService
  pipelineService: PipelineService
  previewConfigService: PreviewConfigService
  previewService: PreviewService
  notificationService: NotificationService
  databaseService: DatabaseService
  settingsService: SettingsService
  taskService: TaskService
  cliSessionService: CliSessionService
}

type Disposable = () => void | Promise<void>

export class AppContext {
  readonly services: AppServices
  readonly appPaths: AppPaths
  private serviceOrder: unknown[]
  private disposables: Disposable[] = []

  constructor(appPaths: AppPaths, services: AppServices, serviceOrder: unknown[]) {
    this.appPaths = appPaths
    this.services = services
    this.serviceOrder = serviceOrder
  }

  resolveProjectIdForSession(sessionId: string): string | null {
    try {
      return this.services.taskService.getTaskBySessionId(sessionId)?.projectId ?? null
    } catch {
      return null
    }
  }

  trackDisposable(disposable: Disposable): void {
    this.disposables.push(disposable)
  }

  trackEvent<T extends EventEmitter>(
    emitter: T,
    event: string,
    listener: (...args: any[]) => void
  ): void {
    emitter.on(event, listener)
    this.trackDisposable(() => {
      emitter.off(event, listener)
    })
  }

  async init(): Promise<void> {
    for (const service of this.serviceOrder) {
      const lifecycle = service as LifecycleService
      if (typeof lifecycle.init === 'function') {
        await lifecycle.init()
      }
    }
  }

  async dispose(): Promise<void> {
    for (const disposable of [...this.disposables].reverse()) {
      try {
        await disposable()
      } catch (error) {
        console.error('[AppContext] Failed to dispose resource:', error)
      }
    }

    for (const service of [...this.serviceOrder].reverse()) {
      const lifecycle = service as LifecycleService
      if (typeof lifecycle.dispose === 'function') {
        try {
          await lifecycle.dispose()
        } catch (error) {
          console.error('[AppContext] Failed to dispose service:', error)
        }
      }
    }
  }
}
