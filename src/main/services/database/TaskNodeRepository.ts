import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  CompleteTaskNodeInput,
  CreateTaskNodeInput,
  TaskNode,
  TaskNodeStatus
} from '../../types/task'

interface UpdateTaskNodeRuntimeInput {
  session_id?: string | null
  resume_session_id?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
}

export class TaskNodeRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createConversationNode(input: {
    task_id: string
    prompt: string
    name?: string
    cli_tool_id?: string | null
    agent_tool_config_id?: string | null
  }): TaskNode {
    return this.createNode({
      id: newUlid(),
      task_id: input.task_id,
      node_order: 1,
      name: input.name ?? 'Conversation',
      prompt: input.prompt,
      cli_tool_id: input.cli_tool_id ?? null,
      agent_tool_config_id: input.agent_tool_config_id ?? null,
      requires_approval: false
    })
  }

  createNodesFromTemplate(taskId: string, nodes: CreateTaskNodeInput[]): TaskNode[] {
    const create = this.db.transaction((items: CreateTaskNodeInput[]) => {
      for (const node of items) {
        this.insertNode({
          ...node,
          id: node.id || newUlid(),
          task_id: taskId
        })
      }
    })

    create(nodes)
    return this.getTaskNodes(taskId)
  }

  createNode(input: CreateTaskNodeInput): TaskNode {
    const nodeId = this.insertNode(input)
    return this.getTaskNode(nodeId)!
  }

  getTaskNodes(taskId: string): TaskNode[] {
    return this.db
      .prepare('SELECT * FROM task_nodes WHERE task_id = ? ORDER BY node_order ASC')
      .all(taskId) as TaskNode[]
  }

  getTaskNode(nodeId: string): TaskNode | null {
    return (
      (this.db.prepare('SELECT * FROM task_nodes WHERE id = ?').get(nodeId) as TaskNode | undefined) ??
      null
    )
  }

  getCurrentTaskNode(taskId: string): TaskNode | null {
    return (
      (this.db
        .prepare(
          `
            SELECT *
            FROM task_nodes
            WHERE task_id = ?
              AND status IN ('in_progress', 'in_review', 'todo')
            ORDER BY
              CASE status
                WHEN 'in_progress' THEN 1
                WHEN 'in_review' THEN 2
                ELSE 3
              END,
              node_order ASC
            LIMIT 1
          `
        )
        .get(taskId) as TaskNode | undefined) ?? null
    )
  }

  getTaskNodesByStatus(taskId: string, status: TaskNodeStatus): TaskNode[] {
    return this.db
      .prepare('SELECT * FROM task_nodes WHERE task_id = ? AND status = ? ORDER BY node_order ASC')
      .all(taskId, status) as TaskNode[]
  }

  getInProgressNodes(): TaskNode[] {
    return this.db
      .prepare(
        `
          SELECT *
          FROM task_nodes
          WHERE status = 'in_progress'
          ORDER BY updated_at ASC
        `
      )
      .all() as TaskNode[]
  }

  getNextTodoNode(taskId: string): TaskNode | null {
    return (
      (this.db
        .prepare(
          `
            SELECT *
            FROM task_nodes
            WHERE task_id = ? AND status = 'todo'
            ORDER BY node_order ASC
            LIMIT 1
          `
        )
        .get(taskId) as TaskNode | undefined) ?? null
    )
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    const row = this.db
      .prepare('SELECT task_id FROM task_nodes WHERE session_id = ? LIMIT 1')
      .get(sessionId) as { task_id?: string } | undefined
    return row?.task_id ?? null
  }

  startNode(nodeId: string, sessionId?: string | null): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = 'in_progress',
            error_message = NULL,
            started_at = COALESCE(started_at, ?),
            session_id = COALESCE(?, session_id),
            updated_at = ?
          WHERE id = ? AND status = 'todo'
        `
      )
      .run(now, sessionId ?? null, now, nodeId)

    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  completeNode(
    input: CompleteTaskNodeInput & {
      session_id?: string | null
      cost?: number | null
      duration?: number | null
      completed_at?: string | null
    }
  ): TaskNode | null {
    const now = input.completed_at ?? new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = ?,
            result_summary = ?,
            error_message = ?,
            cost = ?,
            duration = ?,
            completed_at = ?,
            session_id = COALESCE(?, session_id),
            updated_at = ?
          WHERE id = ? AND status = 'in_progress'
        `
      )
      .run(
        input.status,
        input.result_summary ?? null,
        input.error_message ?? null,
        input.cost ?? null,
        input.duration ?? null,
        now,
        input.session_id ?? null,
        now,
        input.node_id
      )

    if (result.changes === 0) return null
    return this.getTaskNode(input.node_id)
  }

  markErrorReview(
    nodeId: string,
    errorMessage: string,
    sessionId?: string | null,
    cost?: number | null,
    duration?: number | null
  ): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = 'in_review',
            error_message = ?,
            session_id = COALESCE(?, session_id),
            cost = COALESCE(?, cost),
            duration = COALESCE(?, duration),
            completed_at = COALESCE(completed_at, ?),
            updated_at = ?
          WHERE id = ? AND status = 'in_progress'
        `
      )
      .run(errorMessage, sessionId ?? null, cost ?? null, duration ?? null, now, now, nodeId)

    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  approveNode(nodeId: string): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = 'done',
            error_message = NULL,
            updated_at = ?
          WHERE id = ? AND status = 'in_review'
        `
      )
      .run(now, nodeId)

    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  rerunNode(nodeId: string, sessionId?: string | null): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = 'in_progress',
            error_message = NULL,
            result_summary = NULL,
            cost = NULL,
            duration = NULL,
            completed_at = NULL,
            session_id = COALESCE(?, session_id),
            updated_at = ?
          WHERE id = ? AND status = 'in_review'
        `
      )
      .run(sessionId ?? null, now, nodeId)

    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  stopNodeExecution(nodeId: string, reason = 'stopped_by_user'): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE task_nodes
          SET
            status = 'in_review',
            error_message = ?,
            completed_at = ?,
            updated_at = ?
          WHERE id = ? AND status = 'in_progress'
        `
      )
      .run(reason, now, now, nodeId)

    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  setNodeSessionId(nodeId: string, sessionId: string | null): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare('UPDATE task_nodes SET session_id = ?, updated_at = ? WHERE id = ?')
      .run(sessionId, now, nodeId)
    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  setNodeResumeSessionId(nodeId: string, resumeSessionId: string | null): TaskNode | null {
    const now = new Date().toISOString()
    const result = this.db
      .prepare('UPDATE task_nodes SET resume_session_id = ?, updated_at = ? WHERE id = ?')
      .run(resumeSessionId, now, nodeId)
    if (result.changes === 0) return null
    return this.getTaskNode(nodeId)
  }

  updateTaskNodeRuntime(taskId: string, updates: UpdateTaskNodeRuntimeInput): TaskNode | null {
    const node = this.getCurrentTaskNode(taskId) ?? this.getTaskNodes(taskId)[0]
    if (!node) return null

    const fields: string[] = []
    const values: unknown[] = []

    if (updates.session_id !== undefined) {
      fields.push('session_id = ?')
      values.push(updates.session_id)
    }
    if (updates.resume_session_id !== undefined) {
      fields.push('resume_session_id = ?')
      values.push(updates.resume_session_id)
    }
    if (updates.cli_tool_id !== undefined) {
      fields.push('cli_tool_id = ?')
      values.push(updates.cli_tool_id)
    }
    if (updates.agent_tool_config_id !== undefined) {
      fields.push('agent_tool_config_id = ?')
      values.push(updates.agent_tool_config_id)
    }

    if (fields.length === 0) return node

    const now = new Date().toISOString()
    fields.push('updated_at = ?')
    values.push(now, node.id)

    this.db.prepare(`UPDATE task_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getTaskNode(node.id)
  }

  private insertNode(input: CreateTaskNodeInput): string {
    const now = new Date().toISOString()
    const nodeId = input.id ?? newUlid()
    this.db
      .prepare(
        `
          INSERT INTO task_nodes (
            id, task_id, node_order, name, prompt, cli_tool_id, agent_tool_config_id,
            requires_approval, status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?)
        `
      )
      .run(
        nodeId,
        input.task_id,
        input.node_order,
        input.name,
        input.prompt,
        input.cli_tool_id ?? null,
        input.agent_tool_config_id ?? null,
        input.requires_approval ? 1 : 0,
        now,
        now
      )

    return nodeId
  }
}
