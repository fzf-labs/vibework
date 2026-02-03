import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { getAppPaths } from './AppPaths'
import { newUlid } from '../utils/ids'
import { dialog } from 'electron'
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  resetDatabaseFiles,
  DatabaseBackup
} from '../utils/db-backup'

// 类型定义
export interface Project {
  id: string
  name: string
  path: string
  description: string | null
  project_type: 'normal' | 'git'
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  project_type?: 'normal' | 'git'
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  project_type?: 'normal' | 'git'
}

interface CreateTaskInput {
  id: string
  session_id: string
  title: string
  prompt: string
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
  cli_tool_id?: string
  workflow_template_id?: string
}

interface Task {
  id: string
  session_id: string
  title: string
  prompt: string
  status: string
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  base_branch: string | null
  workspace_path: string | null
  cli_tool_id: string | null
  workflow_template_id: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  created_at: string
  updated_at: string
}

interface UpdateTaskInput {
  session_id?: string
  title?: string
  prompt?: string
  status?: string
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  cli_tool_id?: string | null
  workflow_template_id?: string | null
  cost?: number | null
  duration?: number | null
  favorite?: boolean
}

// Workflow 相关类型
interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  nodes: WorkNodeTemplate[]
}

interface WorkNodeTemplate {
  id: string
  template_id: string
  node_order: number
  name: string
  prompt: string
  requires_approval: boolean
  continue_on_error: boolean
  created_at: string
  updated_at: string
}

interface Workflow {
  id: string
  task_id: string
  current_node_index: number
  status: 'todo' | 'in_progress' | 'done'
  created_at: string
  updated_at: string
}

interface WorkNode {
  id: string
  workflow_id: string
  template_node_id: string | null
  node_order: number
  name: string
  prompt: string
  requires_approval: boolean
  continue_on_error: boolean
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface AgentExecution {
  id: string
  work_node_id: string
  execution_index: number
  status: 'idle' | 'running' | 'completed'
  started_at: string | null
  completed_at: string | null
  cost: number | null
  duration: number | null
  created_at: string
}

// Workflow 输入类型
interface CreateWorkNodeTemplateInput {
  name: string
  prompt: string
  node_order: number
  requires_approval?: boolean
  continue_on_error?: boolean
}

interface CreateWorkflowTemplateInput {
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}

interface UpdateWorkflowTemplateInput {
  id: string
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}

export class DatabaseService {
  private db: Database.Database
  private workNodeStatusListeners: Array<(node: WorkNode) => void> = []
  private dbPath: string
  private backupPaths: DatabaseBackup | null = null

  constructor() {
    const appPaths = getAppPaths()
    this.dbPath = appPaths.getDatabaseFile()
    this.handleLegacyDatabase(this.dbPath, appPaths)
    console.log('[DatabaseService] Initializing database at:', this.dbPath)
    try {
      this.db = new Database(this.dbPath)
    } catch (error) {
      if (this.backupPaths) {
        console.error('[DatabaseService] Failed to open database, restoring backup:', error)
        this.restoreDatabaseBackup(this.backupPaths)
        dialog.showErrorBox(
          'Database Open Failed',
          'Failed to open the database after migration. The backup has been restored.'
        )
      }
      throw error
    }
    this.db.pragma('journal_mode = WAL')
    try {
      this.initTables()
    } catch (error) {
      if (this.backupPaths) {
        console.error('[DatabaseService] Failed to initialize tables, restoring backup:', error)
        this.restoreDatabaseBackup(this.backupPaths)
        dialog.showErrorBox(
          'Database Initialization Failed',
          'Failed to initialize the database. The backup has been restored.'
        )
      }
      throw error
    }
  }

