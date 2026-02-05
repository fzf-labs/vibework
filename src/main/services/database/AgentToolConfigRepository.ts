import type Database from 'better-sqlite3'
import type {
  CreateAgentToolConfigInput,
  DbAgentToolConfig,
  UpdateAgentToolConfigInput
} from '../../types/db/agent-tool-config'

export class AgentToolConfigRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(toolId?: string): DbAgentToolConfig[] {
    if (toolId) {
      const stmt = this.db.prepare(
        `SELECT * FROM agent_tool_configs
         WHERE tool_id = ?
         ORDER BY is_default DESC, name ASC`
      )
      return stmt.all(toolId) as DbAgentToolConfig[]
    }
    const stmt = this.db.prepare(
      `SELECT * FROM agent_tool_configs
       ORDER BY tool_id ASC, is_default DESC, name ASC`
    )
    return stmt.all() as DbAgentToolConfig[]
  }

  get(id: string): DbAgentToolConfig | null {
    const stmt = this.db.prepare('SELECT * FROM agent_tool_configs WHERE id = ?')
    return (stmt.get(id) as DbAgentToolConfig) || null
  }

  getDefault(toolId: string): DbAgentToolConfig | null {
    const stmt = this.db.prepare(
      `SELECT * FROM agent_tool_configs
       WHERE tool_id = ? AND is_default = 1
       LIMIT 1`
    )
    return (stmt.get(toolId) as DbAgentToolConfig) || null
  }

  create(input: CreateAgentToolConfigInput): DbAgentToolConfig {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO agent_tool_configs (
        id, tool_id, name, description, config_json, is_default, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      input.id,
      input.tool_id,
      input.name,
      input.description ?? null,
      input.config_json,
      input.is_default ?? 0,
      now,
      now
    )
    return this.get(input.id)!
  }

  update(id: string, updates: UpdateAgentToolConfigInput): DbAgentToolConfig | null {
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
    if (updates.config_json !== undefined) {
      fields.push('config_json = ?')
      values.push(updates.config_json)
    }
    if (updates.is_default !== undefined) {
      fields.push('is_default = ?')
      values.push(updates.is_default)
    }

    if (fields.length === 0) return this.get(id)

    fields.push('updated_at = ?')
    values.push(now, id)

    const stmt = this.db.prepare(
      `UPDATE agent_tool_configs SET ${fields.join(', ')} WHERE id = ?`
    )
    stmt.run(...values)
    return this.get(id)
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM agent_tool_configs WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }

  setDefault(id: string): DbAgentToolConfig | null {
    const config = this.get(id)
    if (!config) return null

    const txn = this.db.transaction(() => {
      this.db.prepare(
        `UPDATE agent_tool_configs
         SET is_default = 0, updated_at = ?
         WHERE tool_id = ?`
      ).run(new Date().toISOString(), config.tool_id)

      this.db.prepare(
        `UPDATE agent_tool_configs
         SET is_default = 1, updated_at = ?
         WHERE id = ?`
      ).run(new Date().toISOString(), id)

      return this.get(id)
    })

    return txn()
  }
}
