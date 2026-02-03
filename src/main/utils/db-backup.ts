import { copyFileSync, existsSync, mkdirSync, rmSync } from 'fs'

export interface DatabaseBackup {
  dbPath: string
  walPath: string
  shmPath: string
  backup: {
    db: string
    wal: string
    shm: string
  }
}

export const createDatabaseBackup = (dbPath: string, backupsDir: string): DatabaseBackup => {
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupBase = `${dbPath}.${timestamp}.bak`
  const walPath = `${dbPath}-wal`
  const shmPath = `${dbPath}-shm`
  const backup = {
    db: backupBase,
    wal: `${backupBase}-wal`,
    shm: `${backupBase}-shm`
  }

  copyFileSync(dbPath, backup.db)
  if (existsSync(walPath)) {
    copyFileSync(walPath, backup.wal)
  }
  if (existsSync(shmPath)) {
    copyFileSync(shmPath, backup.shm)
  }

  return { dbPath, walPath, shmPath, backup }
}

export const restoreDatabaseBackup = (backup: DatabaseBackup): void => {
  if (existsSync(backup.backup.db)) {
    copyFileSync(backup.backup.db, backup.dbPath)
  }
  if (existsSync(backup.backup.wal)) {
    copyFileSync(backup.backup.wal, backup.walPath)
  }
  if (existsSync(backup.backup.shm)) {
    copyFileSync(backup.backup.shm, backup.shmPath)
  }
}

export const resetDatabaseFiles = (dbPath: string): void => {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-wal`, { force: true })
  rmSync(`${dbPath}-shm`, { force: true })
}
