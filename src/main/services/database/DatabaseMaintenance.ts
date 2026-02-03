import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { dialog } from 'electron'
import { createDatabaseBackup, restoreDatabaseBackup, resetDatabaseFiles, DatabaseBackup } from '../../utils/db-backup'
import type { AppPaths } from '../../app/AppPaths'

export class DatabaseMaintenance {
  private backupPaths: DatabaseBackup | null = null
  private appPaths: AppPaths

  constructor(appPaths: AppPaths) {
    this.appPaths = appPaths
  }

  handleLegacyDatabase(dbPath: string): void {
    if (!existsSync(dbPath)) return

    const legacyTables = [
      'sessions',
      'messages',
      'global_workflow_templates',
      'project_workflow_templates',
      'global_work_node_templates',
      'project_work_node_templates'
    ]

    let shouldReset = false
    let reason = ''
    try {
      const probe = new Database(dbPath, { readonly: true })
      const found = probe
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${legacyTables
            .map(() => '?')
            .join(',')})`
        )
        .all(...legacyTables)
      shouldReset = found.length > 0
      if (shouldReset) {
        reason = `Detected legacy tables: ${found.map((row: any) => row.name).join(', ')}`
      }
      probe.close()
    } catch (error) {
      console.error('[DatabaseService] Failed to probe database schema:', error)
      shouldReset = true
      reason = 'Database probe failed; possible legacy or corrupted schema.'
    }

    if (!shouldReset) return

    const approved = this.confirmLegacyReset(dbPath, reason)
    if (!approved) {
      console.warn('[DatabaseService] Legacy database reset cancelled by user.')
      return
    }

    const backup = createDatabaseBackup(dbPath, this.appPaths.getDatabaseBackupsDir())
    console.log('[DatabaseService] Backup created at:', backup.backup.db)
    this.backupPaths = backup
    try {
      resetDatabaseFiles(dbPath)
    } catch (error) {
      console.error('[DatabaseService] Failed to reset legacy database:', error)
      restoreDatabaseBackup(backup)
      dialog.showErrorBox(
        'Database Reset Failed',
        'Failed to reset the legacy database. Your backup has been restored.'
      )
      throw error
    }
  }

  hasBackup(): boolean {
    return Boolean(this.backupPaths)
  }

  restoreBackup(): void {
    if (!this.backupPaths) return
    try {
      restoreDatabaseBackup(this.backupPaths)
      console.log('[DatabaseService] Backup restored from:', this.backupPaths.backup.db)
    } catch (error) {
      console.error('[DatabaseService] Failed to restore database backup:', error)
    }
  }

  private confirmLegacyReset(dbPath: string, reason: string): boolean {
    try {
      const result = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Cancel', 'Reset Database'],
        defaultId: 1,
        cancelId: 0,
        title: 'Legacy Database Detected',
        message: `A legacy or incompatible database was detected at:\n${dbPath}\n\n${reason}\n\nResetting will remove the existing database after creating a backup.`,
        noLink: true
      })
      return result === 1
    } catch (error) {
      console.error('[DatabaseService] Failed to show confirmation dialog:', error)
      return false
    }
  }
}
