import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { DatabaseConnection } from '../../src/main/services/database/DatabaseConnection'

describe('task nodes schema', () => {
  it('migrates to schema v3 and creates unique in-progress index', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vibework-task-nodes-'))
    const dbPath = join(tempDir, 'test.db')

    const connection = new DatabaseConnection(dbPath)
    let db
    try {
      db = connection.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('NODE_MODULE_VERSION')) {
        // CI/runtime node ABI mismatch for native better-sqlite3; skip schema assertion in this environment.
        rmSync(tempDir, { recursive: true, force: true })
        return
      }
      throw error
    }

    connection.initTables()

    const userVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    expect(userVersion).toBe(3)

    const taskNodesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_nodes'")
      .get() as { name?: string } | undefined
    expect(taskNodesTable?.name).toBe('task_nodes')

    const uniqIndex = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='uniq_task_nodes_single_in_progress'"
      )
      .get() as { name?: string } | undefined
    expect(uniqIndex?.name).toBe('uniq_task_nodes_single_in_progress')

    const sessionIndex = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_task_nodes_session_id'")
      .get() as { name?: string } | undefined
    expect(sessionIndex?.name).toBe('idx_task_nodes_session_id')

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO tasks (id, title, prompt, status, task_mode, created_at, updated_at)
       VALUES (?, ?, ?, 'todo', 'workflow', ?, ?)`
    ).run('task-1', 'Task 1', 'prompt', now, now)

    db.prepare(
      `INSERT INTO task_nodes (
         id, task_id, node_order, name, prompt, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?)`
    ).run('node-1', 'task-1', 1, 'Node 1', 'prompt', now, now)

    db.prepare(
      `INSERT INTO task_nodes (
         id, task_id, node_order, name, prompt, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?)`
    ).run('node-2', 'task-1', 2, 'Node 2', 'prompt', now, now)

    db.prepare(`UPDATE task_nodes SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?`).run(
      now,
      now,
      'node-1'
    )

    expect(() => {
      db.prepare(
        `UPDATE task_nodes SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?`
      ).run(now, now, 'node-2')
    }).toThrow()

    connection.close()
    rmSync(tempDir, { recursive: true, force: true })
  })
})
