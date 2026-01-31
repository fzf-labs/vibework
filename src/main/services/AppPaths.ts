import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { app } from 'electron'

/**
 * 应用数据路径管理服务
 * 统一管理所有数据存储路径，使用 ~/.vibework/ 作为根目录
 */
export class AppPaths {
  private static instance: AppPaths
  private rootDir: string

  private constructor() {
    this.rootDir = join(homedir(), '.vibework')
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
   * 获取 session 日志目录路径 ~/.vibework/logs/sessions/
   */
  getSessionLogsDir(): string {
    return join(this.getLogsDir(), 'sessions')
  }

  /**
   * 获取指定 session 的日志文件路径
   */
  getSessionLogFile(sessionId: string): string {
    return join(this.getSessionLogsDir(), `${sessionId}.jsonl`)
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
      this.getSessionLogsDir(),
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

  /**
   * 从旧位置迁移数据到新位置
   * 旧位置: ~/Library/Application Support/vibework/
   * 新位置: ~/.vibework/
   */
  migrateFromOldLocation(): { migrated: boolean; details: string[] } {
    const details: string[] = []
    let migrated = false

    try {
      const oldUserDataPath = app.getPath('userData')
      const oldDataDir = join(oldUserDataPath, 'data')

      // 检查旧位置是否存在数据
      if (!existsSync(oldDataDir)) {
        details.push('No old data directory found, skipping migration')
        return { migrated: false, details }
      }

      // 迁移 projects.json
      const oldProjectsFile = join(oldDataDir, 'projects.json')
      const newProjectsFile = this.getProjectsFile()
      if (existsSync(oldProjectsFile) && !existsSync(newProjectsFile)) {
        copyFileSync(oldProjectsFile, newProjectsFile)
        details.push(`Migrated: projects.json`)
        migrated = true
      }

      // 迁移数据库文件
      const oldDbFile = join(oldUserDataPath, 'vibework.db')
      const newDbFile = this.getDatabaseFile()
      if (existsSync(oldDbFile) && !existsSync(newDbFile)) {
        copyFileSync(oldDbFile, newDbFile)
        details.push(`Migrated: vibework.db`)
        migrated = true

        // 同时迁移 WAL 文件（如果存在）
        const oldWalFile = oldDbFile + '-wal'
        const oldShmFile = oldDbFile + '-shm'
        if (existsSync(oldWalFile)) {
          copyFileSync(oldWalFile, newDbFile + '-wal')
        }
        if (existsSync(oldShmFile)) {
          copyFileSync(oldShmFile, newDbFile + '-shm')
        }
      }

      if (migrated) {
        details.push('Migration completed successfully')
        details.push(`Old location: ${oldUserDataPath}`)
        details.push(`New location: ${this.rootDir}`)
      } else {
        details.push('No files needed migration (new location already has data)')
      }
    } catch (error) {
      details.push(`Migration error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return { migrated, details }
  }
}

// 导出单例获取函数
export function getAppPaths(): AppPaths {
  return AppPaths.getInstance()
}