  private handleLegacyDatabase(dbPath: string, appPaths: ReturnType<typeof getAppPaths>): void {
    if (!existsSync(dbPath)) return

    const legacyTables = [
      'sessions',
      'messages',
      'global_workflow_templates',
      'project_workflow_templates',
      'global_work_node_templates',
      'project_work_node_templates'
    ]

    let shouldReset = false
    let reason = ''
    try {
      const probe = new Database(dbPath, { readonly: true })
      const found = probe
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${legacyTables
            .map(() => '?')
            .join(',')})`
        )
        .all(...legacyTables)
      shouldReset = found.length > 0
      if (shouldReset) {
        reason = `Detected legacy tables: ${found.map((row: any) => row.name).join(', ')}`
      }
      probe.close()
    } catch (error) {
      console.error('[DatabaseService] Failed to probe database schema:', error)
      shouldReset = true
      reason = 'Database probe failed; possible legacy or corrupted schema.'
    }

    if (!shouldReset) return

    const approved = this.confirmLegacyReset(dbPath, reason)
    if (!approved) {
      console.warn('[DatabaseService] Legacy database reset cancelled by user.')
      return
    }

    const backup = createDatabaseBackup(dbPath, appPaths.getDatabaseBackupsDir())
    console.log('[DatabaseService] Backup created at:', backup.backup.db)
    this.backupPaths = backup
    try {
      resetDatabaseFiles(dbPath)
    } catch (error) {
      console.error('[DatabaseService] Failed to reset legacy database:', error)
      restoreDatabaseBackup(backup)
      dialog.showErrorBox(
        'Database Reset Failed',
        'Failed to reset the legacy database. Your backup has been restored.'
      )
      throw error
    }
  }

  private confirmLegacyReset(dbPath: string, reason: string): boolean {
    try {
      const result = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Cancel', 'Reset Database'],
        defaultId: 1,
        cancelId: 0,
        title: 'Legacy Database Detected',
        message: `A legacy or incompatible database was detected at:\n${dbPath}\n\n${reason}\n\nResetting will remove the existing database after creating a backup.`,
        noLink: true
      })
      return result === 1
    } catch (error) {
      console.error('[DatabaseService] Failed to show confirmation dialog:', error)
      return false
    }
  }

  private restoreDatabaseBackup(backup: DatabaseBackup): void {
    try {
      restoreDatabaseBackup(backup)
      console.log('[DatabaseService] Backup restored from:', backup.backup.db)
    } catch (error) {
      console.error('[DatabaseService] Failed to restore database backup:', error)
    }
  }

  onWorkNodeStatusChange(listener: (node: WorkNode) => void): () => void {
    this.workNodeStatusListeners.push(listener)
    return () => {
      this.workNodeStatusListeners = this.workNodeStatusListeners.filter(
        (registered) => registered !== listener
      )
    }
  }

  private initTables(): void {
    console.log('[DatabaseService] Creating tables...')

    // 创建 projects 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        project_type TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 创建 tasks 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        workspace_path TEXT,
        cli_tool_id TEXT,
        workflow_template_id TEXT,
        cost REAL,
        duration REAL,
        favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // 创建 workflow_templates 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK(scope IN ('global', 'project')),
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // 创建 workflow_template_nodes 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_template_nodes (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER NOT NULL DEFAULT 1,
        continue_on_error INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
        UNIQUE (template_id, node_order)
      )
    `)

