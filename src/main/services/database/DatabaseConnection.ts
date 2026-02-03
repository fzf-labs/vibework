import Database from 'better-sqlite3'

export class DatabaseConnection {
  private dbPath: string
  private db?: Database.Database

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  open(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')
    }
    return this.db
  }

  initTables(): void {
    const db = this.assertDb()
    console.log('[DatabaseService] Creating tables...')

    // 创建 projects 表
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_template_nodes (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 0,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE
      )
    `)

    // 创建 workflows 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        current_node_index INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // 创建 work_nodes 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS work_nodes (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        template_node_id TEXT,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 0,
        continue_on_error INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (template_node_id) REFERENCES workflow_template_nodes(id) ON DELETE SET NULL
      )
    `)

    // 创建 agent_executions 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        work_node_id TEXT NOT NULL,
        execution_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        started_at TEXT,
        completed_at TEXT,
        cost REAL,
        duration REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_node_id) REFERENCES work_nodes(id) ON DELETE CASCADE
      )
    `)

    this.createIndexes(db)

    console.log('[DatabaseService] Tables created successfully')
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = undefined
    }
  }

  getDb(): Database.Database {
    return this.assertDb()
  }

  private assertDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not opened')
    }
    return this.db
  }

  private createIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_task_id ON workflows(task_id);
      CREATE INDEX IF NOT EXISTS idx_work_nodes_workflow_id ON work_nodes(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_agent_exec_work_node_id ON agent_executions(work_node_id);
    `)

    // workflow_templates 唯一性索引（部分索引）
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_template_name
        ON workflow_templates(name)
        WHERE scope = 'global';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_template_name
        ON workflow_templates(project_id, name)
        WHERE scope = 'project';
    `)
  }
}
