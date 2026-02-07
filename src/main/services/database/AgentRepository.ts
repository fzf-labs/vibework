import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type { AgentExecution } from '../../types/agent'

export class AgentRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createTaskExecution(
    taskId: string,
    sessionId?: string | null,
    cliToolId?: string | null,
    agentToolConfigId?: string | null
  ): AgentExecution {
    const now = new Date().toISOString()
    const id = newUlid()
    const maxIndex = this.db
      .prepare(
        'SELECT MAX(execution_index) as max FROM agent_executions WHERE task_id = ? AND work_node_id IS NULL'
      )
      .get(taskId) as { max: number | null }
    const nextIndex = (maxIndex.max ?? 0) + 1

    this.db
      .prepare(`
      INSERT INTO agent_executions (
        id, task_id, work_node_id, execution_scope, execution_index, status,
        session_id, cli_tool_id, agent_tool_config_id, created_at
      )
      VALUES (?, ?, NULL, 'conversation', ?, 'idle', ?, ?, ?, ?)
    `)
      .run(id, taskId, nextIndex, sessionId ?? null, cliToolId ?? null, agentToolConfigId ?? null, now)
    return this.getAgentExecution(id)!
  }

  createWorkNodeExecution(
    taskId: string,
    workNodeId: string,
    sessionId?: string | null,
    cliToolId?: string | null,
    agentToolConfigId?: string | null
  ): AgentExecution {
    const now = new Date().toISOString()
    const id = newUlid()
    const maxIndex = this.db
      .prepare('SELECT MAX(execution_index) as max FROM agent_executions WHERE work_node_id = ?')
      .get(workNodeId) as { max: number | null }
    const nextIndex = (maxIndex.max ?? 0) + 1

    this.db
      .prepare(`
      INSERT INTO agent_executions (
        id, task_id, work_node_id, execution_scope, execution_index, status,
        session_id, cli_tool_id, agent_tool_config_id, created_at
      )
      VALUES (?, ?, ?, 'workflow', ?, 'idle', ?, ?, ?, ?)
    `)
      .run(
        id,
        taskId,
        workNodeId,
        nextIndex,
        sessionId ?? null,
        cliToolId ?? null,
        agentToolConfigId ?? null,
        now
      )
    return this.getAgentExecution(id)!
  }

  createAgentExecution(workNodeId: string): AgentExecution {
    const taskId = this.getTaskIdByWorkNodeId(workNodeId)
    if (!taskId) {
      throw new Error(`Task not found for work node: ${workNodeId}`)
    }
    return this.createWorkNodeExecution(taskId, workNodeId)
  }

  getAgentExecution(id: string): AgentExecution | null {
    return (
      (this.db.prepare('SELECT * FROM agent_executions WHERE id = ?').get(id) as AgentExecution) || null
    )
  }

  getAgentExecutionsByTaskId(taskId: string): AgentExecution[] {
    return this.db
      .prepare('SELECT * FROM agent_executions WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as AgentExecution[]
  }

  getAgentExecutionsByWorkNodeId(workNodeId: string): AgentExecution[] {
    return this.db
      .prepare('SELECT * FROM agent_executions WHERE work_node_id = ? ORDER BY execution_index ASC')
      .all(workNodeId) as AgentExecution[]
  }

  getLatestTaskExecution(taskId: string): AgentExecution | null {
    return (
      (this.db
        .prepare(
          "SELECT * FROM agent_executions WHERE task_id = ? AND execution_scope = 'conversation' ORDER BY execution_index DESC LIMIT 1"
        )
        .get(taskId) as AgentExecution) || null
    )
  }

  getLatestWorkNodeExecution(workNodeId: string): AgentExecution | null {
    return (
      (this.db
        .prepare('SELECT * FROM agent_executions WHERE work_node_id = ? ORDER BY execution_index DESC LIMIT 1')
        .get(workNodeId) as AgentExecution) || null
    )
  }

  getLatestAgentExecution(workNodeId: string): AgentExecution | null {
    return this.getLatestWorkNodeExecution(workNodeId)
  }

  updateAgentExecutionStatus(
    id: string,
    status: 'idle' | 'running' | 'completed',
    cost?: number,
    duration?: number
  ): AgentExecution | null {
    const now = new Date().toISOString()
    if (status === 'running') {
      this.db
        .prepare('UPDATE agent_executions SET status = ?, started_at = ? WHERE id = ?')
        .run(status, now, id)
    } else if (status === 'completed') {
      this.db
        .prepare(
          'UPDATE agent_executions SET status = ?, completed_at = ?, cost = ?, duration = ? WHERE id = ?'
        )
        .run(status, now, cost ?? null, duration ?? null, id)
    } else {
      this.db.prepare('UPDATE agent_executions SET status = ? WHERE id = ?').run(status, id)
    }

    return this.getAgentExecution(id)
  }

  private getTaskIdByWorkNodeId(workNodeId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT w.task_id as task_id
         FROM work_nodes n
         JOIN workflows w ON w.id = n.workflow_id
         WHERE n.id = ?
         LIMIT 1`
      )
      .get(workNodeId) as { task_id?: string } | undefined
    return row?.task_id ?? null
  }
}
