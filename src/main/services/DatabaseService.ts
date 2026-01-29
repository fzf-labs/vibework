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

interface PipelineTemplate {
  id: string
  name: string
  description: string | null
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  stages: PipelineTemplateStage[]
}

interface PipelineTemplateStage {
  id: string
  template_id: string
  stage_order: number
  name: string
  prompt: string
  requires_approval: boolean
  continue_on_error: boolean
  created_at: string
  updated_at: string
}

interface CreatePipelineTemplateStageInput {
  name: string
  prompt: string
  stage_order: number
  requires_approval?: boolean
  continue_on_error?: boolean
}

interface CreatePipelineTemplateInput {
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  stages: CreatePipelineTemplateStageInput[]
}

interface UpdatePipelineTemplateInput {
  id: string
  name: string
  description?: string
  scope: 'global' | 'project'
  project_id?: string
  stages: CreatePipelineTemplateStageInput[]
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

  constructor() {
    const appPaths = getAppPaths()
    const dbPath = appPaths.getDatabaseFile()
    console.log('[DatabaseService] Initializing database at:', dbPath)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
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
        status TEXT NOT NULL DEFAULT 'pending',
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

    // 创建流水线模板表（全局/项目分离）
    this.ensureTaskPipelineTables()

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
      CREATE INDEX IF NOT EXISTS idx_projects_task_pipeline_templates_project_id ON projects_task_pipeline_templates(project_id);
      CREATE INDEX IF NOT EXISTS idx_global_task_pipeline_template_stages_template_id ON global_task_pipeline_template_stages(template_id);
      CREATE INDEX IF NOT EXISTS idx_projects_task_pipeline_template_stages_template_id ON projects_task_pipeline_template_stages(template_id);
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
    this.ensureTaskPipelineTables()
    this.migrateLegacyPipelineTemplates()
    this.backfillTaskTitles()
    this.backfillWorkspacePaths()
    this.migrateToUlidIdentifiers()
    this.migrateRemoveFileLibrary()
  }

