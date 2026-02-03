import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type { AgentExecution } from '../../types/agent'

export class AgentRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createAgentExecution(workNodeId: string): AgentExecution {
    const now = new Date().toISOString()
    const id = newUlid()
    // 获取当前最大 execution_index
    const maxIndex = this.db.prepare(
      'SELECT MAX(execution_index) as max FROM agent_executions WHERE work_node_id = ?'
    ).get(workNodeId) as { max: number | null }
    const nextIndex = (maxIndex.max ?? 0) + 1

    this.db.prepare(`
      INSERT INTO agent_executions (id, work_node_id, execution_index, status, created_at)
      VALUES (?, ?, ?, 'idle', ?)
    `).run(id, workNodeId, nextIndex, now)
    return this.getAgentExecution(id)!
  }

  getAgentExecution(id: string): AgentExecution | null {
    return this.db.prepare('SELECT * FROM agent_executions WHERE id = ?').get(id) as AgentExecution | null
  }

  getAgentExecutionsByWorkNodeId(workNodeId: string): AgentExecution[] {
    return this.db.prepare(
      'SELECT * FROM agent_executions WHERE work_node_id = ? ORDER BY execution_index ASC'
    ).all(workNodeId) as AgentExecution[]
  }

  getLatestAgentExecution(workNodeId: string): AgentExecution | null {
    return this.db.prepare(
      'SELECT * FROM agent_executions WHERE work_node_id = ? ORDER BY execution_index DESC LIMIT 1'
    ).get(workNodeId) as AgentExecution | null
  }

  updateAgentExecutionStatus(
    id: string,
    status: 'idle' | 'running' | 'completed',
    cost?: number,
    duration?: number
  ): AgentExecution | null {
    const now = new Date().toISOString()
    if (status === 'running') {
      this.db.prepare('UPDATE agent_executions SET status = ?, started_at = ? WHERE id = ?').run(status, now, id)
    } else if (status === 'completed') {
      this.db.prepare('UPDATE agent_executions SET status = ?, completed_at = ?, cost = ?, duration = ? WHERE id = ?')
        .run(status, now, cost ?? null, duration ?? null, id)
    } else {
      this.db.prepare('UPDATE agent_executions SET status = ? WHERE id = ?').run(status, id)
    }

    return this.getAgentExecution(id)
  }
}
