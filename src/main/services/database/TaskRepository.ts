import type Database from 'better-sqlite3'
import type { CreateTaskInput, Task, UpdateTaskInput } from '../../types/task'

export class TaskRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, prompt, status, task_mode, project_id, worktree_path, branch_name,
        base_branch, workspace_path, started_at, completed_at, cost, duration, created_at, updated_at
      )
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
    `)

    stmt.run(
      input.id,
      input.title,
      input.prompt,
      input.task_mode ?? 'conversation',
      input.project_id || null,
      input.worktree_path || null,
      input.branch_name || null,
      input.base_branch || null,
      input.workspace_path || null,
      now,
      now
    )

    return this.getTask(input.id)!
  }

  getTask(id: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
    return (stmt.get(id) as Task) || null
  }

  getAllTasks(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    return stmt.all() as Task[]
  }

  getTasksByProjectId(projectId: string): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC')
    return stmt.all(projectId) as Task[]
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.task_mode !== undefined) {
      fields.push('task_mode = ?')
      values.push(updates.task_mode)
    }
    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
    }
    if (updates.prompt !== undefined) {
      fields.push('prompt = ?')
      values.push(updates.prompt)
    }
    if (updates.worktree_path !== undefined) {
      fields.push('worktree_path = ?')
      values.push(updates.worktree_path)
    }
    if (updates.branch_name !== undefined) {
      fields.push('branch_name = ?')
      values.push(updates.branch_name)
    }
    if (updates.base_branch !== undefined) {
      fields.push('base_branch = ?')
      values.push(updates.base_branch)
    }
    if (updates.workspace_path !== undefined) {
      fields.push('workspace_path = ?')
      values.push(updates.workspace_path)
    }
    if (updates.started_at !== undefined) {
      fields.push('started_at = ?')
      values.push(updates.started_at)
    }
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?')
      values.push(updates.completed_at)
    }
    if (updates.cost !== undefined) {
      fields.push('cost = ?')
      values.push(updates.cost)
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?')
      values.push(updates.duration)
    }

    if (fields.length === 0) return this.getTask(id)

    fields.push('updated_at = ?')
    values.push(now, id)

    const stmt = this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...values)

    return this.getTask(id)
  }

  updateTaskStatus(id: string, status: string): void {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
  }

  syncTaskFromNodes(taskId: string): Task | null {
    const now = new Date().toISOString()
    const aggregate = this.db
      .prepare(
        `
          SELECT
            CASE
              WHEN SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) > 0
                THEN 'in_progress'
              WHEN SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) > 0
                THEN 'in_review'
              WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) > 0
                   AND SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) > 0
                THEN 'in_progress'
              WHEN SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) > 0
                THEN 'done'
              WHEN SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) = COUNT(*)
                   AND COUNT(*) > 0
                THEN 'cancelled'
              WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) = COUNT(*)
                   AND COUNT(*) > 0
                THEN 'todo'
              WHEN SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) > 0
                   AND SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) > 0
                   AND SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) = 0
                THEN 'todo'
              ELSE 'todo'
            END AS task_status,
            MIN(started_at) AS started_at,
            MAX(completed_at) AS completed_at,
            SUM(cost) AS cost,
            CASE
              WHEN MIN(started_at) IS NOT NULL AND MAX(completed_at) IS NOT NULL
                THEN CAST((julianday(MAX(completed_at)) - julianday(MIN(started_at))) * 86400 AS REAL)
              ELSE NULL
            END AS duration
          FROM task_nodes
          WHERE task_id = ?
        `
      )
      .get(taskId) as {
      task_status: string | null
      started_at: string | null
      completed_at: string | null
      cost: number | null
      duration: number | null
    }

    this.db
      .prepare(
        `
          UPDATE tasks
          SET
            status = ?,
            started_at = ?,
            completed_at = ?,
            cost = ?,
            duration = ?,
            updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        aggregate.task_status ?? 'todo',
        aggregate.started_at ?? null,
        aggregate.completed_at ?? null,
        aggregate.cost ?? null,
        aggregate.duration ?? null,
        now,
        taskId
      )

    return this.getTask(taskId)
  }

  deleteTasksByProjectId(projectId: string): number {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE project_id = ?')
    const result = stmt.run(projectId)
    return result.changes
  }

  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }
}
