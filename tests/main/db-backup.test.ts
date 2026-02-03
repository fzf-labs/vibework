import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  resetDatabaseFiles
} from '../../src/main/utils/db-backup'

describe('database backup utilities', () => {
  it('backs up and restores database files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vibework-db-'))
    const dbPath = join(tempDir, 'test.db')
    const walPath = `${dbPath}-wal`
    const shmPath = `${dbPath}-shm`
    const backupsDir = join(tempDir, 'backups')

    writeFileSync(dbPath, 'db-content')
    writeFileSync(walPath, 'wal-content')
    writeFileSync(shmPath, 'shm-content')

    const backup = createDatabaseBackup(dbPath, backupsDir)

    expect(existsSync(backup.backup.db)).toBe(true)
    expect(readFileSync(backup.backup.db, 'utf-8')).toBe('db-content')

    resetDatabaseFiles(dbPath)
    expect(existsSync(dbPath)).toBe(false)

    restoreDatabaseBackup(backup)

    expect(readFileSync(dbPath, 'utf-8')).toBe('db-content')
    expect(readFileSync(walPath, 'utf-8')).toBe('wal-content')
    expect(readFileSync(shmPath, 'utf-8')).toBe('shm-content')
  })
})
