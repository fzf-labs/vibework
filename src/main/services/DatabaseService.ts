import Database from 'better-sqlite3'
import { getAppPaths } from './AppPaths'

// 类型定义
export interface Project {
  id: string
  name: string
  path: string
  description: string | null
  config: string | null
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  config?: Record<string, unknown>
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  config?: Record<string, unknown>
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
}

interface Task {
  id: string
  session_id: string
  task_index: number
  prompt: string
  status: 'running' | 'completed' | 'error' | 'stopped'
  cost: number | null
  duration: number | null
  favorite: boolean
  created_at: string
  updated_at: string
}

interface UpdateTaskInput {
  status?: 'running' | 'completed' | 'error' | 'stopped'
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
  id: number
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
  id: number
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
        status TEXT NOT NULL,
        cost REAL,
        duration REAL,
        favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `)

    // 创建 messages 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
      CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id);
    `)

    console.log('[DatabaseService] Tables created successfully')
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
      INSERT INTO tasks (id, session_id, task_index, prompt, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, ?)
    `)
    stmt.run(input.id, input.session_id, input.task_index, input.prompt, now, now)
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

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
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
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        task_id, type, content, tool_name, tool_input, tool_output,
        tool_use_id, subtype, error_message, attachments, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
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
    return this.getMessage(result.lastInsertRowid as number)!
  }

  getMessage(id: number): Message | null {
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
    const stmt = this.db.prepare(`
      INSERT INTO files (task_id, name, type, path, preview, thumbnail, is_favorite, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `)
    const result = stmt.run(
      input.task_id,
      input.name,
      input.type,
      input.path,
      input.preview || null,
      input.thumbnail || null,
      now
    )
    return this.getFile(result.lastInsertRowid as number)!
  }

  getFile(id: number): LibraryFile | null {
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

  toggleFileFavorite(fileId: number): LibraryFile | null {
    const file = this.getFile(fileId)
    if (!file) return null

    const stmt = this.db.prepare('UPDATE files SET is_favorite = ? WHERE id = ?')
    stmt.run(file.is_favorite ? 0 : 1, fileId)
    return this.getFile(fileId)
  }

  deleteFile(fileId: number): boolean {
    const stmt = this.db.prepare('DELETE FROM files WHERE id = ?')
    const result = stmt.run(fileId)
    return result.changes > 0
  }

  // ============ Project 操作 ============
  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, description, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      input.name,
      input.path,
      input.description || null,
      input.config ? JSON.stringify(input.config) : null,
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
