import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  Workflow,
  WorkflowTemplate,
  WorkNode,
  WorkNodeTemplate
} from '../../types/workflow'

export class WorkflowRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  // ============ Workflow Template 操作 ============
  createWorkflowTemplate(input: CreateWorkflowTemplateInput): WorkflowTemplate {
    const now = new Date().toISOString()
    const templateId = newUlid()
    const nodes = input.nodes ?? []

    if (input.scope === 'project' && !input.project_id) {
      throw new Error('Project workflow template requires project_id')
    }

    const create = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO workflow_templates (id, scope, project_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        templateId,
        input.scope,
        input.scope === 'project' ? input.project_id! : null,
        input.name,
        input.description || null,
        now,
        now
      )

      const insertNode = this.db.prepare(`
        INSERT INTO workflow_template_nodes
          (id, template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      nodes.forEach((node) => {
        insertNode.run(
          newUlid(), templateId, node.node_order, node.name, node.prompt,
          node.requires_approval ? 1 : 0, node.continue_on_error ? 1 : 0, now, now
        )
      })
    })

    create()
    return this.getWorkflowTemplate(templateId)!
  }

  getGlobalWorkflowTemplates(): WorkflowTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_templates WHERE scope = ? ORDER BY updated_at DESC')
      .all('global') as WorkflowTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'global' as const,
      project_id: null,
      nodes: this.getWorkNodeTemplates(row.id)
    }))
  }

  getWorkflowTemplatesByProject(projectId: string): WorkflowTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_templates WHERE scope = ? AND project_id = ? ORDER BY updated_at DESC')
      .all('project', projectId) as WorkflowTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'project' as const,
      nodes: this.getWorkNodeTemplates(row.id)
    }))
  }

  getWorkflowTemplate(id: string): WorkflowTemplate | null {
    const template = this.db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(id) as WorkflowTemplate | undefined
    if (!template) return null
    return { ...template, nodes: this.getWorkNodeTemplates(template.id) }
  }

  updateWorkflowTemplate(input: UpdateWorkflowTemplateInput): WorkflowTemplate {
    const now = new Date().toISOString()
    const existing = this.getWorkflowTemplate(input.id)
    if (!existing) throw new Error('Workflow template not found')

    const update = this.db.transaction(() => {
      this.db.prepare(
        'UPDATE workflow_templates SET name = ?, description = ?, updated_at = ? WHERE id = ?'
      ).run(input.name, input.description || null, now, input.id)
      this.db.prepare('DELETE FROM workflow_template_nodes WHERE template_id = ?').run(input.id)

      const insertNode = this.db.prepare(
        `INSERT INTO workflow_template_nodes (id, template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      input.nodes.forEach((node) => {
        insertNode.run(
          newUlid(),
          input.id,
          node.node_order,
          node.name,
          node.prompt,
          node.requires_approval ? 1 : 0,
          node.continue_on_error ? 1 : 0,
          now,
          now
        )
      })
    })
    update()
    return this.getWorkflowTemplate(input.id)!
  }

  deleteWorkflowTemplate(id: string, scope: 'global' | 'project'): boolean {
    const template = this.db.prepare('SELECT id FROM workflow_templates WHERE id = ? AND scope = ?').get(id, scope) as { id: string } | undefined
    if (!template) return false
    const del = this.db.transaction(() => {
      this.db.prepare('DELETE FROM workflow_template_nodes WHERE template_id = ?').run(id)
      return this.db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(id).changes > 0
    })
    return del()
  }

  copyGlobalWorkflowToProject(globalTemplateId: string, projectId: string): WorkflowTemplate {
    const template = this.getWorkflowTemplate(globalTemplateId)
    if (!template || template.scope !== 'global') {
      throw new Error('Global template not found')
    }
    return this.createWorkflowTemplate({
      name: template.name,
      description: template.description ?? undefined,
      scope: 'project',
      project_id: projectId,
      nodes: template.nodes.map((node) => ({
        name: node.name,
        prompt: node.prompt,
        node_order: node.node_order,
        requires_approval: node.requires_approval,
        continue_on_error: node.continue_on_error
      }))
    })
  }

  getWorkNodeTemplate(templateNodeId: string): WorkNodeTemplate | null {
    const template = this.db.prepare(
      'SELECT * FROM workflow_template_nodes WHERE id = ?'
    ).get(templateNodeId) as WorkNodeTemplate | undefined
    if (!template) return null
    return {
      ...template,
      requires_approval: Boolean(template.requires_approval),
      continue_on_error: Boolean(template.continue_on_error)
    }
  }

  // ============ Workflow 实例操作 ============
  createWorkflow(taskId: string): Workflow {
    const now = new Date().toISOString()
    const id = newUlid()
    this.db.prepare(`
      INSERT INTO workflows (id, task_id, current_node_index, status, created_at, updated_at)
      VALUES (?, ?, 0, 'todo', ?, ?)
    `).run(id, taskId, now, now)
    return this.getWorkflow(id)!
  }

  getWorkflow(id: string): Workflow | null {
    return this.db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Workflow | null
  }

  getWorkflowByTaskId(taskId: string): Workflow | null {
    return this.db.prepare('SELECT * FROM workflows WHERE task_id = ?').get(taskId) as Workflow | null
  }

  updateWorkflowStatus(id: string, status: string, nodeIndex?: number): Workflow | null {
    const now = new Date().toISOString()
    if (nodeIndex !== undefined) {
      this.db.prepare('UPDATE workflows SET status = ?, current_node_index = ?, updated_at = ? WHERE id = ?').run(status, nodeIndex, now, id)
    } else {
      this.db.prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
    }
    return this.getWorkflow(id)
  }

  // ============ WorkNode 实例操作 ============
  createWorkNodeFromTemplate(workflowId: string, template: WorkNodeTemplate): WorkNode {
    return this.insertWorkNode(
      workflowId,
      template.id,
      template.node_order,
      template.name,
      template.prompt,
      template.requires_approval,
      template.continue_on_error
    )
  }

  createWorkNode(workflowId: string, templateId: string, nodeOrder: number): WorkNode {
    const template = this.getWorkNodeTemplate(templateId)
    if (!template) {
      throw new Error('Work node template not found')
    }
    const order = Number.isFinite(nodeOrder) ? nodeOrder : template.node_order
    return this.insertWorkNode(
      workflowId,
      template.id,
      order,
      template.name,
      template.prompt,
      template.requires_approval,
      template.continue_on_error
    )
  }

  getWorkNode(id: string): WorkNode | null {
    const node = this.db.prepare('SELECT * FROM work_nodes WHERE id = ?').get(id) as WorkNode | null
    if (!node) return null
    return {
      ...node,
      requires_approval: Boolean((node as any).requires_approval),
      continue_on_error: Boolean((node as any).continue_on_error)
    }
  }

  getWorkNodesByWorkflowId(workflowId: string): WorkNode[] {
    const nodes = this.db.prepare('SELECT * FROM work_nodes WHERE workflow_id = ? ORDER BY node_order ASC').all(workflowId) as WorkNode[]
    return nodes.map((node) => ({
      ...node,
      requires_approval: Boolean((node as any).requires_approval),
      continue_on_error: Boolean((node as any).continue_on_error)
    }))
  }

  updateWorkNodeStatus(id: string, status: string): WorkNode | null {
    const now = new Date().toISOString()
    if (status === 'in_progress') {
      this.db.prepare('UPDATE work_nodes SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?')
        .run(status, now, now, id)
    } else if (status === 'done') {
      this.db.prepare('UPDATE work_nodes SET status = ?, completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE id = ?')
        .run(status, now, now, id)
    } else {
      this.db.prepare('UPDATE work_nodes SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
    }
    return this.getWorkNode(id)
  }

  private getWorkNodeTemplates(templateId: string): WorkNodeTemplate[] {
    const rows = this.db.prepare(
      'SELECT * FROM workflow_template_nodes WHERE template_id = ? ORDER BY node_order ASC'
    ).all(templateId) as WorkNodeTemplate[]
    return rows.map((node) => ({
      ...node,
      requires_approval: Boolean(node.requires_approval),
      continue_on_error: Boolean(node.continue_on_error)
    }))
  }

  private insertWorkNode(
    workflowId: string,
    templateNodeId: string | null,
    nodeOrder: number,
    name: string,
    prompt: string,
    requiresApproval: boolean,
    continueOnError: boolean
  ): WorkNode {
    const now = new Date().toISOString()
    const id = newUlid()
    this.db.prepare(`
      INSERT INTO work_nodes (
        id, workflow_id, template_node_id, node_order, name, prompt,
        requires_approval, continue_on_error, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?)
    `).run(
      id,
      workflowId,
      templateNodeId,
      nodeOrder,
      name,
      prompt,
      requiresApproval ? 1 : 0,
      continueOnError ? 1 : 0,
      now,
      now
    )
    return this.getWorkNode(id)!
  }
}