    // 创建 workflows 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL UNIQUE,
        current_node_index INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // 创建 work_nodes 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_nodes (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        template_node_id TEXT,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER NOT NULL DEFAULT 1,
        continue_on_error INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        UNIQUE (workflow_id, node_order)
      )
    `)

    // 创建 agent_executions 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        work_node_id TEXT NOT NULL,
        execution_index INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'idle',
        started_at TEXT,
        completed_at TEXT,
        cost REAL,
        duration REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_node_id) REFERENCES work_nodes(id) ON DELETE CASCADE
      )
    `)

    this.createIndexes()

    console.log('[DatabaseService] Tables created successfully')
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_task_id ON workflows(task_id);
      CREATE INDEX IF NOT EXISTS idx_work_nodes_workflow_id ON work_nodes(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_agent_exec_work_node_id ON agent_executions(work_node_id);
    `)

    // workflow_templates 唯一性索引（部分索引）
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_template_name
        ON workflow_templates(name)
        WHERE scope = 'global';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_template_name
        ON workflow_templates(project_id, name)
        WHERE scope = 'project';
    `)
  }

  // ============ Task 操作 ============
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
      input.session_id,
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
    const values: any[] = []

    // 获取当前任务状态用于检测状态变更
    const currentTask = this.getTask(id)
    if (!currentTask) return null

    const oldStatus = currentTask.status
    const newStatus = updates.status

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

    // 状态变更触发：todo → in_progress 时自动实例化工作流
    if (oldStatus === 'todo' && newStatus === 'in_progress') {
      this.onTaskStarted(id, currentTask)
    }

    return this.getTask(id)
  }

  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ============ 任务状态变更触发 ============
  private onTaskStarted(taskId: string, task: Task): void {
    const templateId = task.workflow_template_id
    if (!templateId) return

    const existing = this.getWorkflowByTaskId(taskId)
    const workflow = existing ?? this.ensureWorkflowFromTemplate(taskId, templateId)
    if (!workflow) return

    // 启动第一个节点
    this.updateWorkflowStatus(workflow.id, 'in_progress')
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    if (nodes.length > 0) {
      this.startWorkNode(nodes[0].id)
    }
  }

  private ensureWorkflowFromTemplate(taskId: string, templateId: string): Workflow | null {
    const template = this.getWorkflowTemplate(templateId)
    if (!template) return null

    const workflow = this.createWorkflow(taskId)
    for (const nodeTemplate of template.nodes) {
      this.createWorkNodeFromTemplate(workflow.id, nodeTemplate)
    }

    return this.getWorkflow(workflow.id)
  }

  seedWorkflowForTask(taskId: string, templateId: string): Workflow | null {
    const existing = this.getWorkflowByTaskId(taskId)
    if (existing) return existing
    return this.ensureWorkflowFromTemplate(taskId, templateId)
  }

  private startWorkNode(workNodeId: string): void {
    this.updateWorkNodeStatus(workNodeId, 'in_progress')
    this.createAgentExecution(workNodeId)
  }

  syncTaskStatusFromWorkflow(workflowId: string): void {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) return

    const taskStatus = this.deriveTaskStatusFromWorkflow(workflow)
    if (taskStatus) {
      const now = new Date().toISOString()
      this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
        .run(taskStatus, now, workflow.task_id)
    }
  }

  private deriveTaskStatusFromWorkflow(workflow: Workflow): string | null {
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    if (nodes.length === 0) return null

    // 原则2: Work Node → Task 自动联动
    // 1. 任意 Work Node = in_progress → Task in_progress
    const hasInProgressNode = nodes.some(n => n.status === 'in_progress')
    if (hasInProgressNode) return 'in_progress'

    // 2. 任意 Work Node = in_review 且无 in_progress → Task in_progress
    const hasReviewNode = nodes.some(n => n.status === 'in_review')
    if (hasReviewNode) return 'in_progress'

    // All nodes completed → Task in_review (await final approval)
    const allDone = nodes.every(n => n.status === 'done')
    if (allDone || workflow.status === 'done') return 'in_review'

    return null
  }

  completeWorkNode(workNodeId: string, requiresApproval: boolean): void {
    if (requiresApproval) {
      this.updateWorkNodeStatus(workNodeId, 'in_review')
    } else {
      this.finalizeWorkNode(workNodeId)
    }
  }

  private finalizeWorkNode(workNodeId: string): void {
    this.updateWorkNodeStatus(workNodeId, 'done')

    const node = this.getWorkNode(workNodeId)
    if (!node) return

    const workflow = this.getWorkflow(node.workflow_id)
    if (!workflow) return

    this.advanceToNextNode(workflow)
  }

  private advanceToNextNode(workflow: Workflow): void {
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    const nextIndex = workflow.current_node_index + 1

    if (nextIndex >= nodes.length) {
      // 所有节点完成
      this.updateWorkflowStatus(workflow.id, 'done')
      this.syncTaskStatusFromWorkflow(workflow.id)
      return
    }

    // 推进到下一个节点
    this.updateWorkflowStatus(workflow.id, 'in_progress', nextIndex)
    this.startWorkNode(nodes[nextIndex].id)
    this.syncTaskStatusFromWorkflow(workflow.id)
  }

  approveWorkNode(workNodeId: string): void {
    this.finalizeWorkNode(workNodeId)
  }

  rejectWorkNode(workNodeId: string): void {
    this.startWorkNode(workNodeId)
  }

  /**
   * 原则3: 用户审核任务通过 → Task: in_review → done
   */
  approveTask(taskId: string): boolean {
    const task = this.getTask(taskId)
    if (!task || task.status !== 'in_review') return false

    const now = new Date().toISOString()
    this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run('done', now, taskId)
    return true
  }

  // ============ Project 操作 ============
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

  /**
   * 获取工作节点的组合提示词（任务提示词 + 节点提示词）
   */
  getCombinedPromptForWorkNode(workNodeId: string): string | null {
    const workNode = this.getWorkNode(workNodeId)
    if (!workNode) return null

    const workflow = this.getWorkflow(workNode.workflow_id)
    if (!workflow) return null

    const task = this.getTask(workflow.task_id)
    if (!task) return null

    const nodePrompt = workNode.prompt || ''
    if (nodePrompt) {
      return `${task.prompt}\n\n${nodePrompt}`
    }
    return task.prompt
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
    const updatedNode = this.getWorkNode(id)
    if (updatedNode) {
      this.workNodeStatusListeners.forEach((listener) => {
        try {
          listener(updatedNode)
        } catch (error) {
          console.error('[DatabaseService] Work node status listener failed:', error)
        }
      })
    }
    return updatedNode
  }

  // ============ AgentExecution 操作 ============
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

  updateAgentExecutionStatus(id: string, status: 'idle' | 'running' | 'completed', cost?: number, duration?: number): AgentExecution | null {
    const now = new Date().toISOString()
    if (status === 'running') {
      this.db.prepare('UPDATE agent_executions SET status = ?, started_at = ? WHERE id = ?').run(status, now, id)
    } else if (status === 'completed') {
      this.db.prepare('UPDATE agent_executions SET status = ?, completed_at = ?, cost = ?, duration = ? WHERE id = ?')
        .run(status, now, cost ?? null, duration ?? null, id)
    } else {
      this.db.prepare('UPDATE agent_executions SET status = ? WHERE id = ?').run(status, id)
    }

    // 原则1: Agent CLI → Work Node 自动联动（idle 除外）
    const execution = this.getAgentExecution(id)
    if (execution && status !== 'idle') {
      this.syncWorkNodeFromAgentStatus(execution.work_node_id, status)
    }

    return execution
  }

  /**
   * 原则1: Agent CLI 状态同步到 Work Node
   * - running → in_progress
   * - completed → in_review
   */
  private syncWorkNodeFromAgentStatus(workNodeId: string, agentStatus: 'running' | 'completed'): void {
    const workNode = this.getWorkNode(workNodeId)
    if (!workNode) return
    if (workNode.status === 'done') return

    const workNodeStatus = agentStatus === 'running' ? 'in_progress' : 'in_review'
    this.updateWorkNodeStatus(workNodeId, workNodeStatus)

    // 同步更新 Task 状态
    this.syncTaskStatusFromWorkflow(workNode.workflow_id)
  }

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.db.close()
  }

  dispose(): void {
    this.close()
  }
}
