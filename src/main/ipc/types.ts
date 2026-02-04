import type { AppPaths } from '../app/AppPaths'
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
import type { TerminalService } from '../services/terminal/TerminalService'
import type { IpcMainInvokeEvent } from 'electron'
import type { Validator } from '../utils/ipc-response'
import type { IpcArgs, IpcContractChannel, IpcResult } from './channels'

export interface IpcServices {
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
  terminalService: TerminalService
}

export interface IpcDependencies {
  services: IpcServices
  appPaths: AppPaths
  resolveProjectIdForSession: (sessionId: string) => string | null
}

export interface IpcHelpers {
  handle: <C extends IpcContractChannel>(
    channel: C,
    validators: ReadonlyArray<Validator<unknown>>,
    handler: (event: IpcMainInvokeEvent, ...args: IpcArgs<C>) => Promise<IpcResult<C>> | IpcResult<C>
  ) => void
  v: typeof import('../utils/ipc-response').v
  fileDataValidator: Validator<Uint8Array | string>
  getFsAllowlistRoots: () => string[]
  confirmDestructiveOperation: (
    event: IpcMainInvokeEvent,
    action: string,
    targetPath: string
  ) => Promise<void>
  taskStatusValues: readonly ['todo', 'in_progress', 'in_review', 'done']
  workflowStatusValues: readonly ['todo', 'in_progress', 'done']
  workNodeStatusValues: readonly ['todo', 'in_progress', 'in_review', 'done']
  agentExecutionStatusValues: readonly ['idle', 'running', 'completed']
}

export interface IpcModuleContext extends IpcDependencies, IpcHelpers {}
