import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../../types/project'

export class ProjectRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString()
    const id = newUlid()
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, description, project_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      input.name,
      input.path,
      input.description || null,
      input.project_type || 'normal',
      now,
      now
    )
    return this.getProject(id)!
  }

  getProject(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?')
    return stmt.get(id) as Project | null
  }

  getProjectByPath(path: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE path = ?')
    return stmt.get(path) as Project | null
  }

  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    return stmt.all() as Project[]
  }

  updateProject(id: string, updates: UpdateProjectInput): Project | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }
    if (updates.project_type !== undefined) {
      fields.push('project_type = ?')
      values.push(updates.project_type)
    }

    if (fields.length === 0) return this.getProject(id)

    fields.push('updated_at = ?')
    values.push(now, id)

    const stmt = this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    return this.getProject(id)
  }

  deleteProject(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }
}