  private ensureTaskPipelineTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_task_pipeline_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_task_pipeline_template_stages (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        stage_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 1,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES global_task_pipeline_templates(id) ON DELETE CASCADE
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects_task_pipeline_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects_task_pipeline_template_stages (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        stage_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 1,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES projects_task_pipeline_templates(id) ON DELETE CASCADE
      )
    `)
  }

  private migrateLegacyPipelineTemplates(): void {
    if (!this.tableExists('pipeline_templates')) return
    if (!this.tableExists('pipeline_template_stages')) return

    const globalCount = this.db
      .prepare('SELECT COUNT(*) as count FROM global_task_pipeline_templates')
      .get() as { count: number }
    const projectCount = this.db
      .prepare('SELECT COUNT(*) as count FROM projects_task_pipeline_templates')
      .get() as { count: number }

    if (globalCount.count > 0 || projectCount.count > 0) return

    const templates = this.db.prepare('SELECT * FROM pipeline_templates').all() as any[]
    if (templates.length === 0) return

    const stages = this.db.prepare('SELECT * FROM pipeline_template_stages').all() as any[]

    const migrate = this.db.transaction(() => {
      const insertGlobal = this.db.prepare(`
        INSERT INTO global_task_pipeline_templates (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      const insertProject = this.db.prepare(`
        INSERT INTO projects_task_pipeline_templates (id, project_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const insertGlobalStage = this.db.prepare(`
        INSERT INTO global_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const insertProjectStage = this.db.prepare(`
        INSERT INTO projects_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const template of templates) {
        const scope = template.scope === 'project' ? 'project' : 'global'
        if (scope === 'project' && !template.project_id) {
          console.warn(
            '[DatabaseService] Project pipeline template missing project_id, treating as global:',
            template.id
          )
        }
        if (scope === 'project' && template.project_id) {
          insertProject.run(
            template.id,
            template.project_id,
            template.name,
            template.description ?? null,
            template.created_at,
            template.updated_at
          )
        } else {
          insertGlobal.run(
            template.id,
            template.name,
            template.description ?? null,
            template.created_at,
            template.updated_at
          )
        }

        const relatedStages = stages.filter((stage) => stage.template_id === template.id)
        relatedStages.forEach((stage) => {
          const insert =
            scope === 'project' && template.project_id
              ? insertProjectStage
              : insertGlobalStage
          insert.run(
            stage.id,
            stage.template_id,
            stage.stage_order,
            stage.name,
            stage.prompt,
            stage.requires_approval ?? 1,
            stage.continue_on_error ?? 0,
            stage.created_at,
            stage.updated_at
          )
        })
      }
    })

    migrate()
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
          status TEXT NOT NULL DEFAULT 'pending',
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
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    return this.getTask(id)
  }

  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
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

  // ============ Pipeline Template 操作 ============
  createPipelineTemplate(input: CreatePipelineTemplateInput): PipelineTemplate {
    const now = new Date().toISOString()
    const templateId = newUlid()
    const stages = input.stages ?? []

    if (input.scope === 'project' && !input.project_id) {
      throw new Error('Project pipeline template requires project_id')
    }

    const create = this.db.transaction(() => {
      if (input.scope === 'global') {
        const stmt = this.db.prepare(`
          INSERT INTO global_task_pipeline_templates (id, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        stmt.run(templateId, input.name, input.description || null, now, now)
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO projects_task_pipeline_templates (id, project_id, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        stmt.run(
          templateId,
          input.project_id!,
          input.name,
          input.description || null,
          now,
          now
        )
      }

      const insertStage = this.db.prepare(
        input.scope === 'global'
          ? `
        INSERT INTO global_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
          : `
        INSERT INTO projects_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )

      stages.forEach((stage) => {
        insertStage.run(
          newUlid(),
          templateId,
          stage.stage_order,
          stage.name,
          stage.prompt,
          stage.requires_approval ? 1 : 0,
          stage.continue_on_error ? 1 : 0,
          now,
          now
        )
      })
    })

    create()
    return this.getPipelineTemplateByScope(templateId, input.scope)!
  }

  getPipelineTemplate(id: string): PipelineTemplate | null {
    const projectTemplate = this.getPipelineTemplateByScope(id, 'project')
    if (projectTemplate) return projectTemplate
    return this.getPipelineTemplateByScope(id, 'global')
  }

  getPipelineTemplatesByProject(projectId: string): PipelineTemplate[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM projects_task_pipeline_templates WHERE project_id = ? ORDER BY updated_at DESC'
      )
      .all(projectId) as PipelineTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'project' as const,
      stages: this.getPipelineTemplateStages(row.id, 'project')
    }))
  }

  getGlobalPipelineTemplates(): PipelineTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM global_task_pipeline_templates ORDER BY updated_at DESC')
      .all() as PipelineTemplate[]
    return rows.map((row) => ({
      ...row,
      scope: 'global' as const,
      project_id: null,
      stages: this.getPipelineTemplateStages(row.id, 'global')
    }))
  }

  createProjectTemplateFromGlobal(
    globalTemplateId: string,
    projectId: string
  ): PipelineTemplate {
    const template = this.getPipelineTemplateByScope(globalTemplateId, 'global')
    if (!template) {
      throw new Error('Global template not found')
    }

    return this.createPipelineTemplate({
      name: template.name,
      description: template.description ?? undefined,
      scope: 'project',
      project_id: projectId,
      stages: template.stages.map((stage) => ({
        name: stage.name,
        prompt: stage.prompt,
        stage_order: stage.stage_order,
        requires_approval: Boolean(stage.requires_approval),
        continue_on_error: Boolean(stage.continue_on_error)
      }))
    })
  }

  updatePipelineTemplate(input: UpdatePipelineTemplateInput): PipelineTemplate {
    const now = new Date().toISOString()

    const existing = this.getPipelineTemplateByScope(input.id, input.scope)
    if (!existing) {
      throw new Error('Pipeline template not found')
    }

    const projectId =
      input.scope === 'project'
        ? input.project_id || existing.project_id
        : null

    if (input.scope === 'project' && !projectId) {
      throw new Error('Project pipeline template requires project_id')
    }

    const update = this.db.transaction(() => {
      if (input.scope === 'global') {
        this.db
          .prepare(
            'UPDATE global_task_pipeline_templates SET name = ?, description = ?, updated_at = ? WHERE id = ?'
          )
          .run(input.name, input.description || null, now, input.id)
        this.db
          .prepare(
            'DELETE FROM global_task_pipeline_template_stages WHERE template_id = ?'
          )
          .run(input.id)
      } else {
        this.db
          .prepare(
            'UPDATE projects_task_pipeline_templates SET name = ?, description = ?, updated_at = ?, project_id = ? WHERE id = ?'
          )
          .run(
            input.name,
            input.description || null,
            now,
            projectId,
            input.id
          )
        this.db
          .prepare(
            'DELETE FROM projects_task_pipeline_template_stages WHERE template_id = ?'
          )
          .run(input.id)
      }

      const insertStage = this.db.prepare(
        input.scope === 'global'
          ? `
        INSERT INTO global_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
          : `
        INSERT INTO projects_task_pipeline_template_stages (
          id, template_id, stage_order, name, prompt, requires_approval, continue_on_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )

      input.stages.forEach((stage) => {
        insertStage.run(
          newUlid(),
          input.id,
          stage.stage_order,
          stage.name,
          stage.prompt,
          stage.requires_approval ? 1 : 0,
          stage.continue_on_error ? 1 : 0,
          now,
          now
        )
      })
    })

    update()
    return this.getPipelineTemplateByScope(input.id, input.scope)!
  }

  deletePipelineTemplate(id: string, scope: 'global' | 'project'): boolean {
    const del = this.db.transaction(() => {
      if (scope === 'global') {
        this.db
          .prepare(
            'DELETE FROM global_task_pipeline_template_stages WHERE template_id = ?'
          )
          .run(id)
        const result = this.db
          .prepare('DELETE FROM global_task_pipeline_templates WHERE id = ?')
          .run(id)
        return result.changes > 0
      }
      this.db
        .prepare(
          'DELETE FROM projects_task_pipeline_template_stages WHERE template_id = ?'
        )
        .run(id)
      const result = this.db
        .prepare('DELETE FROM projects_task_pipeline_templates WHERE id = ?')
        .run(id)
      return result.changes > 0
    })

    return del()
  }

  private getPipelineTemplateByScope(
    id: string,
    scope: 'global' | 'project'
  ): PipelineTemplate | null {
    if (scope === 'global') {
      const template = this.db
        .prepare('SELECT * FROM global_task_pipeline_templates WHERE id = ?')
        .get(id) as PipelineTemplate | undefined
      if (!template) return null
      return {
        ...template,
        scope: 'global',
        project_id: null,
        stages: this.getPipelineTemplateStages(id, 'global')
      }
    }
    const template = this.db
      .prepare('SELECT * FROM projects_task_pipeline_templates WHERE id = ?')
      .get(id) as PipelineTemplate | undefined
    if (!template) return null
    return {
      ...template,
      scope: 'project',
      stages: this.getPipelineTemplateStages(id, 'project')
    }
  }

  private getPipelineTemplateStages(
    templateId: string,
    scope: 'global' | 'project'
  ): PipelineTemplateStage[] {
    const rows = this.db
      .prepare(
        scope === 'global'
          ? 'SELECT * FROM global_task_pipeline_template_stages WHERE template_id = ? ORDER BY stage_order ASC'
          : 'SELECT * FROM projects_task_pipeline_template_stages WHERE template_id = ? ORDER BY stage_order ASC'
      )
      .all(templateId) as PipelineTemplateStage[]
    return rows.map((stage) => ({
      ...stage,
      requires_approval: Boolean(stage.requires_approval),
      continue_on_error: Boolean(stage.continue_on_error)
    }))
  }

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.db.close()
  }
}
