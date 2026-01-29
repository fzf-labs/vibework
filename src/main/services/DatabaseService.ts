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
  prompt: string
  project_id?: string
  worktree_path?: string
  branch_name?: string
}

interface Task {
  id: string
  session_id: string
  task_index: number
  prompt: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'stopped'
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  created_at: string
  updated_at: string
}

interface UpdateTaskInput {
  status?: 'pending' | 'running' | 'completed' | 'error' | 'stopped'
  worktree_path?: string | null
  branch_name?: string | null
  cost?: number | null
  duration?: number | null
  favorite?: boolean
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
  attachments?: any[] | null
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
  attachments: any[] | null
  created_at: string
}

interface CreateFileInput {
  task_id: string
  name: string
  type: string
  path: string
  preview?: string | null
  thumbnail?: string | null
}

interface LibraryFile {
  id: string
  task_id: string
  name: string
  type: string
  path: string
  preview: string | null
  thumbnail: string | null
  is_favorite: boolean
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
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
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
        attachments TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // 创建 files 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        preview TEXT,
        thumbnail TEXT,
        is_favorite INTEGER DEFAULT 0,
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
      CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id);
    `)
  }

  private migrateSchema(): void {
    this.ensureColumn('projects', 'project_type', "TEXT NOT NULL DEFAULT 'normal'")
    this.ensureColumn('tasks', 'project_id', 'TEXT')
    this.ensureColumn('tasks', 'worktree_path', 'TEXT')
    this.ensureColumn('tasks', 'branch_name', 'TEXT')
    this.ensureColumn('tasks', 'cost', 'REAL')
    this.ensureColumn('tasks', 'duration', 'REAL')
    this.ensureColumn('tasks', 'favorite', 'INTEGER DEFAULT 0')
    this.migrateToUlidIdentifiers()
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
          prompt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          project_id TEXT,
          worktree_path TEXT,
          branch_name TEXT,
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
          attachments TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks_ulid(id) ON DELETE CASCADE
        );
        CREATE TABLE files_ulid (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          path TEXT NOT NULL,
          preview TEXT,
          thumbnail TEXT,
          is_favorite INTEGER DEFAULT 0,
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
          id, session_id, task_index, prompt, status, project_id, worktree_path, branch_name,
          cost, duration, favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          row.prompt,
          row.status,
          mappedProjectId ?? null,
          row.worktree_path ?? null,
          row.branch_name ?? null,
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
          tool_use_id, subtype, error_message, attachments, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          row.attachments ?? null,
          row.created_at
        )
      }

      const fileRows = this.db.prepare('SELECT * FROM files').all() as any[]
      const insertFile = this.db.prepare(`
        INSERT INTO files_ulid (
          id, task_id, name, type, path, preview, thumbnail, is_favorite, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const row of fileRows) {
        const mappedTaskId = taskIdMap.get(String(row.task_id))
        if (!mappedTaskId) {
          throw new Error(`Missing task mapping for file ${row.id}`)
        }
        insertFile.run(
          newUlid(),
          mappedTaskId,
          row.name,
          row.type,
          row.path,
          row.preview ?? null,
          row.thumbnail ?? null,
          row.is_favorite ?? 0,
          row.created_at
        )
      }

      this.assertRowCounts('projects', projectRows.length, 'projects_ulid')
      this.assertRowCounts('sessions', sessionRows.length, 'sessions_ulid')
      this.assertRowCounts('tasks', taskRows.length, 'tasks_ulid')
      this.assertRowCounts('messages', messageRows.length, 'messages_ulid')
      this.assertRowCounts('files', fileRows.length, 'files_ulid')

      this.db.exec(`
        DROP TABLE messages;
        DROP TABLE files;
        DROP TABLE tasks;
        DROP TABLE sessions;
        DROP TABLE projects;
      `)
      this.db.exec(`
        ALTER TABLE projects_ulid RENAME TO projects;
        ALTER TABLE sessions_ulid RENAME TO sessions;
        ALTER TABLE tasks_ulid RENAME TO tasks;
        ALTER TABLE messages_ulid RENAME TO messages;
        ALTER TABLE files_ulid RENAME TO files;
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

    const tables = ['projects', 'sessions', 'tasks', 'messages', 'files']
    for (const table of tables) {
      if (!this.tableExists(table)) return false
    }

    if (this.getIdColumnType('messages') !== 'TEXT') return true
    if (this.getIdColumnType('files') !== 'TEXT') return true

    return tables.some((table) => this.tableHasNonUlidIds(table))
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
      INSERT INTO tasks (id, session_id, task_index, prompt, status, project_id, worktree_path, branch_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `)
    stmt.run(
      input.id,
      input.session_id,
      input.task_index,
      input.prompt,
      input.project_id || null,
      input.worktree_path || null,
      input.branch_name || null,
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
    if (updates.worktree_path !== undefined) {
      fields.push('worktree_path = ?')
      values.push(updates.worktree_path)
    }
    if (updates.branch_name !== undefined) {
      fields.push('branch_name = ?')
      values.push(updates.branch_name)
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
        tool_use_id, subtype, error_message, attachments, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.attachments ? JSON.stringify(input.attachments) : null,
      now
    )
    return this.getMessage(id)!
  }

  getMessage(id: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?')
    const msg = stmt.get(id) as any
    if (msg && msg.attachments) {
      msg.attachments = JSON.parse(msg.attachments)
    }
    return msg
  }

  getMessagesByTaskId(taskId: string): Message[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY id ASC')
    const messages = stmt.all(taskId) as any[]
    return messages.map((msg) => {
      if (msg.attachments) {
        msg.attachments = JSON.parse(msg.attachments)
      }
      return msg
    })
  }

  deleteMessagesByTaskId(taskId: string): number {
    const stmt = this.db.prepare('DELETE FROM messages WHERE task_id = ?')
    const result = stmt.run(taskId)
    return result.changes
  }

  // ============ File 操作 ============
  createFile(input: CreateFileInput): LibraryFile {
    const now = new Date().toISOString()
    const id = newUlid()
    const stmt = this.db.prepare(`
      INSERT INTO files (id, task_id, name, type, path, preview, thumbnail, is_favorite, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `)
    stmt.run(
      id,
      input.task_id,
      input.name,
      input.type,
      input.path,
      input.preview || null,
      input.thumbnail || null,
      now
    )
    return this.getFile(id)!
  }

  getFile(id: string): LibraryFile | null {
    const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?')
    const file = stmt.get(id) as any
    if (file) {
      file.is_favorite = Boolean(file.is_favorite)
    }
    return file
  }

  getFilesByTaskId(taskId: string): LibraryFile[] {
    const stmt = this.db.prepare('SELECT * FROM files WHERE task_id = ? ORDER BY created_at DESC')
    const files = stmt.all(taskId) as any[]
    return files.map((f) => ({ ...f, is_favorite: Boolean(f.is_favorite) }))
  }

  getAllFiles(): LibraryFile[] {
    const stmt = this.db.prepare('SELECT * FROM files ORDER BY created_at DESC')
    const files = stmt.all() as any[]
    return files.map((f) => ({ ...f, is_favorite: Boolean(f.is_favorite) }))
  }

  toggleFileFavorite(fileId: string): LibraryFile | null {
    const file = this.getFile(fileId)
    if (!file) return null

    const stmt = this.db.prepare('UPDATE files SET is_favorite = ? WHERE id = ?')
    stmt.run(file.is_favorite ? 0 : 1, fileId)
    return this.getFile(fileId)
  }

  deleteFile(fileId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM files WHERE id = ?')
    const result = stmt.run(fileId)
    return result.changes > 0
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

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.db.close()
  }
}
