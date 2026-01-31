import Database from 'better-sqlite3'
import { getAppPaths } from './AppPaths'
import { isUlid, newUlid } from '../utils/ids'

// 类型定义
export interface Project {
  id: string
  name: string
  path: string
  description: string | null
  config: string | null
  project_type: 'normal' | 'git'
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  config?: Record<string, unknown>
  project_type?: 'normal' | 'git'
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  config?: Record<string, unknown>
  project_type?: 'normal' | 'git'
}

interface CreateSessionInput {
  id: string
  prompt: string
}

interface Session {
  id: string
  prompt: string
  task_count: number
  created_at: string
  updated_at: string
}

interface CreateTaskInput {
  id: string
  session_id: string
  task_index: number
  title: string
  prompt: string
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
  cli_tool_id?: string
  pipeline_template_id?: string
}

interface Task {
  id: string
  session_id: string
  task_index: number
  title: string
  prompt: string
  status: string
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  base_branch: string | null
  workspace_path: string | null
  cli_tool_id: string | null
  pipeline_template_id: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  created_at: string
  updated_at: string
}

interface UpdateTaskInput {
  title?: string
  prompt?: string
  status?: string
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  cli_tool_id?: string | null
  pipeline_template_id?: string | null
  cost?: number | null
  duration?: number | null
  favorite?: boolean
}

// Workflow 相关类型
interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  workflow_type: 'single_node' | 'spec' | 'bmad' | 'tdd'
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  nodes: WorkNodeTemplate[]
}

interface WorkNodeTemplate {
  id: string
  workflow_template_id: string
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
  workflow_template_id: string
  workflow_template_scope: 'global' | 'project'
  current_node_index: number
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  created_at: string
  updated_at: string
}

interface WorkNode {
  id: string
  workflow_id: string
  work_node_template_id: string
  node_order: number
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
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
  workflow_type?: 'single_node' | 'spec' | 'bmad' | 'tdd'
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}

interface UpdateWorkflowTemplateInput {
  id: string
  name: string
  description?: string
  workflow_type?: 'single_node' | 'spec' | 'bmad' | 'tdd'
  scope: 'global' | 'project'
  project_id?: string
  nodes: CreateWorkNodeTemplateInput[]
}

interface CreateMessageInput {
  task_id: string
  type: string
  content?: string | null
  tool_name?: string | null
  tool_input?: string | null
  tool_output?: string | null
  tool_use_id?: string | null
  subtype?: string | null
  error_message?: string | null
}

interface Message {
  id: string
  task_id: string
  type: string
  content: string | null
  tool_name: string | null
  tool_input: string | null
  tool_output: string | null
  tool_use_id: string | null
  subtype: string | null
  error_message: string | null
  created_at: string
}

export class DatabaseService {
  private db: Database.Database
  private workNodeStatusListeners: Array<(node: WorkNode) => void> = []

