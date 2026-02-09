import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  WorkflowTemplate,
  TaskNodeTemplate
} from '../../types/workflow'

export class WorkflowRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createWorkflowTemplate(input: CreateWorkflowTemplateInput): WorkflowTemplate {
    const now = new Date().toISOString()
    const templateId = newUlid()
    const nodes = input.nodes ?? []

    if (input.scope === 'project' && !input.project_id) {
      throw new Error('Project workflow template requires project_id')
    }

    const create = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO workflow_templates (id, scope, project_id, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
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
          (id, template_id, node_order, name, prompt, cli_tool_id, agent_tool_config_id, requires_approval, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      nodes.forEach((node) => {
        insertNode.run(
          newUlid(),
          templateId,
          node.node_order,
          node.name,
          node.prompt,
          node.cli_tool_id ?? null,
          node.agent_tool_config_id ?? null,
          node.requires_approval ? 1 : 0,
          now,
          now
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
      nodes: this.getTaskNodeTemplates(row.id)
    }))
  }

  getWorkflowTemplatesByProject(projectId: string): WorkflowTemplate[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM workflow_templates WHERE scope = ? AND project_id = ? ORDER BY updated_at DESC'
      )
      .all('project', projectId) as WorkflowTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'project' as const,
      nodes: this.getTaskNodeTemplates(row.id)
    }))
  }

  getWorkflowTemplate(id: string): WorkflowTemplate | null {
    const template = this.db
      .prepare('SELECT * FROM workflow_templates WHERE id = ?')
      .get(id) as WorkflowTemplate | undefined
    if (!template) return null
    return { ...template, nodes: this.getTaskNodeTemplates(template.id) }
  }

  updateWorkflowTemplate(input: UpdateWorkflowTemplateInput): WorkflowTemplate {
    const now = new Date().toISOString()
    const existing = this.getWorkflowTemplate(input.id)
    if (!existing) throw new Error('Workflow template not found')

    const update = this.db.transaction(() => {
      this.db
        .prepare('UPDATE workflow_templates SET name = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(input.name, input.description || null, now, input.id)
      this.db.prepare('DELETE FROM workflow_template_nodes WHERE template_id = ?').run(input.id)

      const insertNode = this.db.prepare(
        `INSERT INTO workflow_template_nodes (id, template_id, node_order, name, prompt, cli_tool_id, agent_tool_config_id, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      input.nodes.forEach((node) => {
        insertNode.run(
          newUlid(),
          input.id,
          node.node_order,
          node.name,
          node.prompt,
          node.cli_tool_id ?? null,
          node.agent_tool_config_id ?? null,
          node.requires_approval ? 1 : 0,
          now,
          now
        )
      })
    })
    update()
    return this.getWorkflowTemplate(input.id)!
  }

  deleteWorkflowTemplate(id: string, scope: 'global' | 'project'): boolean {
    const template = this.db
      .prepare('SELECT id FROM workflow_templates WHERE id = ? AND scope = ?')
      .get(id, scope) as { id: string } | undefined
    if (!template) return false
    const del = this.db.transaction(() => {
      this.db.prepare('DELETE FROM workflow_template_nodes WHERE template_id = ?').run(id)
      return this.db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(id).changes > 0
    })
    return del()
  }

  deleteWorkflowTemplatesByProject(projectId: string): number {
    const del = this.db.transaction(() => {
      this.db
        .prepare(`
          DELETE FROM workflow_template_nodes
          WHERE template_id IN (
            SELECT id FROM workflow_templates WHERE scope = 'project' AND project_id = ?
          )
        `)
        .run(projectId)

      const result = this.db
        .prepare("DELETE FROM workflow_templates WHERE scope = 'project' AND project_id = ?")
        .run(projectId)

      return result.changes
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
        cli_tool_id: node.cli_tool_id ?? undefined,
        agent_tool_config_id: node.agent_tool_config_id ?? undefined,
        requires_approval: node.requires_approval
      }))
    })
  }


  private getTaskNodeTemplates(templateId: string): TaskNodeTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_template_nodes WHERE template_id = ? ORDER BY node_order ASC')
      .all(templateId) as TaskNodeTemplate[]
    return rows.map((node) => ({
      ...node,
      requires_approval: Boolean(node.requires_approval)
    }))
  }
}
