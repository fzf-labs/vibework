import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { config } from '../config'

/**
 * 应用数据路径管理服务
 * 统一管理所有数据存储路径，使用 ~/.vibework/ 作为根目录
 */
export class AppPaths {
  private static instance: AppPaths
  private rootDir: string

  private constructor() {
    this.rootDir = config.paths.appRoot
    this.ensureDirectories()
  }

  static getInstance(): AppPaths {
    if (!AppPaths.instance) {
      AppPaths.instance = new AppPaths()
    }
    return AppPaths.instance
  }

  /**
   * 获取根目录路径 ~/.vibework/
   */
  getRootDir(): string {
    return this.rootDir
  }

  /**
   * 获取配置目录路径 ~/.vibework/config/
   */
  getConfigDir(): string {
    return join(this.rootDir, 'config')
  }

  /**
   * 获取数据目录路径 ~/.vibework/data/
   */
  getDataDir(): string {
    return join(this.rootDir, 'data')
  }

  /**
   * 获取日志目录路径 ~/.vibework/logs/
   */
  getLogsDir(): string {
    return join(this.rootDir, 'logs')
  }

  /**
   * 获取 session 数据目录路径 ~/.vibework/data/sessions/
   */
  getSessionsDir(): string {
    return join(this.getDataDir(), 'sessions')
  }

  /**
   * 获取项目级 session 目录路径 ~/.vibework/data/sessions/<projectId>/
   */
  getProjectSessionsDir(projectId?: string | null): string {
    const normalizedProjectId = projectId?.trim() || 'project'
    return join(this.getSessionsDir(), normalizedProjectId)
  }

  /**
   * 获取指定 task 的数据目录路径
   */
  getTaskDataDir(taskId: string, projectId?: string | null): string {
    return join(this.getProjectSessionsDir(projectId), taskId)
  }

  /**
   * 获取指定 task 的日志文件路径（兼容旧结构） ~/.vibework/data/sessions/<projectId>/<taskId>.jsonl
   */
  getTaskMessagesFile(taskId: string, projectId?: string | null): string {
    return join(this.getProjectSessionsDir(projectId), `${taskId}.jsonl`)
  }

  /**
   * 获取指定 task node 的日志文件路径 ~/.vibework/data/sessions/<projectId>/<taskId>/<taskNodeId>.jsonl
   */
  getTaskNodeMessagesFile(taskId: string, taskNodeId: string, projectId?: string | null): string {
    return join(this.getTaskDataDir(taskId, projectId), `${taskNodeId}.jsonl`)
  }

  /**
   * 获取缓存目录路径 ~/.vibework/cache/
   */
  getCacheDir(): string {
    return join(this.rootDir, 'cache')
  }

  /**
   * 获取 worktree 目录路径 ~/.vibework/worktrees/
   */
  getWorktreesDir(): string {
    return join(this.rootDir, 'worktrees')
  }

  /**
   * 获取项目配置文件路径
   */
  getProjectsFile(): string {
    return join(this.getDataDir(), 'projects.json')
  }

  /**
   * 获取数据库文件路径
   */
  getDatabaseFile(): string {
    return join(this.getDataDir(), 'vibework.db')
  }


  /**
   * 获取 CLI 输出日志目录
   */
  getCliOutputDir(): string {
    return join(this.getLogsDir(), 'cli-output')
  }

  /**
   * 获取 CLI 输出日志文件路径
   */
  getCliOutputFile(sessionId: string): string {
    return join(this.getCliOutputDir(), `${sessionId}.log`)
  }

  /**
   * 获取流水线输出日志目录
   */
  getPipelineOutputDir(): string {
    return join(this.getLogsDir(), 'pipeline-output')
  }

  /**
   * 获取流水线阶段输出日志文件路径
   */
  getPipelineStageOutputFile(executionId: string, stageId: string): string {
    return join(this.getPipelineOutputDir(), `${executionId}-${stageId}.log`)
  }

  /**
   * 获取应用设置文件路径
   */
  getSettingsFile(): string {
    return join(this.getConfigDir(), 'settings.json')
  }

  /**
   * 确保所有必要的目录存在
   */
  private ensureDirectories(): void {
    const dirs = [
      this.rootDir,
      this.getConfigDir(),
      this.getDataDir(),
      this.getLogsDir(),
      this.getSessionsDir(),
      this.getCliOutputDir(),
      this.getPipelineOutputDir(),
      this.getCacheDir(),
      this.getWorktreesDir(),
    ]

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        console.log(`[AppPaths] Created directory: ${dir}`)
      }
    }
  }

}

// 导出单例获取函数
export function getAppPaths(): AppPaths {
  return AppPaths.getInstance()
}
