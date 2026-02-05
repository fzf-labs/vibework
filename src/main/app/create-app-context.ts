import { getAppPaths } from './AppPaths'
import { ProjectService } from '../services/ProjectService'
import { GitService } from '../services/GitService'
import { CLIProcessService } from '../services/CLIProcessService'
import { CLIToolDetectorService } from '../services/CLIToolDetectorService'
import { CLIToolConfigService } from '../services/CLIToolConfigService'
import { EditorService } from '../services/EditorService'
import { PipelineService } from '../services/PipelineService'
import { PreviewConfigService } from '../services/PreviewConfigService'
import { PreviewService } from '../services/PreviewService'
import { NotificationService } from '../services/NotificationService'
import { DatabaseService } from '../services/DatabaseService'
import { SettingsService } from '../services/SettingsService'
import { TaskService } from '../services/TaskService'
import { CliSessionService } from '../services/cli/CliSessionService'
import { TerminalService } from '../services/terminal/TerminalService'
import { AppContext, AppServices } from './AppContext'

export const createAppContext = (): AppContext => {
  const appPaths = getAppPaths()

  const databaseService = new DatabaseService()
  const projectService = new ProjectService(databaseService)
  const gitService = new GitService()
  const cliProcessService = new CLIProcessService()
  const cliToolDetectorService = new CLIToolDetectorService()
  const cliToolConfigService = new CLIToolConfigService()
  const cliSessionService = new CliSessionService(cliToolConfigService, databaseService)
  const terminalService = new TerminalService()
  const editorService = new EditorService()
  const pipelineService = new PipelineService()
  const previewConfigService = new PreviewConfigService()
  const previewService = new PreviewService()
  const notificationService = new NotificationService()
  const settingsService = new SettingsService()
  const taskService = new TaskService(databaseService, gitService)

  const services: AppServices = {
    projectService,
    gitService,
    cliProcessService,
    cliToolDetectorService,
    cliToolConfigService,
    editorService,
    pipelineService,
    previewConfigService,
    previewService,
    notificationService,
    databaseService,
    settingsService,
    taskService,
    cliSessionService,
    terminalService
  }

  const serviceOrder = [
    databaseService,
    projectService,
    gitService,
    cliProcessService,
    cliToolDetectorService,
    cliToolConfigService,
    cliSessionService,
    editorService,
    pipelineService,
    previewConfigService,
    previewService,
    notificationService,
    settingsService,
    taskService,
    terminalService
  ]

  return new AppContext(appPaths, services, serviceOrder)
}
