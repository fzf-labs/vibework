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
        id, session_id, title, prompt, status, task_mode, project_id, worktree_path, branch_name,
        base_branch, workspace_path, cli_tool_id, agent_tool_config_id, cost, duration, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `)
    stmt.run(
      input.id,
      input.session_id ?? null,
      input.title,
      input.prompt,
      input.task_mode ?? 'conversation',
      input.project_id || null,
      input.worktree_path || null,
      input.branch_name || null,
      input.base_branch || null,
      input.workspace_path || null,
      input.cli_tool_id || null,
      input.agent_tool_config_id || null,
      now,
      now
    )
    return this.getTask(input.id)!
  }

  getTask(id: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
    return (stmt.get(id) as Task) || null
  }

  getTaskBySessionId(sessionId: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE session_id = ?')
    return (stmt.get(sessionId) as Task) || null
  }

  getAllTasks(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    return stmt.all() as Task[]
  }

  getTasksByProjectId(projectId: string): Task[] {
    const stmt = this.db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC'
    )
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
    if (updates.session_id !== undefined) {
      fields.push('session_id = ?')
      values.push(updates.session_id)
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
    if (updates.cli_tool_id !== undefined) {
      fields.push('cli_tool_id = ?')
      values.push(updates.cli_tool_id)
    }
    if (updates.agent_tool_config_id !== undefined) {
      fields.push('agent_tool_config_id = ?')
      values.push(updates.agent_tool_config_id)
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
    this.db
      .prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id)
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