  constructor() {
    const appPaths = getAppPaths()
    const dbPath = appPaths.getDatabaseFile()
    console.log('[DatabaseService] Initializing database at:', dbPath)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
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
        config TEXT,
        project_type TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 创建 sessions 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        task_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 创建 tasks 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        workspace_path TEXT,
        cli_tool_id TEXT,
        pipeline_template_id TEXT,
        cost REAL,
        duration REAL,
        favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // 创建 messages 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        tool_use_id TEXT,
        subtype TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    this.migrateSchema()
    this.createIndexes()

    console.log('[DatabaseService] Tables created successfully')
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
    `)
  }

  private migrateSchema(): void {
    this.ensureColumn('projects', 'project_type', "TEXT NOT NULL DEFAULT 'normal'")
    this.ensureColumn('tasks', 'project_id', 'TEXT')
    this.ensureColumn('tasks', 'title', 'TEXT')
    this.ensureColumn('tasks', 'worktree_path', 'TEXT')
    this.ensureColumn('tasks', 'branch_name', 'TEXT')
    this.ensureColumn('tasks', 'base_branch', 'TEXT')
    this.ensureColumn('tasks', 'workspace_path', 'TEXT')
    this.ensureColumn('tasks', 'cli_tool_id', 'TEXT')
    this.ensureColumn('tasks', 'pipeline_template_id', 'TEXT')
    this.ensureColumn('tasks', 'cost', 'REAL')
    this.ensureColumn('tasks', 'duration', 'REAL')
    this.ensureColumn('tasks', 'favorite', 'INTEGER DEFAULT 0')
    this.ensureColumn('tasks', 'workflow_id', 'TEXT')
    this.ensureWorkflowTables()
    this.migrateWorkflowType()
    this.backfillTaskTitles()
    this.backfillWorkspacePaths()
    this.normalizeTaskStatuses()
    this.migrateToUlidIdentifiers()
    this.migrateRemoveFileLibrary()
  }

  private ensureWorkflowTables(): void {
    // 全局工作流模板表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_workflow_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        workflow_type TEXT NOT NULL DEFAULT 'single_node',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    // 全局工作节点模板表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_work_node_templates (
        id TEXT PRIMARY KEY,
        workflow_template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 1,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_template_id) REFERENCES global_workflow_templates(id) ON DELETE CASCADE
      )
    `)
    // 项目工作流模板表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_workflow_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        workflow_type TEXT NOT NULL DEFAULT 'single_node',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    // 项目工作节点模板表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_work_node_templates (
        id TEXT PRIMARY KEY,
        workflow_template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 1,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_template_id) REFERENCES project_workflow_templates(id) ON DELETE CASCADE
      )
    `)
    // 工作流实例表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        workflow_template_id TEXT NOT NULL,
        workflow_template_scope TEXT NOT NULL,
        current_node_index INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)
    // 工作节点实例表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_nodes (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        work_node_template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      )
    `)
    // Agent 执行记录表
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
  }

  private migrateWorkflowType(): void {
    // 为已存在的工作流模板表添加 workflow_type 字段
    if (this.tableExists('global_workflow_templates')) {
      this.ensureColumn('global_workflow_templates', 'workflow_type', "TEXT NOT NULL DEFAULT 'single_node'")
    }
    if (this.tableExists('project_workflow_templates')) {
      this.ensureColumn('project_workflow_templates', 'workflow_type', "TEXT NOT NULL DEFAULT 'single_node'")
    }
  }

  private backfillTaskTitles(): void {
    try {
      this.db.exec(`UPDATE tasks SET title = prompt WHERE title IS NULL OR title = ''`)
    } catch (error) {
      console.error('[DatabaseService] Failed to backfill task titles:', error)
    }
  }

  private backfillWorkspacePaths(): void {
    try {
      this.db.exec(
        `UPDATE tasks SET workspace_path = worktree_path WHERE workspace_path IS NULL AND worktree_path IS NOT NULL`
      )
    } catch (error) {
      console.error('[DatabaseService] Failed to backfill workspace paths:', error)
    }
  }

  private normalizeTaskStatuses(): void {
    try {
      this.db.exec(`UPDATE tasks SET status = 'todo' WHERE status = 'pending'`)
    } catch (error) {
      console.error('[DatabaseService] Failed to normalize task statuses:', error)
    }
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string
    }>
    const hasColumn = columns.some((col) => col.name === column)
    if (hasColumn) return

    console.log(`[DatabaseService] Adding missing column ${table}.${column}`)
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }

  private migrateToUlidIdentifiers(): void {
    const shouldMigrate = this.shouldMigrateToUlid()
    if (!shouldMigrate) {
      this.setSchemaVersion(2)
      return
    }

    console.log('[DatabaseService] Migrating identifiers to ULID...')

    const foreignKeys = this.db.pragma('foreign_keys', { simple: true }) as number
    this.db.pragma('foreign_keys = OFF')

    const migrate = this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE projects_ulid (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          description TEXT,
          config TEXT,
          project_type TEXT NOT NULL DEFAULT 'normal',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE sessions_ulid (
          id TEXT PRIMARY KEY,
          prompt TEXT NOT NULL,
          task_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE tasks_ulid (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          task_index INTEGER NOT NULL,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'todo',
          project_id TEXT,
          worktree_path TEXT,
          branch_name TEXT,
          base_branch TEXT,
          workspace_path TEXT,
          cli_tool_id TEXT,
          pipeline_template_id TEXT,
          cost REAL,
          duration REAL,
          favorite INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions_ulid(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects_ulid(id) ON DELETE SET NULL
        );
        CREATE TABLE messages_ulid (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT,
          tool_name TEXT,
          tool_input TEXT,
          tool_output TEXT,
          tool_use_id TEXT,
          subtype TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks_ulid(id) ON DELETE CASCADE
        );
      `)

      const projectRows = this.db.prepare('SELECT * FROM projects').all() as any[]
      const projectIdMap = new Map<string, string>()
      const insertProject = this.db.prepare(`
        INSERT INTO projects_ulid (id, name, path, description, config, project_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const row of projectRows) {
        const newId = newUlid()
        projectIdMap.set(String(row.id), newId)
        insertProject.run(
          newId,
          row.name,
          row.path,
          row.description ?? null,
          row.config ?? null,
          row.project_type ?? 'normal',
          row.created_at,
          row.updated_at
        )
      }

      const sessionRows = this.db.prepare('SELECT * FROM sessions').all() as any[]
      const sessionIdMap = new Map<string, string>()
      const insertSession = this.db.prepare(`
        INSERT INTO sessions_ulid (id, prompt, task_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const row of sessionRows) {
        const newId = newUlid()
        sessionIdMap.set(String(row.id), newId)
        insertSession.run(newId, row.prompt, row.task_count ?? 0, row.created_at, row.updated_at)
      }

      const taskRows = this.db.prepare('SELECT * FROM tasks').all() as any[]
      const taskIdMap = new Map<string, string>()
      const insertTask = this.db.prepare(`
        INSERT INTO tasks_ulid (
          id, session_id, task_index, title, prompt, status, project_id, worktree_path, branch_name,
          base_branch, workspace_path, cli_tool_id, pipeline_template_id,
          cost, duration, favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const row of taskRows) {
        const newId = newUlid()
        const mappedSessionId = sessionIdMap.get(String(row.session_id))
        if (!mappedSessionId) {
          throw new Error(`Missing session mapping for task ${row.id}`)
        }
        const mappedProjectId = row.project_id
          ? projectIdMap.get(String(row.project_id))
          : null
        if (row.project_id && !mappedProjectId) {
          console.warn(
            `[DatabaseService] Missing project mapping for task ${row.id}, clearing project_id`
          )
        }

        taskIdMap.set(String(row.id), newId)
        insertTask.run(
          newId,
          mappedSessionId,
          row.task_index,
          row.title ?? row.prompt,
          row.prompt,
          row.status,
          mappedProjectId ?? null,
          row.worktree_path ?? null,
          row.branch_name ?? null,
          row.base_branch ?? null,
          row.workspace_path ?? null,
          row.cli_tool_id ?? null,
          row.pipeline_template_id ?? null,
          row.cost ?? null,
          row.duration ?? null,
          row.favorite ?? 0,
          row.created_at,
          row.updated_at
        )
      }

      const messageRows = this.db.prepare('SELECT * FROM messages').all() as any[]
      const insertMessage = this.db.prepare(`
        INSERT INTO messages_ulid (
          id, task_id, type, content, tool_name, tool_input, tool_output,
          tool_use_id, subtype, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const row of messageRows) {
        const mappedTaskId = taskIdMap.get(String(row.task_id))
        if (!mappedTaskId) {
          throw new Error(`Missing task mapping for message ${row.id}`)
        }
        insertMessage.run(
          newUlid(),
          mappedTaskId,
          row.type,
          row.content ?? null,
          row.tool_name ?? null,
          row.tool_input ?? null,
          row.tool_output ?? null,
          row.tool_use_id ?? null,
          row.subtype ?? null,
          row.error_message ?? null,
          row.created_at
        )
      }

      this.assertRowCounts('projects', projectRows.length, 'projects_ulid')
      this.assertRowCounts('sessions', sessionRows.length, 'sessions_ulid')
      this.assertRowCounts('tasks', taskRows.length, 'tasks_ulid')
      this.assertRowCounts('messages', messageRows.length, 'messages_ulid')
      this.db.exec(`
        DROP TABLE messages;
        DROP TABLE tasks;
        DROP TABLE sessions;
        DROP TABLE projects;
      `)
      this.db.exec(`
        ALTER TABLE projects_ulid RENAME TO projects;
        ALTER TABLE sessions_ulid RENAME TO sessions;
        ALTER TABLE tasks_ulid RENAME TO tasks;
        ALTER TABLE messages_ulid RENAME TO messages;
      `)

    })
    try {
      migrate()
    } finally {
      this.db.pragma(`foreign_keys = ${foreignKeys}`)
    }
    this.setSchemaVersion(2)
  }

  private shouldMigrateToUlid(): boolean {
    const schemaVersion = this.db.pragma('user_version', { simple: true }) as number
    if (schemaVersion >= 2) return false

    const tables = ['projects', 'sessions', 'tasks', 'messages']
    for (const table of tables) {
      if (!this.tableExists(table)) return false
    }

    if (this.getIdColumnType('messages') !== 'TEXT') return true

    return tables.some((table) => this.tableHasNonUlidIds(table))
  }

  private migrateRemoveFileLibrary(): void {
    const schemaVersion = this.db.pragma('user_version', { simple: true }) as number
    if (schemaVersion >= 3) return

    const foreignKeys = this.db.pragma('foreign_keys', { simple: true }) as number
    this.db.pragma('foreign_keys = OFF')

    const migrate = this.db.transaction(() => {
      if (this.tableExists('files')) {
        this.db.exec('DROP TABLE files')
      }
      this.db.exec('DROP INDEX IF EXISTS idx_files_task_id')

      if (this.messagesHasAttachments()) {
        this.db.exec(`
          CREATE TABLE messages_no_attachments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            tool_name TEXT,
            tool_input TEXT,
            tool_output TEXT,
            tool_use_id TEXT,
            subtype TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
          );
          INSERT INTO messages_no_attachments (
            id, task_id, type, content, tool_name, tool_input, tool_output,
            tool_use_id, subtype, error_message, created_at
          )
          SELECT id, task_id, type, content, tool_name, tool_input, tool_output,
                 tool_use_id, subtype, error_message, created_at
          FROM messages;
          DROP TABLE messages;
          ALTER TABLE messages_no_attachments RENAME TO messages;
        `)
      }
    })

    try {
      migrate()
    } finally {
      this.db.pragma(`foreign_keys = ${foreignKeys}`)
    }

    this.setSchemaVersion(3)
  }

  private messagesHasAttachments(): boolean {
    const columns = this.db.prepare('PRAGMA table_info(messages)').all() as Array<{
      name: string
    }>
    return columns.some((col) => col.name === 'attachments')
  }

  private tableHasNonUlidIds(table: string): boolean {
    const rows = this.db.prepare(`SELECT id FROM ${table}`).all() as Array<{ id: unknown }>
    return rows.some((row) => !isUlid(row.id))
  }

  private getIdColumnType(table: string): string {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string
      type: string
    }>
    const idColumn = columns.find((col) => col.name === 'id')
    return idColumn?.type?.toUpperCase() ?? ''
  }

  private tableExists(table: string): boolean {
    const row = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { name?: string } | undefined
    return !!row?.name
  }

  private assertRowCounts(
    sourceTable: string,
    expected: number,
    targetTable: string
  ): void {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${targetTable}`).get() as {
      count: number
    }
    if (row.count !== expected) {
      throw new Error(
        `Row count mismatch for ${sourceTable} -> ${targetTable}: ${expected} vs ${row.count}`
      )
    }
  }

  private setSchemaVersion(version: number): void {
    this.db.pragma(`user_version = ${version}`)
  }

  // ============ Session 操作 ============
  createSession(input: CreateSessionInput): Session {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, prompt, task_count, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?)
    `)
    stmt.run(input.id, input.prompt, now, now)
    return this.getSession(input.id)!
  }

  getSession(id: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?')
    return stmt.get(id) as Session | null
  }

  getAllSessions(): Session[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC')
    return stmt.all() as Session[]
  }

  updateSessionTaskCount(sessionId: string, taskCount: number): void {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE sessions SET task_count = ?, updated_at = ? WHERE id = ?
    `)
    stmt.run(taskCount, now, sessionId)
  }

  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ============ Task 操作 ============
  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, session_id, task_index, title, prompt, status, project_id, worktree_path, branch_name,
        base_branch, workspace_path, cli_tool_id, pipeline_template_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      input.id,
      input.session_id,
      input.task_index,
      input.title,
      input.prompt,
      input.project_id || null,
      input.worktree_path || null,
      input.branch_name || null,
      input.base_branch || null,
      input.workspace_path || null,
      input.cli_tool_id || null,
      input.pipeline_template_id || null,
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

  getAllTasks(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    const tasks = stmt.all() as any[]
    return tasks.map((t) => ({ ...t, favorite: Boolean(t.favorite) }))
  }

  getTasksBySessionId(sessionId: string): Task[] {
    const stmt = this.db.prepare(
      'SELECT * FROM tasks WHERE session_id = ? ORDER BY task_index ASC'
    )
    const tasks = stmt.all(sessionId) as any[]
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
    if (updates.pipeline_template_id !== undefined) {
      fields.push('pipeline_template_id = ?')
      values.push(updates.pipeline_template_id)
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
    const templateId = task.pipeline_template_id
    if (!templateId) return

    // 获取工作流模板
    const template = this.getWorkflowTemplate(templateId)
    if (!template) return

    // 实例化工作流
    this.instantiateWorkflow(taskId, template)
  }

  private instantiateWorkflow(taskId: string, template: WorkflowTemplate): Workflow {
    // 创建 Workflow 实例
    const workflow = this.createWorkflow(taskId, template.id, template.scope)

    // 创建所有 WorkNode 实例
    for (const nodeTemplate of template.nodes) {
      this.createWorkNode(workflow.id, nodeTemplate.id, nodeTemplate.node_order)
    }

    // 更新工作流状态为 in_progress
    this.updateWorkflowStatus(workflow.id, 'in_progress')

    // 启动第一个节点
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    if (nodes.length > 0) {
      this.startWorkNode(nodes[0].id)
    }

    return this.getWorkflow(workflow.id)!
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

    // 3. 最后一个 Work Node = done → Task in_review
    // 注意：Task 的 done 状态由用户手动审核通过触发，不在此自动联动
    const lastNode = nodes[nodes.length - 1]
    if (lastNode.status === 'done') return 'in_review'

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

  // ============ Message 操作 ============
  createMessage(input: CreateMessageInput): Message {
    const now = new Date().toISOString()
    const id = newUlid()
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, task_id, type, content, tool_name, tool_input, tool_output,
        tool_use_id, subtype, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      input.task_id,
      input.type,
      input.content || null,
      input.tool_name || null,
      input.tool_input || null,
      input.tool_output || null,
      input.tool_use_id || null,
      input.subtype || null,
      input.error_message || null,
      now
    )
    return this.getMessage(id)!
  }

  getMessage(id: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?')
    return stmt.get(id) as Message | null
  }

  getMessagesByTaskId(taskId: string): Message[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY id ASC')
    return stmt.all(taskId) as Message[]
  }

  deleteMessagesByTaskId(taskId: string): number {
    const stmt = this.db.prepare('DELETE FROM messages WHERE task_id = ?')
    const result = stmt.run(taskId)
    return result.changes
  }

  // ============ Project 操作 ============
  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString()
    const id = newUlid()
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, description, config, project_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      input.name,
      input.path,
      input.description || null,
      input.config ? JSON.stringify(input.config) : null,
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
    if (updates.config !== undefined) {
      fields.push('config = ?')
      values.push(JSON.stringify(updates.config))
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
    const workflowType = input.workflow_type || 'single_node'

    if (input.scope === 'project' && !input.project_id) {
      throw new Error('Project workflow template requires project_id')
    }

    const create = this.db.transaction(() => {
      if (input.scope === 'global') {
        this.db.prepare(`
          INSERT INTO global_workflow_templates (id, name, description, workflow_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(templateId, input.name, input.description || null, workflowType, now, now)
      } else {
        this.db.prepare(`
          INSERT INTO project_workflow_templates (id, project_id, name, description, workflow_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(templateId, input.project_id!, input.name, input.description || null, workflowType, now, now)
      }

      const insertNode = this.db.prepare(
        input.scope === 'global'
          ? `INSERT INTO global_work_node_templates
             (id, workflow_template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO project_work_node_templates
             (id, workflow_template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )

      nodes.forEach((node) => {
        insertNode.run(
          newUlid(), templateId, node.node_order, node.name, node.prompt,
          node.requires_approval ? 1 : 0, node.continue_on_error ? 1 : 0, now, now
        )
      })
    })

    create()
    return this.getWorkflowTemplateByScope(templateId, input.scope)!
  }

  getGlobalWorkflowTemplates(): WorkflowTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM global_workflow_templates ORDER BY updated_at DESC')
      .all() as WorkflowTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'global' as const,
      project_id: null,
      nodes: this.getWorkNodeTemplates(row.id, 'global')
    }))
  }

  getWorkflowTemplatesByProject(projectId: string): WorkflowTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM project_workflow_templates WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId) as WorkflowTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'project' as const,
      nodes: this.getWorkNodeTemplates(row.id, 'project')
    }))
  }

  getWorkflowTemplate(id: string): WorkflowTemplate | null {
    const projectTemplate = this.getWorkflowTemplateByScope(id, 'project')
    if (projectTemplate) return projectTemplate
    return this.getWorkflowTemplateByScope(id, 'global')
  }

  updateWorkflowTemplate(input: UpdateWorkflowTemplateInput): WorkflowTemplate {
    const now = new Date().toISOString()
    const existing = this.getWorkflowTemplateByScope(input.id, input.scope)
    if (!existing) throw new Error('Workflow template not found')
    const workflowType = input.workflow_type || existing.workflow_type || 'single_node'

    const update = this.db.transaction(() => {
      if (input.scope === 'global') {
        this.db.prepare(
          'UPDATE global_workflow_templates SET name = ?, description = ?, workflow_type = ?, updated_at = ? WHERE id = ?'
        ).run(input.name, input.description || null, workflowType, now, input.id)
        this.db.prepare('DELETE FROM global_work_node_templates WHERE workflow_template_id = ?').run(input.id)
      } else {
        this.db.prepare(
          'UPDATE project_workflow_templates SET name = ?, description = ?, workflow_type = ?, updated_at = ? WHERE id = ?'
        ).run(input.name, input.description || null, workflowType, now, input.id)
        this.db.prepare('DELETE FROM project_work_node_templates WHERE workflow_template_id = ?').run(input.id)
      }

      const insertNode = this.db.prepare(
        input.scope === 'global'
          ? `INSERT INTO global_work_node_templates (id, workflow_template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO project_work_node_templates (id, workflow_template_id, node_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      input.nodes.forEach((node) => {
        insertNode.run(newUlid(), input.id, node.node_order, node.name, node.prompt, node.requires_approval ? 1 : 0, node.continue_on_error ? 1 : 0, now, now)
      })
    })
    update()
    return this.getWorkflowTemplateByScope(input.id, input.scope)!
  }

  deleteWorkflowTemplate(id: string, scope: 'global' | 'project'): boolean {
    const del = this.db.transaction(() => {
      if (scope === 'global') {
        this.db.prepare('DELETE FROM global_work_node_templates WHERE workflow_template_id = ?').run(id)
        return this.db.prepare('DELETE FROM global_workflow_templates WHERE id = ?').run(id).changes > 0
      }
      this.db.prepare('DELETE FROM project_work_node_templates WHERE workflow_template_id = ?').run(id)
      return this.db.prepare('DELETE FROM project_workflow_templates WHERE id = ?').run(id).changes > 0
    })
    return del()
  }

  copyGlobalWorkflowToProject(globalTemplateId: string, projectId: string): WorkflowTemplate {
    const template = this.getWorkflowTemplateByScope(globalTemplateId, 'global')
    if (!template) throw new Error('Global template not found')
    return this.createWorkflowTemplate({
      name: template.name,
      description: template.description ?? undefined,
      workflow_type: template.workflow_type,
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

  private getWorkflowTemplateByScope(id: string, scope: 'global' | 'project'): WorkflowTemplate | null {
    if (scope === 'global') {
      const template = this.db.prepare('SELECT * FROM global_workflow_templates WHERE id = ?').get(id) as WorkflowTemplate | undefined
      if (!template) return null
      return { ...template, scope: 'global', project_id: null, nodes: this.getWorkNodeTemplates(id, 'global') }
    }
    const template = this.db.prepare('SELECT * FROM project_workflow_templates WHERE id = ?').get(id) as WorkflowTemplate | undefined
    if (!template) return null
    return { ...template, scope: 'project', nodes: this.getWorkNodeTemplates(id, 'project') }
  }

  private getWorkNodeTemplates(templateId: string, scope: 'global' | 'project'): WorkNodeTemplate[] {
    const rows = this.db.prepare(
      scope === 'global'
        ? 'SELECT * FROM global_work_node_templates WHERE workflow_template_id = ? ORDER BY node_order ASC'
        : 'SELECT * FROM project_work_node_templates WHERE workflow_template_id = ? ORDER BY node_order ASC'
    ).all(templateId) as WorkNodeTemplate[]
    return rows.map((node) => ({
      ...node,
      requires_approval: Boolean(node.requires_approval),
      continue_on_error: Boolean(node.continue_on_error)
    }))
  }

  getWorkNodeTemplate(templateId: string): WorkNodeTemplate | null {
    // 先尝试从全局模板查找
    let template = this.db.prepare(
      'SELECT * FROM global_work_node_templates WHERE id = ?'
    ).get(templateId) as WorkNodeTemplate | undefined
    if (template) {
      return {
        ...template,
        requires_approval: Boolean(template.requires_approval),
        continue_on_error: Boolean(template.continue_on_error)
      }
    }
    // 再尝试从项目模板查找
    template = this.db.prepare(
      'SELECT * FROM project_work_node_templates WHERE id = ?'
    ).get(templateId) as WorkNodeTemplate | undefined
    if (template) {
      return {
        ...template,
        requires_approval: Boolean(template.requires_approval),
        continue_on_error: Boolean(template.continue_on_error)
      }
    }
    return null
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

    const nodeTemplate = this.getWorkNodeTemplate(workNode.work_node_template_id)
    const nodePrompt = nodeTemplate?.prompt || ''

    // 组合提示词：任务提示词 + 节点提示词
    if (nodePrompt) {
      return `${task.prompt}\n\n${nodePrompt}`
    }
    return task.prompt
  }

  // ============ Workflow 实例操作 ============
  createWorkflow(taskId: string, templateId: string, scope: 'global' | 'project'): Workflow {
    const now = new Date().toISOString()
    const id = newUlid()
    this.db.prepare(`
      INSERT INTO workflows (id, task_id, workflow_template_id, workflow_template_scope, current_node_index, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 'todo', ?, ?)
    `).run(id, taskId, templateId, scope, now, now)
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
  createWorkNode(workflowId: string, templateId: string, nodeOrder: number): WorkNode {
    const now = new Date().toISOString()
    const id = newUlid()
    this.db.prepare(`
      INSERT INTO work_nodes (id, workflow_id, work_node_template_id, node_order, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'todo', ?, ?)
    `).run(id, workflowId, templateId, nodeOrder, now, now)
    return this.getWorkNode(id)!
  }

  getWorkNode(id: string): WorkNode | null {
    return this.db.prepare('SELECT * FROM work_nodes WHERE id = ?').get(id) as WorkNode | null
  }

  getWorkNodesByWorkflowId(workflowId: string): WorkNode[] {
    return this.db.prepare('SELECT * FROM work_nodes WHERE workflow_id = ? ORDER BY node_order ASC').all(workflowId) as WorkNode[]
  }

  updateWorkNodeStatus(id: string, status: string): WorkNode | null {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE work_nodes SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
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
    const workNodeStatus = agentStatus === 'running' ? 'in_progress' : 'in_review'
    this.updateWorkNodeStatus(workNodeId, workNodeStatus)

    // 同步更新 Task 状态
    const workNode = this.getWorkNode(workNodeId)
    if (workNode) {
      this.syncTaskStatusFromWorkflow(workNode.workflow_id)
    }
  }

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.db.close()
  }
}
