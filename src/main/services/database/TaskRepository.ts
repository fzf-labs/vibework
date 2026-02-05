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
        id, session_id, title, prompt, status, project_id, worktree_path, branch_name,
        base_branch, workspace_path, cli_tool_id, workflow_template_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      input.id,
      input.session_id ?? null,
      input.title,
      input.prompt,
      input.project_id || null,
      input.worktree_path || null,
      input.branch_name || null,
      input.base_branch || null,
      input.workspace_path || null,
      input.cli_tool_id || null,
      input.workflow_template_id || null,
      now,
      now
    )
    return this.getTask(input.id)!
  }

  getTask(id: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
    const task = stmt.get(id) as any
    if (task) {
      task.favorite = Boolean(task.favorite)
    }
    return task
  }

  getTaskBySessionId(sessionId: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE session_id = ?')
    const task = stmt.get(sessionId) as any
    if (task) {
      task.favorite = Boolean(task.favorite)
    }
    return task
  }

  getAllTasks(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    const tasks = stmt.all() as any[]
    return tasks.map((t) => ({ ...t, favorite: Boolean(t.favorite) }))
  }

  getTasksByProjectId(projectId: string): Task[] {
    const stmt = this.db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC'
    )
    const tasks = stmt.all(projectId) as any[]
    return tasks.map((t) => ({ ...t, favorite: Boolean(t.favorite) }))
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
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
    if (updates.workflow_template_id !== undefined) {
      fields.push('workflow_template_id = ?')
      values.push(updates.workflow_template_id)
    }
    if (updates.cost !== undefined) {
      fields.push('cost = ?')
      values.push(updates.cost)
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?')
      values.push(updates.duration)
    }
    if (updates.favorite !== undefined) {
      fields.push('favorite = ?')
      values.push(updates.favorite ? 1 : 0)
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
    this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id)
  }

  deleteTasksByProjectId(projectId: string): number {
    const del = this.db.transaction(() => {
      this.db.prepare(`
        DELETE FROM agent_executions
        WHERE work_node_id IN (
          SELECT id FROM work_nodes WHERE workflow_id IN (
            SELECT id FROM workflows WHERE task_id IN (
              SELECT id FROM tasks WHERE project_id = ?
            )
          )
        )
      `).run(projectId)

      this.db.prepare(`
        DELETE FROM work_nodes
        WHERE workflow_id IN (
          SELECT id FROM workflows WHERE task_id IN (
            SELECT id FROM tasks WHERE project_id = ?
          )
        )
      `).run(projectId)

      this.db.prepare(
        'DELETE FROM workflows WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)'
      ).run(projectId)

      const result = this.db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId)
      return result.changes
    })

    return del()
  }

  deleteTask(id: string): boolean {
    const del = this.db.transaction(() => {
      this.db.prepare(`
        DELETE FROM agent_executions
        WHERE work_node_id IN (
          SELECT id FROM work_nodes WHERE workflow_id IN (
            SELECT id FROM workflows WHERE task_id = ?
          )
        )
      `).run(id)

      this.db.prepare(
        'DELETE FROM work_nodes WHERE workflow_id IN (SELECT id FROM workflows WHERE task_id = ?)'
      ).run(id)

      this.db.prepare('DELETE FROM workflows WHERE task_id = ?').run(id)

      const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
      return result.changes > 0
    })

    return del()
  }
}
